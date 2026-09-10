#!/usr/bin/env node
/*
 * Run a scenarios.json file in the QA browser window. The task directory
 * (docs/qa/<TASK>/) holds scenarios.json, results.json — the latest run's
 * metadata under `run` and one entry per scenario, each saying which run
 * executed it — screenshots/ with one picture per scenario, and records.json
 * only while test data is still in the database.
 *
 *   cd docs/qa/<TASK>
 *   node run-scenarios.mjs --base-url http://localhost:3000 [--scenarios scenarios.json] \
 *     [--only 07,08] [--fast | --slow-mo MS] [--keep-data] [--viewport 1440x900] [--timeout MS] \
 *     [--browser chromium|brave] [--executable PATH] [--profile DIR] [--port 9333] \
 *     [--task-dir DIR] [--config qa.config.json]
 *
 *   --open                     open the QA window (or a tab in it) and print where it landed
 *   --eval JS [--url /p] [--steps '[…]']     read one value; --steps runs scenario steps first
 *   --inspect [--url /p] [--steps '[…]']     inventory of the page: controls, selects, tables, dialogs
 *   --verdict 07=fail --reason "…"   record a QA judgement without re-running
 *   --new-run [--driver chrome]  start a run driven by hand (Chrome extension): results.json gets the run
 *   --prepare [--setups a,b]     run setups into the ledger for the current run, no browser needed
 *   --cleanup                    remove everything records.json still lists, from any run
 *   --finish                     close a hand-driven run: check the entries written into results.json
 *   --db-discover                propose a db block for qa.config.json from docker-compose / docker ps
 *   --db-check                   connect, describe, and run the configured probe against the app
 *   --db "SELECT …" [--params '[…]']          one read-only query, rows as JSON
 *   --close                      quit the QA window
 *
 * The browser is a long-lived process the runner attaches to over CDP; the
 * first run starts it detached on a profile of its own, and every run after
 * opens a tab and closes only the tab. The user logs in once, in the window.
 *
 * Exit codes: 0 all scenarios ran (FAILs and blocked included), 1 at least one
 * scenario errored, 2 the environment or the file is not usable, 130 the run
 * was interrupted (its record says so).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { fillDeep, getPath } from "./lib/compare.mjs";
import { validateScenarios, selectScenarios, numberOf, hashOf } from "./lib/validate.mjs";
import {
  INDEX_FILE, LEDGER_FILE, SHOTS_DIR, readJson, writeJsonAtomic, gitBuildInfo,
  startRun, patchRun, loadIndex, updateIndex, diffAgainst, runnerVersion,
} from "./lib/runs.mjs";
import { loadConfig, openDb, discoverDb, CONFIG_FILE } from "./lib/db.mjs";
import { Ledger, prepareSetup, cleanupRun } from "./lib/fixtures.mjs";
import { executeScenarios, runStep, resolveUrl, awaitReady } from "./lib/engine.mjs";

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
    scenarios: "scenarios.json", baseUrl: null, browser: null, executable: null, profile: null, port: 9333,
    slowMo: 250, only: null, viewport: { width: 1440, height: 900 }, timeout: 10000, keepData: false,
    taskDir: process.cwd(), config: null, driver: "playwright",
    open: false, close: false, eval: null, url: null, verdict: null, reason: null, steps: null, inspect: false,
    newRun: false, prepare: false, cleanup: false, finish: false, setups: null,
    dbDiscover: false, dbCheck: false, db: null, params: [],
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
      case "--slow-mo": opts.slowMo = Number(next()); break;
      case "--fast": opts.slowMo = 0; break;
      case "--only": opts.only = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--timeout": opts.timeout = Number(next()); break;
      case "--keep-data": opts.keepData = true; break;
      case "--task-dir": opts.taskDir = path.resolve(next()); break;
      case "--config": opts.config = next(); break;
      case "--driver": opts.driver = next(); break;
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
      case "--new-run": opts.newRun = true; break;
      case "--prepare": opts.prepare = true; break;
      case "--cleanup": opts.cleanup = true; break;
      case "--finish": opts.finish = true; break;
      case "--setups": opts.setups = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--db-discover": opts.dbDiscover = true; break;
      case "--db-check": opts.dbCheck = true; break;
      case "--db": opts.db = next(); break;
      case "--params": {
        try { opts.params = JSON.parse(next()); } catch (e) { die(2, `--params wants a JSON array: ${e.message}`); }
        if (!Array.isArray(opts.params)) die(2, "--params wants a JSON array");
        break;
      }
      case "--steps": {
        try { opts.steps = JSON.parse(next()); } catch (e) { die(2, `--steps wants a JSON array of scenario steps: ${e.message}`); }
        if (!Array.isArray(opts.steps)) die(2, "--steps wants a JSON array of scenario steps");
        break;
      }
      case "-h": case "--help": usage(); process.exit(0);
      default: die(2, `unknown argument: ${a}`);
    }
  }
  if (opts.browser && !["chromium", "brave"].includes(opts.browser)) die(2, "--browser must be chromium or brave");
  if (!["playwright", "chrome"].includes(opts.driver)) die(2, "--driver must be playwright or chrome");
  if (!Number.isInteger(opts.port) || opts.port <= 0) die(2, "--port must be a port number");
  const offline = opts.close || opts.verdict || opts.newRun || opts.prepare || opts.cleanup || opts.finish || opts.dbDiscover || opts.db !== null;
  if (!offline && !opts.baseUrl) die(2, "--base-url is required (e.g. http://localhost:3000)");
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
    const root = execFileSync("npm", ["root", "-g"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return createRequire(path.join(root, "noop.js"))("playwright");
  } catch {
    /* fall through */
  }
  die(2, `the playwright package is not installed anywhere this script looks.\n  Install it once with:\n    ${INSTALL_HINT}`);
}

// ------------------------------------------------------------ the browser

function which(name) {
  try {
    return execFileSync("/bin/sh", ["-c", `command -v ${name}`], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
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

// ------------------------------------------------------------- the file

function loadScenarios(opts) {
  const file = path.resolve(opts.taskDir, opts.scenarios);
  if (!fs.existsSync(file)) die(2, `scenarios file not found: ${file}`);
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    die(2, `${file}: not valid JSON (${e.message})`);
  }
  return { file, doc: Array.isArray(doc) ? { scenarios: doc } : doc };
}

function dbConfigFor(opts, doc) {
  let cfg;
  try {
    cfg = loadConfig(opts.taskDir, opts.config);
  } catch (e) {
    die(2, e.message);
  }
  const withDB = doc?.withDB === true;
  if (withDB && !cfg.config.db) die(2, `the scenario file says "withDB": true but no ${CONFIG_FILE} with a db block was found next to ${opts.taskDir} or in docs/qa/ — run --db-discover for a skeleton`);
  return { ...cfg, withDB };
}

async function openDbFor(opts, doc, { writes = false } = {}) {
  const { config, withDB, file } = dbConfigFor(opts, doc);
  if (!withDB && !opts.db && !opts.dbCheck) return { db: null, config, file };
  if (!config.db) die(2, `no db block in ${CONFIG_FILE} — run --db-discover`);
  try {
    const db = await openDb(config.db, { cwd: path.dirname(file), writes });
    await db.query("SELECT 1 AS ok");
    return { db, config, file };
  } catch (e) {
    die(2, `database not available: ${e.message}\n  The run needs it (withDB): fix the connection or ask the user whether to run UI only — not both, and not silently.`);
  }
}

// ----------------------------------------------------------------- verdict

function applyVerdict(opts) {
  if (!opts.reason) die(2, "--verdict needs --reason: the diagnosis is what makes this a QA result rather than an edit");
  const index = loadIndex(opts.taskDir);
  const rec = index.scenarios.find((r) => r.n === opts.verdict.n);
  if (!rec) die(2, `no scenario ${opts.verdict.n} in ${INDEX_FILE}`);
  if (rec.status === "blocked") die(2, `${rec.n} is blocked (${rec.reason}); it did not run, so there is nothing to judge — fix the precondition and re-run it with --only ${rec.n}`);
  if (opts.verdict.status === "pass" && !(rec.completed === true && (rec.expects || []).length > 0 && rec.expects.every((e) => e.passed))) {
    die(2, `${rec.n} cannot be passed by verdict: a PASS is a completed run whose assertions held. Fix the scenario and re-run it with --only ${rec.n}`);
  }
  if (rec.pictureSays === undefined && rec.caption !== null && rec.completed === true) {
    rec.pictureSays = { pass: "PASS", fail: "FAIL", check: "CHECK" }[rec.status] || null;
  }
  if (rec.screenshot && /\.error\.jpg$/.test(rec.screenshot)) {
    const evidence = rec.screenshot.replace(/\.error\.jpg$/, ".jpg");
    const abs = path.join(opts.taskDir, rec.screenshot);
    if (fs.existsSync(abs)) fs.renameSync(abs, path.join(opts.taskDir, evidence));
    else console.error(`run-scenarios: ${rec.screenshot} is not here — run --verdict from the task directory`);
    rec.screenshot = evidence;
  }
  const from = rec.status;
  rec.status = opts.verdict.status;
  rec.diagnosis = opts.reason;
  rec.diagnosedAt = new Date().toISOString();
  delete rec.diagnosisCarried;
  delete index.migratedFrom;
  writeJsonAtomic(path.join(opts.taskDir, INDEX_FILE), index);
  console.log(`${rec.n} ${from} → ${rec.status} (run ${rec.runId || index.runId}): ${opts.reason}`);
  if (rec.error) console.log(`      the execution error stays on the entry as evidence: ${rec.error}`);
  const word = { pass: "PASS", fail: "FAIL", check: "CHECK" }[rec.status];
  if (rec.pictureSays && rec.pictureSays !== word) console.log(`      the caption on ${rec.screenshot} still reads ${rec.pictureSays}; the finding has to say the verdict supersedes it`);
}

// --------------------------------------------------------- run bookkeeping

function runMeta(opts, doc, extra = {}) {
  const build = gitBuildInfo(opts.taskDir);
  return {
    driver: opts.driver,
    scope: opts.only ? { only: opts.only.map((n) => n.padStart(2, "0")) } : "all",
    baseUrl: opts.baseUrl,
    viewport: opts.viewport,
    slowMo: opts.slowMo,
    runnerVersion: runnerVersion(),
    scenariosHash: crypto.createHash("sha1").update(JSON.stringify(doc)).digest("hex").slice(0, 12),
    fixturesVersion: doc.setups?.version ?? null,
    withDB: doc.withDB === true,
    build,
    ...extra,
  };
}

function fixturesCtx(opts, run, doc, db, context) {
  const ledger = new Ledger(path.join(opts.taskDir, LEDGER_FILE), run.runId);
  const values = { runId: run.runId };
  const ctx = {
    runId: run.runId, baseUrl: opts.baseUrl, values, db, ledger, cwd: opts.taskDir,
    cookieHeader: context ? async (url) => (await context.cookies(url)).map((c) => `${c.name}=${c.value}`).join("; ") : null,
  };
  return { ledger, values, ctx };
}


/**
 * A cleanup or setup step with "session": "browser" needs the QA window's
 * cookies. Attach to the window when it is open; a window started now would
 * have no session, so a missing one is an error with the way out.
 */
async function browserSessionFor(opts, needed) {
  if (!needed) return { context: null, close: async () => {} };
  const known = readBrowserFile();
  const port = known?.port || opts.port;
  const version = await alive(port);
  if (!version) die(2, `a step with "session": "browser" needs the QA window and none is open — start it with --open, log in, then run this command again`);
  const pw = loadPlaywright();
  const info = { ...(known || { port }), version: version.Browser };
  const { browser, context } = await connect(pw, info, { ...opts, slowMo: 0 });
  return { context, close: () => browser.close().catch(() => {}) };
}

const wantsBrowserSession = (...parts) => JSON.stringify(parts).includes('"session":"browser"');

/** --new-run: start a hand-driven (Chrome extension) run in the index. */
function newRun(opts) {
  const { doc } = loadScenarios(opts);
  const problems = validateScenarios(doc, { only: opts.only, dbWrites: !!dbConfigFor(opts, doc).config.db?.writes });
  if (problems.length) die(2, `${opts.scenarios} is not runnable:\n  - ${problems.join("\n  - ")}`);
  const run = startRun(opts.taskDir, runMeta(opts, doc, { note: `driven by hand through the ${opts.driver} driver; the entries under "scenarios" are written by whoever drives it, then --finish checks them and closes the run` }));
  patchRun(opts.taskDir, { status: "manual" });
  console.log(run.runId);
  console.log(`run ${run.runId} started in ${INDEX_FILE} — screenshots go to ${SHOTS_DIR}/NN-slug.jpg, one entry per scenario under "scenarios"; then --finish`);
  if (run.migratedFrom === "0.7.0") console.log(`${INDEX_FILE} was a 0.7.0 index; runs/ is no longer read — delete it`);
}

/** The run results.json says is current; --prepare and --finish work on it. */
function currentRun(opts, what) {
  const index = loadIndex(opts.taskDir);
  if (!index.run) die(2, `${what} needs a run in ${INDEX_FILE} — start one with --new-run (Chrome driver) or run the scenarios`);
  return { index, run: { runId: index.runId, dir: opts.taskDir } };
}

/** --prepare: run setups into the ledger for the current run, without a browser. */
async function prepareOnly(opts) {
  const { doc } = loadScenarios(opts);
  const { db } = await openDbFor(opts, doc, { writes: true });
  const setups = doc.setups || {};
  const names = opts.setups || Object.keys(setups).filter((k) => k !== "version");
  for (const n of names) if (!setups[n]) die(2, `no setup "${n}" in ${opts.scenarios}`);
  const { index, run } = currentRun(opts, "--prepare");
  opts.baseUrl = opts.baseUrl || index.run.baseUrl || null;
  if (opts.baseUrl && index.run.baseUrl !== opts.baseUrl) patchRun(opts.taskDir, { baseUrl: opts.baseUrl });
  const session = await browserSessionFor(opts, wantsBrowserSession(names.map((n) => setups[n])));
  const { ledger, ctx } = fixturesCtx(opts, run, doc, db, session.context);
  let failed = 0;
  for (const n of names) {
    if (ledger.preparedNames().includes(n)) { console.log(`setup ${n} already prepared in ${run.runId}`); continue; }
    try {
      await prepareSetup(n, setups[n], ctx);
      ledger.markPrepared(n);
      console.log(`setup ${n} prepared (${ledger.records.length} record(s) in the ledger)`);
    } catch (e) {
      failed++;
      console.error(`setup ${n} FAILED — ${e.message}`);
    }
  }
  db?.close();
  await session.close();
  console.log(`ledger: ${path.relative(process.cwd(), ledger.file)}; clean up with --cleanup`);
  return failed ? 1 : 0;
}

/** --cleanup: remove everything records.json still lists, whichever run made it. */
async function cleanupOnly(opts) {
  const file = path.join(opts.taskDir, LEDGER_FILE);
  const previous = readJson(file);
  if (!previous || !(previous.records?.length || previous.prepared?.length)) {
    console.log(`nothing to clean — no ${LEDGER_FILE} with records in ${opts.taskDir}`);
    if (previous) new Ledger(file, "cleanup").compact();
    return 0;
  }
  const doc = loadScenarios(opts).doc;
  const index = loadIndex(opts.taskDir);
  // The run remembers where the app was; http cleanup steps need it.
  opts.baseUrl = opts.baseUrl || index.run?.baseUrl || null;
  const { db } = await openDbFor(opts, doc, { writes: true });
  const setups = doc.setups || {};
  const session = await browserSessionFor(opts, wantsBrowserSession(previous.records?.map((r) => r.cleanup), (previous.prepared || []).map((p) => setups[typeof p === "string" ? p : p.name]?.cleanup)));
  const run = { runId: index.runId || "cleanup", dir: opts.taskDir };
  const { ledger, ctx } = fixturesCtx(opts, run, doc, db, session.context);
  const c = await cleanupRun(ctx, { setups, all: true });
  const left = ledger.compact();
  db?.close();
  await session.close();
  if (index.run) patchRun(opts.taskDir, { data: { ...(index.run.data || {}), cleaned: (index.run.data?.cleaned || 0) + c.cleaned, skipped: c.skipped, kept: false, failures: c.failures, cleanedAt: new Date().toISOString() } });
  console.log(`${c.cleaned} record(s) removed, ${c.skipped} without a cleanup step, ${c.failures.length} failure(s)${left ? ` — ${LEDGER_FILE} still lists what is left` : ` — ${LEDGER_FILE} removed`}`);
  for (const f of c.failures) console.error(`  - ${f.kind || f.setup} ${f.id ?? ""}: ${f.error}`);
  return c.failures.length ? 1 : 0;
}

/** --finish: check the entries a hand-driven run wrote into results.json and close the run. */
async function finishRun(opts) {
  const { index, run } = currentRun(opts, "--finish");
  const { doc } = loadScenarios(opts);
  const setups = doc.setups || {};
  const byN = new Map((doc.scenarios || []).map((sc) => [numberOf(sc), sc]));
  const problems = [];
  const mine = index.scenarios.filter((r) => r.runId === run.runId);
  if (!mine.length) problems.push(`no entry under "scenarios" carries runId ${run.runId} — write one per scenario ({ "n", "slug", "title", "status", "completed", "expects", "screenshot", "runId" })`);
  const entries = mine.map((r) => {
    const n = String(r.n ?? "").padStart(2, "0");
    const sc = byN.get(n);
    if (!sc) problems.push(`entry ${n}: not in ${opts.scenarios}`);
    if (!["pass", "fail", "check", "blocked", "error"].includes(r.status)) problems.push(`entry ${n}: status "${r.status}" is not pass|fail|check|blocked|error`);
    if (r.status === "pass" && !(Array.isArray(r.expects) && r.expects.length && r.expects.every((e) => e.passed))) problems.push(`entry ${n}: a PASS needs expects that passed — what was asserted and what value it saw`);
    if (["pass", "fail", "check"].includes(r.status)) {
      if (!r.screenshot) problems.push(`entry ${n}: no screenshot`);
      else if (!fs.existsSync(path.join(opts.taskDir, r.screenshot))) problems.push(`entry ${n}: screenshot ${r.screenshot} not found`);
    }
    if (r.status === "blocked" && !r.reason) problems.push(`entry ${n}: blocked without a reason`);
    return { completed: ["pass", "fail", "check"].includes(r.status), at: index.run.startedAt || new Date().toISOString(), ...r, n, stepsHash: sc ? hashOf(sc, setups) : undefined, hashVersion: 2, driver: "chrome" };
  });
  if (problems.length) die(2, `${INDEX_FILE} is not complete:\n  - ${problems.join("\n  - ")}`);
  updateIndex(opts.taskDir, run.runId, entries);
  // The hand-driven run's data: cleanup as the Playwright loop would.
  const ledger = new Ledger(path.join(opts.taskDir, LEDGER_FILE), run.runId);
  let data = { records: ledger.records.filter((r) => r.runId === run.runId).length, cleaned: 0, skipped: 0, kept: opts.keepData, failures: [] };
  if (data.records && !opts.keepData) {
    const { db } = await openDbFor(opts, doc, { writes: true });
    opts.baseUrl = opts.baseUrl || index.run.baseUrl || null;
    const session = await browserSessionFor(opts, wantsBrowserSession(ledger.records.map((r) => r.cleanup)));
    const { ctx } = fixturesCtx(opts, run, doc, db, session.context);
    const c = await cleanupRun(ctx, { setups });
    data = { ...data, cleaned: c.cleaned, skipped: c.skipped, failures: c.failures };
    db?.close();
    await session.close();
  }
  ledger.compact();
  patchRun(opts.taskDir, { status: "completed", finishedAt: new Date().toISOString(), executed: entries.map((e) => e.n), counts: entries.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {}), data });
  console.log(`run ${run.runId}: ${entries.length} entr(ies) checked, run closed in ${INDEX_FILE}`);
  return 0;
}

// --------------------------------------------------------------------- db

function dbDiscover(opts) {
  const { candidates, running } = discoverDb({ cwd: opts.taskDir });
  const project = discoverDb({ cwd: process.cwd() });
  const all = [...candidates, ...project.candidates.filter((c) => !candidates.some((d) => d.source === c.source))];
  if (!all.length && !running.length) {
    console.log(`no docker-compose service with a database image found in ${opts.taskDir} or ${process.cwd()}, and no database container is running.\nWrite ${CONFIG_FILE} by hand:\n${JSON.stringify({ db: { engine: "mysql", docker: { container: "<name from docker ps>" }, database: "<db>", user: "<user>", passwordFrom: "container-env:MYSQL_PASSWORD", readOnly: true, writes: false, mask: [] } }, null, 2)}`);
    return;
  }
  for (const c of all) {
    console.log(`# ${c.source}: service ${c.db.docker.service} (${c.image}) — ${c.implemented ? "adapter available" : "NO adapter here (sqlite and mysql only)"}${c.running ? `, running as ${c.running}` : ", not running"}`);
    console.log(JSON.stringify({ db: c.db }, null, 2));
  }
  const loose = (project.running.length ? project.running : running).filter((r) => !all.some((c) => c.running === r.name));
  for (const r of loose) console.log(`# running container ${r.name} (${r.image}) with no compose file here — use "docker": { "container": "${r.name}" }`);
  console.log(`\nFill in what is missing (database, user), keep passwordFrom as a pointer, add "probe" so --db-check can confirm the app reads this database, and save as ${path.join(path.dirname(opts.taskDir), CONFIG_FILE)}.`);
}

async function dbQuery(opts) {
  const { db } = await openDbFor({ ...opts, db: opts.db }, { withDB: true });
  try {
    console.log(JSON.stringify(await db.query(opts.db, opts.params), null, 2));
  } catch (e) {
    die(2, e.message);
  } finally {
    db.close();
  }
}

/** --db-check: describe the connection and run the probe against the app. */
async function dbCheck(opts, pw) {
  const { db, config } = await openDbFor(opts, { withDB: true });
  const desc = db.describe();
  console.log(`database: ${JSON.stringify(desc)}`);
  const probe = config.db.probe;
  if (!probe) {
    console.log(`no "probe" in ${CONFIG_FILE}: the connection works, but nothing here shows that the app at ${opts.baseUrl} reads this database. Add one ({ "url", "js", "query", "path" }) or ask the user to confirm it, and say which in the report.`);
    db.close();
    return 0;
  }
  let dbValue;
  try {
    const rows = await db.query(probe.query, probe.params || []);
    dbValue = getPath(rows, probe.path ?? "0");
  } catch (e) {
    die(2, `probe query failed: ${e.message}`);
  }
  const info = await ensureBrowser(opts, pw);
  const { browser, context } = await connect(pw, info, opts);
  const page = await context.newPage();
  page.setDefaultTimeout(opts.timeout);
  let uiValue;
  try {
    await page.goto(resolveUrl(probe.url || "/", opts.baseUrl), { waitUntil: "commit" });
    await awaitReady(page, { ready: probe.ready || null, opts });
    for (const step of probe.steps || []) await runStep(page, step, { values: {}, sources: {}, opts, readers: { js: (e) => page.evaluate(e) }, ready: null, sink: [] });
    uiValue = await page.evaluate(probe.js);
  } finally {
    await page.close();
    await browser.close();
    db.close();
  }
  const { same } = await import("./lib/compare.mjs");
  const agree = same(uiValue, dbValue);
  console.log(`probe: UI ${probe.js} → ${JSON.stringify(uiValue)}; DB ${probe.query} → ${JSON.stringify(dbValue)}; ${agree ? "AGREE — the app reads this database" : "DISAGREE — the app at " + opts.baseUrl + " may not be using this database; do not run withDB until this is settled"}`);
  return agree ? 0 : 1;
}

// -------------------------------------------------------------------- run

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.verdict) { applyVerdict(opts); return 0; }
  if (opts.newRun) { newRun(opts); return 0; }
  if (opts.prepare) return prepareOnly(opts);
  if (opts.cleanup) return cleanupOnly(opts);
  if (opts.finish) return finishRun(opts);
  if (opts.dbDiscover) { dbDiscover(opts); return 0; }
  if (opts.db !== null) { await dbQuery(opts); return 0; }

  // The file and the database before Playwright: a broken file or an
  // unreachable database should be reported as such, not as a missing browser.
  let doc = null;
  let selected = null;
  if (!opts.open && opts.eval === null && !opts.close && !opts.dbCheck) {
    const loaded = loadScenarios(opts);
    doc = loaded.doc;
    const dbCfg = dbConfigFor(opts, doc);
    const problems = validateScenarios(doc, { only: opts.only, dbWrites: !!dbCfg.config.db?.writes });
    if (problems.length) die(2, `${path.basename(loaded.file)} is not runnable:\n  - ${problems.join("\n  - ")}`);
    const sel = selectScenarios(doc.scenarios, opts.only);
    if (sel.pulled.length) console.log(`running ${sel.pulled.join(", ")} (requires)`);
    selected = sel.selected;
  }
  const { db } = doc ? await openDbFor(opts, doc, { writes: true }) : { db: null };

  const pw = loadPlaywright();
  if (opts.close) { await closeBrowser(pw); return 0; }
  if (opts.dbCheck) return dbCheck(opts, pw);

  const annotateSrc = fs.readFileSync(path.join(HERE, "annotate.js"), "utf8");

  const info = await ensureBrowser(opts, pw);
  const { browser, context } = await connect(pw, info, opts);
  await context.addInitScript({ content: annotateSrc });

  if (opts.open) {
    const page = info.fresh && context.pages()[0] ? context.pages()[0] : await context.newPage();
    if (!info.fresh || opts.url) await page.goto(resolveUrl(opts.url || "/", opts.baseUrl), { waitUntil: "commit" }).catch((e) => console.error(`run-scenarios: ${e.message.split("\n")[0]}`));
    await page.waitForLoadState("load").catch(() => {});
    console.log(`Tab open at: ${page.url()}`);
    console.log("If that is a login page, log in in the QA window; the session lives as long as the window does.");
    process.exit(0);
  }

  if (opts.eval !== null) {
    const page = await context.newPage();
    page.setDefaultTimeout(opts.timeout);
    await page.goto(resolveUrl(opts.url || "/", opts.baseUrl), { waitUntil: "commit" });
    await page.waitForLoadState("load");
    let value;
    try {
      const ctx = { values: {}, sources: {}, opts, readers: { js: (e) => page.evaluate(e) }, ready: null, sink: [] };
      for (const step of opts.steps || []) await runStep(page, step, ctx);
      value = await page.evaluate(opts.eval);
    } finally {
      await page.close();
      await browser.close();
    }
    console.log(JSON.stringify(value === undefined ? null : value, null, 2));
    return 0;
  }

  const prevByN = new Map(loadIndex(opts.taskDir).scenarios.map((r) => [r.n, r]));
  const run = startRun(opts.taskDir, runMeta(opts, doc, { browser: info.browser, browserVersion: info.version, executable: info.executable, profile: info.profile, db: db ? db.describe() : null }));
  console.log(`run ${run.runId} → ${path.relative(process.cwd(), opts.taskDir) || "."}/${INDEX_FILE}`);
  if (run.migratedFrom === "0.7.0") console.log(`${INDEX_FILE} was a 0.7.0 index; runs/ is no longer read and its pictures are not reused — delete it once this run has its own`);
  const { ledger, values, ctx: fixtures } = fixturesCtx(opts, run, doc, db, context);
  const leftovers = ledger.leftovers();
  if (leftovers.length) console.log(`${LEDGER_FILE} lists ${leftovers.length} record(s) from an earlier run — this run cleans only its own; --cleanup removes those too`);

  const page = await context.newPage();
  await page.setViewportSize(opts.viewport);
  page.setDefaultTimeout(opts.timeout);

  const abort = { requested: false };
  const onSignal = (sig) => {
    if (abort.requested) { console.error(`\nrun-scenarios: ${sig} again — leaving now; run ${run.runId} is marked interrupted, its data may still be there (--cleanup)`); patchRun(opts.taskDir, { status: "interrupted", finishedAt: new Date().toISOString(), note: "killed by a second signal before cleanup finished" }); process.exit(130); }
    abort.requested = true;
    console.error(`\nrun-scenarios: ${sig} — finishing the current scenario, then cleaning up; press again to leave at once`);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  let outcome;
  try {
    outcome = await executeScenarios({
      page, annotateSrc, taskDir: opts.taskDir, run, doc, selected, opts, db, ledger, values, fixtures, prevByN, abort,
      log: (l) => console.log(l),
    });
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    db?.close();
  }

  const { results, errored, interrupted } = outcome;
  const index = loadIndex(opts.taskDir);
  const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
  const diff = diffAgainst(prevByN, results);
  const changed = diff.map((d) => `${d.n}${d.stepsChanged ? " (steps)" : ""}${d.statusFrom ? ` (${d.statusFrom} → ${d.status})` : ""}`);
  const unexplained = diff.filter((d) => d.revisionMissing).map((d) => d.n);
  const blocked = results.filter((r) => r.status === "blocked");
  const earlier = index.scenarios.filter((r) => r.runId !== run.runId);
  console.log(`\n${results.length} scenario(s): ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")} → ${path.relative(process.cwd(), opts.taskDir) || "."}/ (run ${run.runId}${interrupted ? ", INTERRUPTED" : ""})`);
  if (earlier.length) console.log(`${earlier.map((r) => r.n).join(", ")} not executed in this run — ${INDEX_FILE} keeps their last result with its own run id; their rows read "(earlier)" in the report.`);
  if (changed.length) console.log(`${changed.join(", ")} changed since the previous ${INDEX_FILE} — say so in the report under "Changes to the scenarios"; the index keeps no history, this line is the record.`);
  if (unexplained.length) console.log(`${unexplained.join(", ")} rewritten with no "revision" for this version of the steps — add one saying what the earlier check got wrong.`);
  if (blocked.length) console.log(`${blocked.map((r) => r.n).join(", ")} blocked — a setup failed, a precondition did not hold or a required scenario did not finish. Not a result and not an error: fix the cause, then re-run with --only <n>.`);
  if (errored) console.log(`${errored} errored — establish why before touching the step: --eval whether the element exists, the console entries in the results, the code. A missing element the criterion requires is a FAIL (--verdict NN=fail --reason "…"); a wrong step is fixed with a "revision" and re-run with --only <n>.`);
  const data = index.run?.data;
  if (data?.kept) console.log(`test data kept (${data.records} record(s)); the report has to say so under Test data.`);
  if (data?.failures?.length) console.log(`cleanup failed for ${data.failures.length} record(s) — they are still in the database; list them in the report and remove them by hand or with --cleanup.`);
  return interrupted ? 130 : errored ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
