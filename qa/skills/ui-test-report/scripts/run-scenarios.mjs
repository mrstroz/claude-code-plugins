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
 *   node run-scenarios.mjs --base-url URL --eval JS [--url /path] [--steps '[…]']
 *                                                           read one value, no scenario file; --steps
 *                                                           runs scenario steps first (open a drawer…)
 *   node run-scenarios.mjs --base-url URL --inspect [--url /path] [--steps '[…]']
 *                                                           inventory of the page: controls, selects
 *                                                           with options, tables, open dialogs
 *   node run-scenarios.mjs --verdict 07=fail --reason "…"   record a QA verdict on a scenario that
 *                                                           errored, or overturn one, without re-running
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
 *   - the scenario file is validated before the first click. A scenario with no
 *     `expect` and no `manual`, a step of an unknown kind, a `${ref}` nothing
 *     reads: each is a broken file, reported all at once, not discovered on
 *     scenario 37 of 40
 *   - the verdict comes from the `expect` steps, not from reading a picture.
 *     A PASS in the results file means an assertion ran against the DOM and held
 *   - `given` checks run before the steps. When one fails the scenario is
 *     `blocked`, with the check and the value it saw, and no screenshot: a
 *     picture of a state the scenario never reached is not evidence
 *   - `requires` names the scenarios whose state this one builds on. A
 *     dependency that did not run to the end in this run — errored, blocked,
 *     absent — blocks the dependant instead of letting it run on the wrong
 *     state, and --only pulls dependencies in, so a re-run of 07 runs 03 first
 *     rather than trusting a PASS from an earlier run
 *   - the screenshot is written straight to NN-slug.jpg, so the number in the
 *     report row and the number on the file can never disagree
 *   - the caption overlay is injected as an init script, so it survives every
 *     reload and hard navigation, and is cleared before each scenario, so the
 *     previous card cannot intercept a click
 *   - an error in one scenario (a selector that no longer matches, a timeout)
 *     does not stop the run. It is recorded as status "error", its screenshot
 *     goes to NN-slug.error.jpg — a name check-evidence.js rejects on purpose —
 *     and the next scenario runs. A FAIL is a result; an error is a step that
 *     could not run, until somebody establishes why. --verdict records that
 *     diagnosis: the error stays in the data, the status becomes the QA result
 *   - a scenario whose steps or status differ from the previous results file
 *     keeps the earlier entry under `history`. Steps are compared by hash, so a
 *     changed comparator counts as a rewrite even when the description did not
 *     change, and a rewrite is expected to carry a `revision` saying why
 *
 * What it does not do: type credentials, install Playwright (it prints the
 * command), or post anything anywhere.
 *
 * Exit codes: 0 all scenarios ran (FAILs and blocked included), 1 at least one
 * scenario errored, 2 the environment or the file is not usable (no Playwright,
 * bad arguments, invalid scenarios, browser did not start).
 */
import crypto from "node:crypto";
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
    verdict: null,
    reason: null,
    steps: null,
    inspect: false,
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
      case "--verdict": {
        const m = next().match(/^(\d{2,3})=(fail|check|pass)$/);
        if (!m) die(2, "--verdict wants NN=fail|check|pass, e.g. --verdict 07=fail");
        opts.verdict = { n: m[1], status: m[2] };
        break;
      }
      case "--reason": opts.reason = next(); break;
      case "--inspect": opts.inspect = true; break;
      case "--steps": {
        try {
          opts.steps = JSON.parse(next());
        } catch (e) {
          die(2, `--steps wants a JSON array of scenario steps: ${e.message}`);
        }
        if (!Array.isArray(opts.steps)) die(2, "--steps wants a JSON array of scenario steps");
        break;
      }
      case "-h": case "--help": usage(); process.exit(0);
      default: die(2, `unknown argument: ${a}`);
    }
  }
  if (opts.browser && !["chromium", "brave"].includes(opts.browser)) die(2, "--browser must be chromium or brave");
  if (!Number.isInteger(opts.port) || opts.port <= 0) die(2, "--port must be a port number");
  if (!opts.close && !opts.verdict && !opts.baseUrl) die(2, "--base-url is required (e.g. http://localhost:3000)");
  if (opts.baseUrl) opts.baseUrl = opts.baseUrl.replace(/\/+$/, "");
  if (opts.inspect) {
    if (opts.eval !== null) die(2, "--inspect and --eval are two ways to read the page; pick one");
    opts.eval = fs.readFileSync(path.join(HERE, "inspect.js"), "utf8");
  }
  if (opts.steps && opts.eval === null) die(2, "--steps only makes sense with --eval or --inspect");
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

const REF_RE = /^\$\{([a-zA-Z0-9_]+)\}$/;

/** An expect operand: a ${ref} resolves to a stored value; anything else is literal. */
function operand(v, values) {
  if (typeof v === "string") {
    const m = v.match(REF_RE);
    if (m) {
      if (!(m[1] in values)) throw new Error(`\${${m[1]}} has not been read in this run — the scenario that reads it did not run; include it in --only`);
      return values[m[1]];
    }
  }
  return v;
}

// Arrays and objects compare by content, recursively — a list of ids read from
// the page against the list in the file is the assertion this runner exists
// for. Primitives compare by value with a string fallback, because the DOM
// hands back "11" where the file says 11. The fallback stops at structures:
// String(["a,b"]) === String(["a", "b"]), and two objects both print as
// [object Object].
function same(a, b) {
  if (a === b) return true;
  const obj = (v) => v !== null && typeof v === "object";
  if (obj(a) || obj(b)) {
    if (!obj(a) || !obj(b) || Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
  }
  return String(a) === String(b);
}

const COMPARATORS = {
  equals: same,
  notEquals: (a, b) => !same(a, b),
  matches: (a, b) => new RegExp(b).test(String(a)),
  contains: (a, b) => String(a).includes(String(b)),
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  truthy: (a) => !!a,
  falsy: (a) => !a,
};

const comparatorOf = (spec) => Object.keys(COMPARATORS).find((k) => k in spec);

/** Evaluate one check — an `expect` step or a `given` entry — against the page. */
async function check(page, spec, values) {
  const actual = spec.js !== undefined ? await page.evaluate(spec.js) : operand(`\${${spec.name}}`, values);
  const op = comparatorOf(spec);
  if (!op) throw new Error(`check without a comparator: ${JSON.stringify(spec)}`);
  const expected = operand(spec[op], values);
  const passed = COMPARATORS[op](actual, expected);
  const desc = spec.desc || `${spec.js || "${" + spec.name + "}"} ${op} ${JSON.stringify(spec[op])}`;
  return { desc, passed, actual, expected: op === "truthy" || op === "falsy" ? undefined : expected };
}

// ------------------------------------------------------------------ steps

function resolveUrl(u, opts) {
  return /^https?:\/\//.test(u) ? u : opts.baseUrl + (u.startsWith("/") ? u : "/" + u);
}

const stepKind = (step) => Object.keys(step).find((k) => k in STEP);

async function runStep(page, step, values, opts, sink) {
  const kind = stepKind(step);
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
  async expect(page, spec, _s, values, _opts, sink) {
    sink.push(await check(page, spec, values));
  },
};

// A drawer that closed 50 ms ago is still on screen mid-slide. Fast-forwarding
// CSS transitions at capture time is what makes "Apply closes the drawer" and
// the picture agree without every scenario carrying a 350 ms wait.
const SHOT = (file) => ({ path: file, type: "jpeg", quality: 85, animations: "disabled" });

// ------------------------------------------------------------- validation

/**
 * Every problem in the file at once, before anything is clicked. The rules
 * that matter: a scenario needs an `expect` or `manual: true`, because a PASS
 * nobody asserted is the row a reviewer cannot trust; a `${ref}` has to be read
 * by an earlier step or an earlier scenario, because the values map is shared
 * across the run in file order.
 */
function validateScenarios(list) {
  const problems = [];
  const seen = new Set();
  const reads = new Set();
  const refsOf = (spec) => {
    const refs = [];
    if (spec.name !== undefined) refs.push(spec.name);
    const op = comparatorOf(spec);
    const m = op && typeof spec[op] === "string" ? spec[op].match(REF_RE) : null;
    if (m) refs.push(m[1]);
    return refs;
  };
  const checkSpec = (where, kind, spec) => {
    if (!spec || typeof spec !== "object") return problems.push(`${where}: ${kind} must be an object`);
    if (!comparatorOf(spec)) problems.push(`${where}: ${kind} without a comparator: ${JSON.stringify(spec)}`);
    if (spec.js === undefined && spec.name === undefined) problems.push(`${where}: ${kind} needs js or name: ${JSON.stringify(spec)}`);
    for (const ref of refsOf(spec)) {
      if (!reads.has(ref)) problems.push(`${where}: ${kind} refers to \${${ref}} but no earlier read stores it`);
    }
  };
  list.forEach((sc, i) => {
    const n = String(sc.n ?? "").padStart(2, "0");
    const where = `scenario ${sc.n ?? "#" + (i + 1)}`;
    if (!/^\d{2,3}$/.test(n)) problems.push(`${where}: n must be a number like "01"`);
    else if (seen.has(n)) problems.push(`${where}: number ${n} is used twice`);
    // A dependency has to come earlier in the file, because that is the order
    // the run follows — which also rules out cycles without a graph walk.
    if (sc.requires !== undefined && !Array.isArray(sc.requires)) problems.push(`${where}: requires must be an array of scenario numbers`);
    for (const dep of Array.isArray(sc.requires) ? sc.requires : []) {
      const d = String(dep).padStart(2, "0");
      if (d === n) problems.push(`${where}: requires itself`);
      else if (!seen.has(d)) problems.push(`${where}: requires ${d}, which is not an earlier scenario in the file`);
    }
    seen.add(n);
    const slug = sc.slug || "scenario";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) problems.push(`${where}: slug "${slug}" must be lowercase letters, digits and dashes`);
    for (const spec of sc.given || []) checkSpec(where, "given", spec);
    let expects = 0;
    for (const step of sc.steps || []) {
      const kind = stepKind(step);
      if (!kind) { problems.push(`${where}: unknown step ${JSON.stringify(step)}`); continue; }
      if (kind === "read") {
        if (!step.read?.name || step.read.js === undefined) problems.push(`${where}: read needs name and js: ${JSON.stringify(step)}`);
        else reads.add(step.read.name);
      }
      if (kind === "expect") { expects++; checkSpec(where, "expect", step.expect); }
    }
    if (!sc.manual && expects === 0) problems.push(`${where}: no expect step and not manual — add an assertion, or set "manual": true if the tooling cannot verify it`);
  });
  return problems;
}

/** Steps, preconditions and the manual flag, hashed: the identity of what a scenario checks. */
function hashOf(sc) {
  const body = JSON.stringify({ given: sc.given || [], steps: sc.steps || [], manual: !!sc.manual });
  return crypto.createHash("sha1").update(body).digest("hex").slice(0, 12);
}

// --------------------------------------------------------------- selection

const numberOf = (sc) => String(sc.n).padStart(2, "0");
const requiresOf = (sc) => (sc.requires || []).map((d) => String(d).padStart(2, "0"));

/**
 * Which scenarios run, in file order. --only names some; each of those pulls
 * in what it requires, transitively, because a dependency's PASS from an
 * earlier run says nothing about the state of the app now.
 */
function select(list, opts) {
  if (!opts.only) return list;
  const byN = new Map(list.map((sc) => [numberOf(sc), sc]));
  const wanted = new Set(opts.only.map((n) => n.padStart(2, "0")));
  const missing = [...wanted].filter((n) => !byN.has(n));
  if (missing.length) die(2, `--only ${missing.join(",")}: no such scenario in the file`);
  const pulled = [];
  const add = (n, forWhom) => {
    for (const dep of requiresOf(byN.get(n))) {
      if (!wanted.has(dep)) { wanted.add(dep); pulled.push(`${dep} for ${forWhom}`); }
      add(dep, forWhom);
    }
  };
  for (const n of [...wanted]) add(n, n);
  if (pulled.length) console.log(`running ${pulled.sort().join(", ")} (requires)`);
  return list.filter((sc) => wanted.has(numberOf(sc)));
}

// ----------------------------------------------------------------- caption

async function caption(page, annotateSrc, o) {
  const ready = await page.evaluate(() => typeof window.__ann === "function").catch(() => false);
  if (!ready) await page.addScriptTag({ content: annotateSrc });
  return page.evaluate((opts) => window.__ann(opts), o);
}

// ------------------------------------------------------------------ errors

/**
 * The whole error message, minus what differs between two runs of the same
 * failure: Playwright's retry counters and wait intervals. The first line alone
 * ("locator.click: Timeout 3000ms exceeded.") is the same for a button that is
 * missing and one that is disabled; the call log below it is where they differ.
 */
function errorDetail(message) {
  const seen = new Set();
  const out = [];
  for (const raw of String(message).replace(/\x1b\[[0-9;]*m/g, "").split("\n")) {
    // "4 × waiting for element to be visible" counts attempts; the count grows with the timeout.
    const line = raw.trimEnd().replace(/\b\d+ × /, "× ");
    if (!line.trim() || /^\s*-?\s*(retrying .*action|waiting \d+ms)\s*$/.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out.join("\n");
}

/** Same failure: same detail once the configured timeout is masked out. */
const sameError = (a, b) => !!a && !!b && a.replace(/\d+ms/g, "Nms") === b.replace(/\d+ms/g, "Nms");

// ----------------------------------------------------------------- history

function readResults(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** What an earlier entry keeps when it moves into `history`. */
function snapshot(p) {
  return {
    at: p.at || null, status: p.status, completed: p.completed, title: p.title, expects: p.expects,
    error: p.error, errorDetail: p.errorDetail, failedStep: p.failedStep, stepsHash: p.stepsHash,
    revision: p.revision, revisionHash: p.revisionHash, diagnosis: p.diagnosis,
  };
}

/**
 * Carry the previous results file forward. A scenario whose status or steps
 * changed keeps the old entry under `history`; otherwise the old history rides
 * along untouched. Under --only, scenarios not in this run keep their previous
 * entry so the file stays the single record of the run.
 */
function mergeResults(results, prev, opts) {
  if (!prev) return results;
  const byN = new Map((prev.scenarios || []).map((r) => [r.n, r]));
  const descs = (r) => (r.expects || []).map((e) => e.desc).join(" ");
  for (const r of results) {
    const p = byN.get(r.n);
    if (!p) continue;
    // Results written before stepsHash existed fall back to comparing assertion texts.
    const rewritten = p.stepsHash ? p.stepsHash !== r.stepsHash : descs(p) !== descs(r);
    const older = p.history || [];
    r.history = p.status !== r.status || rewritten ? [...older, snapshot(p)] : older;
    if (r.history.length === 0) delete r.history;
    byN.set(r.n, r);
  }
  if (!opts.only) return results;
  for (const r of results) byN.set(r.n, r);
  return [...byN.values()].sort((a, b) => a.n.localeCompare(b.n));
}

/**
 * Rewritten since an earlier run — the steps hash changed — and the file has no
 * revision written for this version of the steps. A revision is tied to the
 * hash it first appeared with, so the sentence that explained A → B does not
 * also cover B → C.
 */
const unexplainedRewrite = (r) =>
  (r.history || []).some((h) => h.stepsHash && h.stepsHash !== r.stepsHash) && (!r.revision || r.revisionHash !== r.stepsHash);

// ----------------------------------------------------------------- verdict

/**
 * A verdict is the QA judgement on a scenario the runner could not judge: a
 * step that errored because the element the criterion needs is not there (a
 * FAIL, with the error as evidence), or a picture that shows something the
 * assertions did not cover. The entry as it was goes to history, the reason is
 * kept next to the new status, and an error screenshot is renamed so the
 * evidence check accepts it as the picture behind a result.
 */
function applyVerdict(opts) {
  if (!opts.reason) die(2, "--verdict needs --reason: the diagnosis is what makes this a QA result rather than an edit");
  const doc = readResults(opts.results);
  if (!doc) die(2, `results file not found or unreadable: ${opts.results}`);
  const rec = (doc.scenarios || []).find((r) => r.n === opts.verdict.n);
  if (!rec) die(2, `no scenario ${opts.verdict.n} in ${opts.results}`);
  if (rec.status === "blocked") die(2, `${rec.n} is blocked (${rec.reason}); it did not run, so there is nothing to judge — fix the precondition and re-run it with --only ${rec.n}`);
  if (opts.verdict.status === "pass" && !(rec.completed === true && (rec.expects || []).length > 0 && rec.expects.every((e) => e.passed))) {
    die(2, `${rec.n} cannot be passed by verdict: a PASS is a completed run whose assertions held. Fix the scenario and re-run it with --only ${rec.n}`);
  }
  // The badge drawn on the picture is the status at capture time; a verdict
  // changes the row, not the picture, and the report has to say which wins.
  if (rec.pictureSays === undefined && rec.caption !== null && rec.completed === true) {
    rec.pictureSays = { pass: "PASS", fail: "FAIL", check: "CHECK" }[rec.status] || null;
  }
  rec.history = [...(rec.history || []), snapshot(rec)];
  if (rec.screenshot && /\.error\.jpg$/.test(rec.screenshot)) {
    const evidence = rec.screenshot.replace(/\.error\.jpg$/, ".jpg");
    if (fs.existsSync(rec.screenshot)) fs.renameSync(rec.screenshot, evidence);
    else console.error(`run-scenarios: ${rec.screenshot} is not here — run --verdict from the directory the run was made in`);
    rec.screenshot = evidence;
  }
  const from = rec.status;
  rec.status = opts.verdict.status;
  rec.diagnosis = opts.reason;
  rec.diagnosedAt = new Date().toISOString();
  delete rec.diagnosisCarried;
  fs.writeFileSync(opts.results, JSON.stringify(doc, null, 2) + "\n");
  console.log(`${rec.n} ${from} → ${rec.status}: ${opts.reason}`);
  if (rec.error) console.log(`      the execution error stays on the entry as evidence: ${rec.error}`);
  const word = { pass: "PASS", fail: "FAIL", check: "CHECK" }[rec.status];
  if (rec.pictureSays && rec.pictureSays !== word) console.log(`      the caption on ${rec.screenshot} still reads ${rec.pictureSays}; the finding has to say the verdict supersedes it`);
}

// -------------------------------------------------------------------- run

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.verdict) {
    applyVerdict(opts);
    return 0;
  }

  const pw = loadPlaywright();

  if (opts.close) {
    await closeBrowser(pw);
    return 0;
  }

  const annotateSrc = fs.readFileSync(path.join(HERE, "annotate.js"), "utf8");

  let list = null;
  let selected = null;
  if (!opts.open && opts.eval === null) {
    // Validate before touching the browser: a broken file should not cost a tab.
    const file = path.resolve(opts.scenarios);
    if (!fs.existsSync(file)) die(2, `scenarios file not found: ${file}`);
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    list = Array.isArray(doc) ? doc : doc.scenarios;
    if (!Array.isArray(list) || list.length === 0) die(2, "no scenarios in the file (expected an array or { scenarios: [...] })");
    const problems = validateScenarios(list);
    if (problems.length) die(2, `${path.basename(file)} is not runnable:\n  - ${problems.join("\n  - ")}`);
    selected = select(list, opts);
  }

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
      // Steps first, so the page can be read in the state a scenario will find
      // it in — inside the drawer, after the dialog opened — not only at a URL.
      for (const step of opts.steps || []) await runStep(page, step, {}, opts, []);
      value = await page.evaluate(opts.eval);
    } finally {
      await page.close();
      await browser.close();
    }
    console.log(JSON.stringify(value === undefined ? null : value, null, 2));
    return 0;
  }

  fs.mkdirSync(opts.out, { recursive: true });
  const prev = readResults(opts.results);
  const prevByN = new Map((prev?.scenarios || []).map((r) => [r.n, r]));

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
  const statusOf = new Map(); // this run only: a dependency is satisfied by what happened now, not last time
  let errored = 0;

  for (const sc of selected) {
    const n = String(sc.n).padStart(2, "0");
    const slug = sc.slug || "scenario";
    noise = [];
    const expects = [];
    const rec = { n, slug, title: sc.title, status: null, completed: false, at: new Date().toISOString(), stepsHash: hashOf(sc), values: {}, expects, caption: null, screenshot: null, console: noise };
    const p = prevByN.get(n);
    if (sc.revision) {
      rec.revision = sc.revision;
      // The same sentence as last time keeps the hash it was first written for;
      // a new sentence belongs to the steps as they are now.
      rec.revisionHash = p?.revision === sc.revision ? p.revisionHash || p.stepsHash : rec.stepsHash;
    }
    let stepAt = -1;
    const shot = path.join(opts.out, `${n}-${slug}.jpg`);
    const errShot = path.join(opts.out, `${n}-${slug}.error.jpg`);
    const started = Date.now();
    // The previous scenario's caption card is a fixed element with the highest
    // z-index on the page; left there, it intercepts any click under it.
    await page.evaluate(() => window.__annClear?.()).catch(() => {});
    try {
      // A dependency counts when its steps ran to the end, whatever the
      // verdict. Error, blocked or not run — and an error somebody has since
      // judged a FAIL is still an error in execution — means the state it
      // builds was never reached, and running on top of that produces findings
      // about nothing.
      const unfinished = requiresOf(sc).find((d) => statusOf.get(d)?.completed !== true);
      const given = [];
      if (!unfinished) for (const spec of sc.given || []) given.push(await check(page, spec, values));
      if (given.length) rec.given = given;
      const unmet = given.filter((g) => !g.passed);
      if (unfinished) {
        const dep = statusOf.get(unfinished);
        rec.status = "blocked";
        rec.blockedBy = unfinished;
        rec.reason = dep ? `${unfinished} ${dep.status}: ${dep.error || dep.reason || ""}`.trim() : `${unfinished} did not run`;
      } else if (unmet.length) {
        rec.status = "blocked";
        rec.blockedBy = "given";
        rec.reason = unmet.map((g) => `${g.desc} (actual ${JSON.stringify(g.actual)})`).join("; ");
      } else {
        const steps = sc.steps || [];
        for (stepAt = 0; stepAt < steps.length; stepAt++) {
          await runStep(page, steps[stepAt], values, opts, expects);
        }
        rec.completed = true;
        const ok = sc.manual ? null : expects.every((e) => e.passed);
        rec.status = ok === null ? "check" : ok ? "pass" : "fail";
        const cap = sc.caption || {};
        rec.caption = fill(cap.d || "", values);
        await caption(page, annotateSrc, {
          n, t: cap.t || sc.title || "", d: rec.caption, ok,
          hl: cap.hl || [], pins: cap.pins || [], top: !!cap.top,
        });
        rec.screenshot = shot;
        await page.screenshot(SHOT(shot));
      }
    } catch (e) {
      rec.status = "error";
      rec.error = String(e.message).split("\n")[0];
      rec.errorDetail = errorDetail(e.message);
      if (stepAt >= 0 && stepAt < (sc.steps || []).length) rec.failedStep = { index: stepAt, step: sc.steps[stepAt] };
      // The same execution error a person already diagnosed — same steps, same
      // step, same full message — keeps its verdict. Any of the three differing
      // is a new error that needs its own look.
      const sameFailure = p?.diagnosis && p.completed === false && p.stepsHash === rec.stepsHash && sameError(p.errorDetail, rec.errorDetail) && (p.failedStep?.index ?? -1) === (rec.failedStep?.index ?? -1);
      if (sameFailure) {
        rec.status = p.status;
        rec.diagnosis = p.diagnosis;
        rec.diagnosedAt = p.diagnosedAt;
        rec.diagnosisCarried = true;
        rec.screenshot = shot;
      } else {
        errored++;
        rec.screenshot = errShot;
      }
      await page.screenshot(SHOT(rec.screenshot)).catch(() => { rec.screenshot = null; });
    }
    rec.values = Object.fromEntries((sc.steps || []).filter((s) => s.read).map((s) => [s.read.name, values[s.read.name]]));
    rec.ms = Date.now() - started;
    results.push(rec);
    statusOf.set(n, rec);
    // A picture from an earlier run is not evidence of this one: whichever of
    // the two names this scenario did not write now, remove.
    if (rec.screenshot !== shot) fs.rmSync(shot, { force: true });
    if (rec.screenshot !== errShot) fs.rmSync(errShot, { force: true });
    const tag = { pass: "PASS ", fail: "FAIL ", check: "CHECK", error: "ERROR", blocked: "BLOCK" }[rec.status];
    const extra = rec.error ? ` — ${rec.error}`
      : rec.status === "blocked" ? ` — ${rec.blockedBy === "given" ? "precondition" : "requires"}: ${rec.reason}`
      : rec.status === "fail" ? ` — ${expects.filter((e) => !e.passed).map((e) => `${e.desc} (actual ${JSON.stringify(e.actual)})`).join("; ")}`
      : "";
    console.log(`${tag} ${n} ${sc.title || slug}${extra}`);
    if (rec.diagnosisCarried) console.log(`      ↳ same error as the diagnosed run; verdict ${rec.status} kept: ${rec.diagnosis}`);
  }

  // Close the tab, not the window: the session in it is what the next run needs.
  await page.close();
  await browser.close();

  const merged = mergeResults(results, prev, opts);
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
  const unexplained = results.filter(unexplainedRewrite).map((r) => r.n);
  const blocked = results.filter((r) => r.status === "blocked");
  console.log(`\n${results.length} scenario(s): ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")} → ${opts.results}, ${opts.out}/`);
  if (rewritten.length) console.log(`${rewritten.join(", ")} changed status or steps since the previous results — say so in the report (see history in ${opts.results}).`);
  if (unexplained.length) console.log(`${unexplained.join(", ")} rewritten since an earlier run with no "revision" for this version of the steps — add one saying what the earlier check got wrong (a second rewrite needs its own sentence), or check-evidence.js will refuse the report.`);
  if (blocked.length) console.log(`${blocked.map((r) => r.n).join(", ")} blocked — a precondition did not hold or a required scenario did not finish. Not a result and not an error: fix the state or the dependency, then re-run with --only <n> (dependencies are pulled in).`);
  if (errored) console.log(`${errored} errored — establish why before touching the step: --eval whether the element exists, the console entries in the results, the code. A missing element the criterion requires is a FAIL (--verdict NN=fail --reason "…"); a wrong step is fixed with a "revision" and re-run with --only <n>.`);
  return errored ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
