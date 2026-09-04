#!/usr/bin/env node
/*
 * Run a scenarios.json file in the QA browser window and write one captioned
 * screenshot per scenario plus results.json.
 *
 *   node run-scenarios.mjs --base-url http://localhost:3000 [--scenarios scenarios.json] \
 *     [--out screenshots] [--results results.json] [--only 07,08] [--slow-mo MS] \
 *     [--viewport 1440x900] [--timeout MS] [--browser chromium|brave] [--executable PATH] \
 *     [--profile DIR] [--port 9333]
 *
 *   node run-scenarios.mjs --base-url URL --open            open the QA window (or a tab in it)
 *   node run-scenarios.mjs --base-url URL --eval JS [--url /path]   read one value, no scenario file
 *   node run-scenarios.mjs --close                          quit the QA window
 *
 * The browser is a long-lived process, not something each run starts and stops.
 * The first run (or --open) launches it detached, with remote debugging on a
 * local port, on a profile of its own; every later run connects over CDP, opens
 * a tab, works in it and closes only that tab. The window stays until --close.
 * That is what keeps a session alive: a login cookie with no expiry is dropped
 * the moment Chromium exits, so a runner that exits after every run can never
 * hold one. The user logs in once, in the window, and the runs reuse it.
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
 *   - a scenario whose status or assertions differ from the previous results
 *     file keeps the earlier entry under `history`, so a FAIL that became a
 *     PASS by rewriting the check stays visible in the data
 *
 * What it does not do: type credentials, install Playwright (it prints the
 * command), or post anything anywhere.
 *
 * Exit codes: 0 all scenarios ran (FAILs included), 1 at least one scenario
 * errored, 2 the environment is not usable (no Playwright, bad arguments,
 * browser did not start).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(os.homedir(), ".cache", "qa-ui-test");
const BROWSER_FILE = path.join(STATE_DIR, "browser.json");
const INSTALL_HINT =
  `npm install --prefix ${STATE_DIR} playwright@1 && ` +
  `npx --prefix ${STATE_DIR} playwright install chromium`;
const BRAVE_CANDIDATES = ["brave-browser", "brave", "brave-browser-stable"];

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = {
    scenarios: "scenarios.json",
    baseUrl: null,
    browser: null,
    executable: null,
    profile: null,
    port: 9333,
    out: "screenshots",
    results: "results.json",
    slowMo: 250,
    only: null,
    viewport: { width: 1440, height: 900 },
    timeout: 10000,
    open: false,
    close: false,
    eval: null,
    url: null,
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
      case "--browser": opts.browser = next(); break;
      case "--executable": opts.executable = next(); break;
      case "--profile": opts.profile = next(); break;
      case "--port": opts.port = Number(next()); break;
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
      case "--open": opts.open = true; break;
      case "--close": opts.close = true; break;
      case "--eval": opts.eval = next(); break;
      case "--url": opts.url = next(); break;
      case "-h": case "--help": usage(); process.exit(0);
      default: die(2, `unknown argument: ${a}`);
    }
  }
  if (opts.browser && !["chromium", "brave"].includes(opts.browser)) die(2, "--browser must be chromium or brave");
  if (!Number.isInteger(opts.port) || opts.port <= 0) die(2, "--port must be a port number");
  if (!opts.close && !opts.baseUrl) die(2, "--base-url is required (e.g. http://localhost:3000)");
  if (opts.baseUrl) opts.baseUrl = opts.baseUrl.replace(/\/+$/, "");
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

// ------------------------------------------------------------ the browser

function which(name) {
  try {
    return execSync(`command -v ${name}`, { stdio: ["ignore", "pipe", "ignore"], shell: "/bin/sh" }).toString().trim() || null;
  } catch {
    return null;
  }
}

function resolveExecutable(opts, pw) {
  if (opts.executable) {
    if (!fs.existsSync(opts.executable)) die(2, `--executable not found: ${opts.executable}`);
    return opts.executable;
  }
  if (opts.browser === "brave") {
    for (const c of BRAVE_CANDIDATES) {
      const p = which(c);
      if (p) return p;
    }
    die(2, `no Brave binary on PATH (looked for ${BRAVE_CANDIDATES.join(", ")}); pass --executable`);
  }
  const p = pw.chromium.executablePath();
  if (!fs.existsSync(p)) die(2, `Playwright is installed but its Chromium is not:\n    ${INSTALL_HINT}`);
  return p;
}

/**
 * A snap-confined browser cannot read hidden directories at the top of $HOME,
 * so ~/.cache is invisible to it; its profile has to live under ~/snap/<name>/common.
 */
function resolveProfile(opts, executable) {
  if (opts.profile) return path.resolve(opts.profile);
  if (executable.startsWith("/snap/")) {
    return path.join(os.homedir(), "snap", path.basename(executable), "common", "qa-ui-test", "profile");
  }
  return path.join(STATE_DIR, opts.browser === "brave" ? "profile-brave" : "profile");
}

async function alive(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function readBrowserFile() {
  try {
    return JSON.parse(fs.readFileSync(BROWSER_FILE, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Find the QA window or start it. Started detached, so it outlives this
 * process; recorded in browser.json so the next run finds the same port.
 */
async function ensureBrowser(opts, pw) {
  const known = readBrowserFile();
  const port = known?.port || opts.port;
  const version = await alive(port);
  if (version) {
    const info = known || { port, pid: null, browser: "unknown", executable: null, profile: null, startedAt: null };
    if (opts.browser && info.browser !== "unknown" && info.browser !== opts.browser) {
      console.error(`run-scenarios: the open QA window is ${info.browser}; --close it before switching to ${opts.browser}`);
    }
    info.version = version.Browser;
    return info;
  }

  const browser = opts.browser || "chromium";
  const executable = resolveExecutable({ ...opts, browser }, pw);
  const profile = resolveProfile({ ...opts, browser }, executable);
  fs.mkdirSync(profile, { recursive: true });
  // --no-sandbox is what Playwright itself passes (chromiumSandbox defaults to
  // false): distros that lock unprivileged user namespaces make Chromium exit
  // with "No usable sandbox!" otherwise, and the test profile holds nothing worth
  // the sandbox anyway.
  const args = [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${opts.port}`,
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    `--window-size=${opts.viewport.width},${opts.viewport.height + 120}`,
    opts.baseUrl,
  ];
  const child = spawn(executable, args, { detached: true, stdio: "ignore" });
  child.unref();

  const deadline = Date.now() + 15000;
  let v = null;
  while (!v && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    v = await alive(opts.port);
  }
  if (!v) die(2, `${executable} did not answer on port ${opts.port} within 15 s (profile: ${profile})`);

  const info = { port: opts.port, pid: child.pid, browser, executable, profile, startedAt: new Date().toISOString(), version: v.Browser };
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(BROWSER_FILE, JSON.stringify(info, null, 2) + "\n");
  console.log(`QA window started: ${v.Browser} on port ${opts.port}, profile ${profile}`);
  return { ...info, fresh: true };
}

async function connect(pw, info, opts) {
  const browser = await pw.chromium.connectOverCDP(`http://127.0.0.1:${info.port}`, { slowMo: opts.slowMo });
  const context = browser.contexts()[0] || (await browser.newContext());
  return { browser, context };
}

/** Quit the QA window through CDP; fall back to the recorded pid. */
async function closeBrowser(pw) {
  const info = readBrowserFile();
  const port = info?.port;
  if (port && (await alive(port))) {
    try {
      const b = await pw.chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      const s = await b.newBrowserCDPSession();
      await s.send("Browser.close").catch(() => {});
    } catch {
      if (info?.pid) try { process.kill(info.pid, "SIGTERM"); } catch { /* gone */ }
    }
    console.log("QA window closed.");
  } else {
    console.log("No QA window is open.");
  }
  fs.rmSync(BROWSER_FILE, { force: true });
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

function resolveUrl(u, opts) {
  return /^https?:\/\//.test(u) ? u : opts.baseUrl + (u.startsWith("/") ? u : "/" + u);
}

async function runStep(page, step, values, opts, sink) {
  const keys = Object.keys(step);
  const kind = keys.find((k) => k in STEP);
  if (!kind) throw new Error(`unknown step ${JSON.stringify(step)}`);
  return STEP[kind](page, step[kind], step, values, opts, sink);
}

const STEP = {
  async goto(page, url, _s, values, opts) {
    await page.goto(resolveUrl(fill(url, values), opts));
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

// ----------------------------------------------------------------- history

/**
 * Carry the previous results file forward. A scenario whose status or set of
 * assertions changed keeps the old entry under `history`; otherwise the old
 * history rides along untouched. Under --only, scenarios not in this run keep
 * their previous entry so the file stays the single record of the run.
 */
function mergeResults(results, opts) {
  let prev = null;
  try {
    prev = JSON.parse(fs.readFileSync(opts.results, "utf8"));
  } catch {
    return results;
  }
  const byN = new Map((prev.scenarios || []).map((r) => [r.n, r]));
  const descs = (r) => (r.expects || []).map((e) => e.desc).join(" ");
  for (const r of results) {
    const p = byN.get(r.n);
    if (!p) continue;
    const changed = p.status !== r.status || descs(p) !== descs(r);
    const older = p.history || [];
    r.history = changed
      ? [...older, { at: p.at || prev.startedAt || null, status: p.status, title: p.title, expects: p.expects, error: p.error }]
      : older;
    if (r.history.length === 0) delete r.history;
    byN.set(r.n, r);
  }
  if (!opts.only) return results;
  for (const r of results) byN.set(r.n, r);
  return [...byN.values()].sort((a, b) => a.n.localeCompare(b.n));
}

// -------------------------------------------------------------------- run

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pw = loadPlaywright();

  if (opts.close) {
    await closeBrowser(pw);
    return 0;
  }

  const annotateSrc = fs.readFileSync(path.join(HERE, "annotate.js"), "utf8");
  const info = await ensureBrowser(opts, pw);
  const { browser, context } = await connect(pw, info, opts);
  await context.addInitScript({ content: annotateSrc });

  if (opts.open) {
    // A freshly started window already shows the base URL in its first tab.
    const page = info.fresh && context.pages()[0] ? context.pages()[0] : await context.newPage();
    if (!info.fresh || opts.url) await page.goto(resolveUrl(opts.url || "/", opts)).catch((e) => console.error(`run-scenarios: ${e.message.split("\n")[0]}`));
    await page.waitForLoadState("networkidle").catch(() => {});
    console.log(`Tab open at: ${page.url()}`);
    console.log("If that is a login page, log in in the QA window; the session lives as long as the window does.");
    // Disconnect without closing the tab: the window is the user's to look at.
    process.exit(0);
  }

  if (opts.eval !== null) {
    const page = await context.newPage();
    page.setDefaultTimeout(opts.timeout);
    await page.goto(resolveUrl(opts.url || "/", opts));
    await page.waitForLoadState("networkidle").catch(() => {});
    let value;
    try {
      value = await page.evaluate(opts.eval);
    } finally {
      await page.close();
      await browser.close();
    }
    console.log(JSON.stringify(value === undefined ? null : value, null, 2));
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

  const page = await context.newPage();
  await page.setViewportSize(opts.viewport);
  page.setDefaultTimeout(opts.timeout);

  // Console and network noise, reset per scenario. A failed request explains an
  // empty list faster than another screenshot does.
  let noise = [];
  page.on("console", (m) => { if (m.type() === "error") noise.push(`console.error: ${m.text()}`); });
  page.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => noise.push(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText || ""}`));
  page.on("response", (r) => { if (r.status() >= 400) noise.push(`http ${r.status()}: ${r.request().method()} ${r.url()}`); });

  const startedAt = new Date().toISOString();
  const values = {};
  const results = [];
  let errored = 0;

  for (const sc of selected) {
    const n = String(sc.n).padStart(2, "0");
    const slug = sc.slug || "scenario";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) die(2, `scenario ${n}: slug "${slug}" must be lowercase letters, digits and dashes`);
    noise = [];
    const expects = [];
    const rec = { n, slug, title: sc.title, status: null, at: new Date().toISOString(), values: {}, expects, caption: null, screenshot: null, console: noise };
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

  // Close the tab, not the window: the session in it is what the next run needs.
  await page.close();
  await browser.close();

  const merged = mergeResults(results, opts);
  const summary = {
    driver: "playwright",
    browser: info.browser,
    browserVersion: info.version,
    executable: info.executable,
    profile: info.profile,
    baseUrl: opts.baseUrl,
    viewport: opts.viewport,
    startedAt,
    scenarios: merged,
  };
  fs.writeFileSync(opts.results, JSON.stringify(summary, null, 2) + "\n");
  const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
  const rewritten = results.filter((r) => r.history?.length).map((r) => r.n);
  console.log(`\n${results.length} scenario(s): ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")} → ${opts.results}, ${opts.out}/`);
  if (rewritten.length) console.log(`${rewritten.join(", ")} changed status or assertions since the previous results — say so in the report (see history in ${opts.results}).`);
  if (errored) console.log(`${errored} errored — fix the step and re-run with --only <n>. Their *.error.jpg files will fail check-evidence.js until replaced.`);
  return errored ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
