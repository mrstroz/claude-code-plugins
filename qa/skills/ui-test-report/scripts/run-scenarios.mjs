#!/usr/bin/env node
/*
 * Run a qa-scenarios.json file through Playwright and write one captioned
 * screenshot per scenario plus qa-results.json.
 *
 *   node run-scenarios.mjs --scenarios qa-scenarios.json --base-url http://localhost:3000 \
 *     [--driver headed|headless] [--profile DIR] [--out screenshots] [--results qa-results.json] \
 *     [--slow-mo MS] [--only 07,08] [--viewport 1440x900] [--login]
 *
 * What this owns, and why it is a script rather than instructions:
 *   - the verdict comes from the `expect` steps, not from reading a picture.
 *     A PASS in the results file means an assertion ran against the DOM and held
 *   - the screenshot is written straight to NN-slug.jpg, so the number in the
 *     report row and the number on the file can never disagree
 *   - the caption overlay is injected as an init script, so it survives every
 *     reload and hard navigation
 *   - an error in one scenario (a selector that no longer matches, a timeout)
 *     does not stop the run. It is recorded as status "error", its screenshot
 *     goes to NN-slug.error.jpg — a name check-evidence.js rejects on purpose —
 *     and the next scenario runs. A FAIL is a result; an error is a broken step
 *
 * What it does not do: log in for you (--login opens a window and waits),
 * install Playwright (it prints the command), or post anything anywhere.
 *
 * Exit codes: 0 all scenarios ran (FAILs included), 1 at least one scenario
 * errored, 2 the environment is not usable (no Playwright, bad arguments,
 * profile locked).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(os.homedir(), ".cache", "qa-ui-test");
const INSTALL_HINT =
  `npm install --prefix ${STATE_DIR} playwright@1 && ` +
  `npx --prefix ${STATE_DIR} playwright install chromium`;

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = {
    scenarios: "qa-scenarios.json",
    baseUrl: null,
    driver: "headed",
    profile: path.join(STATE_DIR, "profile"),
    out: "screenshots",
    results: "qa-results.json",
    slowMo: null,
    only: null,
    viewport: { width: 1440, height: 900 },
    login: false,
    timeout: 10000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) die(2, `${a} needs a value`);
      return argv[++i];
    };
    switch (a) {
      case "--scenarios": opts.scenarios = next(); break;
      case "--base-url": opts.baseUrl = next(); break;
      case "--driver": opts.driver = next(); break;
      case "--profile": opts.profile = next(); break;
      case "--out": opts.out = next(); break;
      case "--results": opts.results = next(); break;
      case "--slow-mo": opts.slowMo = Number(next()); break;
      case "--only": opts.only = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--timeout": opts.timeout = Number(next()); break;
      case "--viewport": {
        const m = next().match(/^(\d+)x(\d+)$/);
        if (!m) die(2, "--viewport wants WIDTHxHEIGHT, e.g. 1440x900");
        opts.viewport = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      case "--login": opts.login = true; break;
      case "-h": case "--help": usage(); process.exit(0);
      default: die(2, `unknown argument: ${a}`);
    }
  }
  if (!["headed", "headless"].includes(opts.driver)) die(2, "--driver must be headed or headless");
  if (opts.slowMo === null) opts.slowMo = opts.driver === "headed" ? 250 : 0;
  if (!opts.baseUrl) die(2, "--base-url is required (e.g. http://localhost:3000)");
  opts.baseUrl = opts.baseUrl.replace(/\/+$/, "");
  return opts;
}

function usage() {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\n?/, "").replace(/^ \* ?/gm, ""));
}

function die(code, msg) {
  console.error(`run-scenarios: ${msg}`);
  process.exit(code);
}

// --------------------------------------------------------- playwright lookup

/**
 * Resolve the `playwright` package from, in order: the project this run is in,
 * the tool's own state directory, wherever this script lives, the global npm
 * root. The plugin cache is versioned and replaced on update, so a node_modules
 * inside it would vanish — that is why the fallback lives under ~/.cache.
 */
function loadPlaywright() {
  const bases = [process.cwd(), STATE_DIR, HERE];
  for (const base of bases) {
    try {
      return createRequire(path.join(base, "noop.js"))("playwright");
    } catch (e) {
      if (e.code !== "MODULE_NOT_FOUND") throw e;
    }
  }
  try {
    const root = execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return createRequire(path.join(root, "noop.js"))("playwright");
  } catch {
    /* fall through */
  }
  die(2, `the playwright package is not installed anywhere this script looks.\n  Install it once with:\n    ${INSTALL_HINT}`);
}

// ---------------------------------------------------------------- selectors

/** A string is a Playwright selector; an object picks one of the getBy* locators. */
function locate(page, target) {
  if (typeof target === "string") return page.locator(target);
  if (target && typeof target === "object") {
    if (target.role) return page.getByRole(target.role, { name: target.name, exact: target.exact });
    if (target.text !== undefined) return page.getByText(target.text, { exact: target.exact });
    if (target.label !== undefined) return page.getByLabel(target.label, { exact: target.exact });
    if (target.placeholder !== undefined) return page.getByPlaceholder(target.placeholder);
    if (target.testId !== undefined) return page.getByTestId(target.testId);
    if (target.selector) {
      let loc = page.locator(target.selector);
      if (target.nth !== undefined) loc = loc.nth(target.nth);
      return loc;
    }
  }
  throw new Error(`cannot locate ${JSON.stringify(target)}`);
}

// ---------------------------------------------------------------- templating

/** Replace ${name} with the value read earlier under that name. */
function fill(template, values) {
  if (typeof template !== "string") return template;
  return template.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (m, k) => (k in values ? String(values[k]) : m));
}

/** An expect operand: a ${ref} resolves to a stored value; anything else is literal. */
function operand(v, values) {
  if (typeof v === "string") {
    const m = v.match(/^\$\{([a-zA-Z0-9_]+)\}$/);
    if (m) {
      if (!(m[1] in values)) throw new Error(`expect refers to \${${m[1]}} but nothing read it`);
      return values[m[1]];
    }
  }
  return v;
}

const COMPARATORS = {
  equals: (a, b) => a === b || String(a) === String(b),
  notEquals: (a, b) => !(a === b || String(a) === String(b)),
  matches: (a, b) => new RegExp(b).test(String(a)),
  contains: (a, b) => String(a).includes(String(b)),
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  truthy: (a) => !!a,
  falsy: (a) => !a,
};

// ------------------------------------------------------------------ steps

async function runStep(page, step, values, opts, sink) {
  const keys = Object.keys(step);
  const kind = keys.find((k) => k in STEP);
  if (!kind) throw new Error(`unknown step ${JSON.stringify(step)}`);
  return STEP[kind](page, step[kind], step, values, opts, sink);
}

const STEP = {
  async goto(page, url, _s, values, opts) {
    const u = fill(url, values);
    await page.goto(/^https?:\/\//.test(u) ? u : opts.baseUrl + (u.startsWith("/") ? u : "/" + u));
    await page.waitForLoadState("networkidle").catch(() => {});
  },
  async reload(page) {
    await page.reload();
    await page.waitForLoadState("networkidle").catch(() => {});
  },
  async click(page, target) {
    await locate(page, target).click();
  },
  async dblclick(page, target) {
    await locate(page, target).dblclick();
  },
  async hover(page, target) {
    await locate(page, target).hover();
  },
  async fill(page, spec, _s, values) {
    await locate(page, spec.selector ?? spec.target ?? spec).fill(fill(spec.value, values));
  },
  async type(page, spec, _s, values) {
    await locate(page, spec.selector ?? spec.target).pressSequentially(fill(spec.value, values));
  },
  async select(page, spec, _s, values) {
    await locate(page, spec.selector ?? spec.target).selectOption(fill(spec.value, values));
  },
  async check(page, target) {
    await locate(page, target).check();
  },
  async uncheck(page, target) {
    await locate(page, target).uncheck();
  },
  async press(page, key, step) {
    if (step.selector) await locate(page, step.selector).press(key);
    else await page.keyboard.press(key);
  },
  async wait(page, what, _s, values, opts) {
    if (typeof what === "number") return page.waitForTimeout(what);
    if (["load", "domcontentloaded", "networkidle"].includes(what)) return page.waitForLoadState(what);
    if (typeof what === "string") return page.locator(what).first().waitFor({ state: "visible", timeout: opts.timeout });
    if (what.url) return page.waitForURL(new RegExp(fill(what.url, values)), { timeout: opts.timeout });
    if (what.js) return page.waitForFunction(what.js, null, { timeout: opts.timeout });
    return locate(page, what).first().waitFor({ state: what.state || "visible", timeout: opts.timeout });
  },
  async read(page, spec, _s, values) {
    values[spec.name] = await page.evaluate(spec.js);
  },
  async expect(page, spec, _s, values, opts, sink) {
    const actual = spec.js !== undefined ? await page.evaluate(spec.js) : operand(`\${${spec.name}}`, values);
    const op = Object.keys(COMPARATORS).find((k) => k in spec);
    if (!op) throw new Error(`expect without a comparator: ${JSON.stringify(spec)}`);
    const expected = operand(spec[op], values);
    const passed = COMPARATORS[op](actual, expected);
    const desc = spec.desc || `${spec.js || "${" + spec.name + "}"} ${op} ${JSON.stringify(spec[op])}`;
    sink.push({ desc, passed, actual, expected: op === "truthy" || op === "falsy" ? undefined : expected });
  },
};

// A drawer that closed 50 ms ago is still on screen mid-slide. Fast-forwarding
// CSS transitions at capture time is what makes "Apply closes the drawer" and
// the picture agree without every scenario carrying a 350 ms wait.
const SHOT = (file) => ({ path: file, type: "jpeg", quality: 85, animations: "disabled" });

// ----------------------------------------------------------------- caption

async function caption(page, annotateSrc, o) {
  const ready = await page.evaluate(() => typeof window.__ann === "function").catch(() => false);
  if (!ready) await page.addScriptTag({ content: annotateSrc });
  return page.evaluate((opts) => window.__ann(opts), o);
}

// -------------------------------------------------------------------- run

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pw = loadPlaywright();
  const annotateSrc = fs.readFileSync(path.join(HERE, "annotate.js"), "utf8");
  fs.mkdirSync(opts.profile, { recursive: true });

  let context;
  try {
    context = await pw.chromium.launchPersistentContext(opts.profile, {
      headless: opts.driver === "headless",
      slowMo: opts.slowMo,
      viewport: opts.viewport,
      ignoreDefaultArgs: ["--enable-automation"],
    });
  } catch (e) {
    if (/SingletonLock|already running|profile.*in use/i.test(e.message)) {
      die(2, `the QA profile at ${opts.profile} is in use by another Chromium — close it (or finish --login) first`);
    }
    if (/Executable doesn't exist|browserType.launch/i.test(e.message)) {
      die(2, `Playwright is installed but its Chromium is not:\n    ${INSTALL_HINT}\n\n${e.message}`);
    }
    throw e;
  }
  await context.addInitScript({ content: annotateSrc });
  const page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(opts.timeout);

  if (opts.login) {
    await page.goto(opts.baseUrl);
    console.log(`Log in in the window that just opened (profile: ${opts.profile}).`);
    console.log("When the app shows you logged in, press Enter here to save the session and close.");
    await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin });
      rl.once("line", () => { rl.close(); resolve(); });
    });
    await context.close();
    console.log("Session saved. Runs without --login will reuse it.");
    return 0;
  }

  const file = path.resolve(opts.scenarios);
  if (!fs.existsSync(file)) die(2, `scenarios file not found: ${file}`);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(doc) ? doc : doc.scenarios;
  if (!Array.isArray(list) || list.length === 0) die(2, "no scenarios in the file (expected an array or { scenarios: [...] })");
  const selected = opts.only ? list.filter((s) => opts.only.includes(String(s.n))) : list;
  if (selected.length === 0) die(2, `--only ${opts.only.join(",")} matched no scenario`);

  fs.mkdirSync(opts.out, { recursive: true });

  // Console and network noise, reset per scenario. A failed request explains an
  // empty list faster than another screenshot does.
  let noise = [];
  page.on("console", (m) => { if (m.type() === "error") noise.push(`console.error: ${m.text()}`); });
  page.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => noise.push(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText || ""}`));
  page.on("response", (r) => { if (r.status() >= 400) noise.push(`http ${r.status()}: ${r.request().method()} ${r.url()}`); });

  const values = {};
  const results = [];
  let errored = 0;

  for (const sc of selected) {
    const n = String(sc.n).padStart(2, "0");
    const slug = sc.slug || "scenario";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) die(2, `scenario ${n}: slug "${slug}" must be lowercase letters, digits and dashes`);
    noise = [];
    const expects = [];
    const rec = { n, slug, title: sc.title, status: null, values: {}, expects, caption: null, screenshot: null, console: noise };
    const started = Date.now();
    try {
      for (const step of sc.steps || []) {
        await runStep(page, step, values, opts, expects);
      }
      const ok = sc.manual ? null : expects.every((e) => e.passed);
      rec.status = ok === null ? "check" : ok ? "pass" : "fail";
      if (!sc.manual && expects.length === 0) rec.warning = "no expect steps — this PASS is not backed by an assertion";
      const cap = sc.caption || {};
      rec.caption = fill(cap.d || "", values);
      await caption(page, annotateSrc, {
        n, t: cap.t || sc.title || "", d: rec.caption, ok,
        hl: cap.hl || [], pins: cap.pins || [], top: !!cap.top,
      });
      rec.screenshot = path.join(opts.out, `${n}-${slug}.jpg`);
      await page.screenshot(SHOT(rec.screenshot));
    } catch (e) {
      errored++;
      rec.status = "error";
      rec.error = e.message.split("\n")[0];
      rec.screenshot = path.join(opts.out, `${n}-${slug}.error.jpg`);
      await page.screenshot(SHOT(rec.screenshot)).catch(() => { rec.screenshot = null; });
    }
    rec.values = Object.fromEntries((sc.steps || []).filter((s) => s.read).map((s) => [s.read.name, values[s.read.name]]));
    rec.ms = Date.now() - started;
    results.push(rec);
    // A scenario that errored earlier and now ran leaves its .error.jpg behind;
    // remove it, or check-evidence.js keeps rejecting a run that is actually fixed.
    if (rec.status !== "error") fs.rmSync(path.join(opts.out, `${n}-${slug}.error.jpg`), { force: true });
    const tag = { pass: "PASS ", fail: "FAIL ", check: "CHECK", error: "ERROR" }[rec.status];
    const extra = rec.status === "error" ? ` — ${rec.error}` : rec.status === "fail"
      ? ` — ${expects.filter((e) => !e.passed).map((e) => `${e.desc} (actual ${JSON.stringify(e.actual)})`).join("; ")}`
      : "";
    console.log(`${tag} ${n} ${sc.title || slug}${extra}`);
    if (rec.warning) console.log(`      ! ${rec.warning}`);
  }

  await context.close();

  // With --only, merge into the existing results file by scenario number so a
  // re-run of one fixed scenario does not throw away the other thirty-nine.
  let merged = results;
  if (opts.only && fs.existsSync(opts.results)) {
    try {
      const prev = JSON.parse(fs.readFileSync(opts.results, "utf8")).scenarios || [];
      const byN = new Map(prev.map((r) => [r.n, r]));
      for (const r of results) byN.set(r.n, r);
      merged = [...byN.values()].sort((a, b) => a.n.localeCompare(b.n));
    } catch {
      /* unreadable previous file: write this run alone */
    }
  }
  const summary = {
    driver: opts.driver === "headed" ? "playwright-headed" : "playwright-headless",
    profile: opts.profile,
    baseUrl: opts.baseUrl,
    viewport: opts.viewport,
    startedAt: new Date().toISOString(),
    scenarios: merged,
  };
  fs.writeFileSync(opts.results, JSON.stringify(summary, null, 2) + "\n");
  const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
  console.log(`\n${results.length} scenario(s): ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")} → ${opts.results}, ${opts.out}/`);
  if (errored) console.log(`${errored} errored — fix the step and re-run with --only <n>. Their *.error.jpg files will fail check-evidence.js until replaced.`);
  return errored ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
