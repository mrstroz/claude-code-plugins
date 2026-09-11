#!/usr/bin/env node
// run-scenarios.test.mjs — the runner's own tests. `node --test qa/skills/ui-test-report/scripts/`
//
// The browser is not here. The scenario loop takes a page object, so these
// tests hand it a fake one whose `evaluate` reads a scripted state, and check
// what the loop writes to disk: results.json, records.json, screenshots/.
// Everything that decides a verdict — comparators, validation, retry, the
// diff against the previous results, cleanup, the database guard — is
// exercised directly.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { same, COMPARATORS, check, normalize, fill, getPath } from "./lib/compare.mjs";
import { validateScenarios, hashOf, selectScenarios } from "./lib/validate.mjs";
import { startRun, loadIndex, writeJsonAtomic, readJson, patchRun, diffAgainst } from "./lib/runs.mjs";
import { openDb, maskRows, isReadQuery } from "./lib/db.mjs";
import { buildScript, parseXml, escapeLiteral } from "./lib/db-mysql-docker.mjs";
import { Ledger, prepareSetup, cleanupRun } from "./lib/fixtures.mjs";
import { executeScenarios, clearShots } from "./lib/engine.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "qa-runner-"));

// ------------------------------------------------------------ comparators

test("equals: number and numeric string agree, nothing else is coerced", () => {
  assert.equal(same(11, "11"), true);
  assert.equal(same("11", 11), true);
  assert.equal(same(null, "null"), false);
  assert.equal(same(true, "true"), false);
  assert.equal(same(0, ""), false);
  assert.equal(same(["P-101", "P-103"], ["P-101", "P-103"]), true);
  assert.equal(same(["P-101"], "P-101"), false);
  assert.equal(same({ a: 1 }, { a: "1" }), true);
  assert.equal(same({ a: 1 }, { a: 1, b: 2 }), false);
});

test("contains: substring on strings, element on arrays, key on objects — no flattening", () => {
  assert.equal(COMPARATORS.contains("P-101,P-103", "P-10").passed, true);
  assert.equal(COMPARATORS.contains(["P-101", "P-103"], "P-10").passed, false, "an array is not a string");
  assert.equal(COMPARATORS.contains(["P-101", "P-103"], "P-101").passed, true);
  assert.equal(COMPARATORS.contains([1, 2], "2").passed, true, "element equality keeps the numeric concession");
  assert.equal(COMPARATORS.contains({ id: 1 }, "id").passed, true);
  const r = COMPARATORS.contains(null, "x");
  assert.equal(r.passed, false);
  assert.match(r.reason, /needs a string, array or object/);
});

test("matches only reads strings; gt/lt refuse non-numbers with a reason", () => {
  assert.equal(COMPARATORS.matches("Results - 6", "Results - \\d+").passed, true);
  const arr = COMPARATORS.matches(["a"], "a");
  assert.equal(arr.passed, false);
  assert.match(arr.reason, /matches needs a string, got array/);
  assert.equal(COMPARATORS.gt("12", 11).passed, true);
  const bad = COMPARATORS.lt("twelve", 11);
  assert.equal(bad.passed, false);
  assert.match(bad.reason, /needs a number on the left/);
});

test("as: deliberate normalisation of DOM values", () => {
  assert.equal(normalize("1 234,50 zł", "number"), 1234.5);
  assert.equal(normalize(" yes ", "boolean"), true);
  assert.deepEqual(normalize(["1", "2"], "number"), [1, 2]);
  assert.equal(normalize("  a   b ", "trim"), "a b");
  assert.throws(() => normalize("abc", "number"), /cannot read/);
  assert.equal(getPath({ json: { id: 7 } }, "json.id"), 7);
  assert.equal(fill("QA ${runId} villas", { runId: "20260910-1" }), "QA 20260910-1 villas");
});

// -------------------------------------------------------------- retry

test("check with within re-reads until the state changes; a stored value is compared once", async () => {
  let n = 0;
  const readers = { js: async () => (++n < 3 ? 11 : 6) };
  const r = await check({ js: "rows", equals: 6, within: 2000, every: 5 }, {}, readers);
  assert.equal(r.passed, true);
  assert.equal(r.attempts, 3);
  assert.equal(r.actual, 6);
  assert.ok(r.waitedMs >= 0);
  const once = await check({ name: "rows", equals: 6 }, { rows: 11 }, readers, { rows: "ui" });
  assert.equal(once.passed, false);
  assert.equal(once.attempts, undefined);
  assert.equal(once.source, "ui");
});

test("check with within times out with diagnostics: expected, last actual, waited, attempts", async () => {
  const readers = { js: async () => 11 };
  const r = await check({ js: "rows", equals: 6, within: 60, every: 10, desc: "six villas" }, {}, readers);
  assert.equal(r.passed, false);
  assert.equal(r.timedOut, true);
  assert.equal(r.actual, 11);
  assert.equal(r.expected, 6);
  assert.ok(r.waitedMs >= 60);
  assert.ok(r.attempts >= 2);
  assert.match(r.reason, /expected number 6, got number 11/);
});

test("check reads the database through the db reader and reports source db", async () => {
  const readers = { js: async () => 0, db: async (spec) => [{ n: "1" }] };
  const r = await check({ db: { query: "SELECT COUNT(*) AS n FROM v" }, path: "0.n", equals: 1 }, {}, readers);
  assert.equal(r.passed, true);
  assert.equal(r.source, "db");
});

// ---------------------------------------------------------- validation

const okScenario = (n, extra = {}) => ({
  n, slug: `s${n}`, title: `S ${n}`,
  steps: [{ goto: "/" }, { read: { name: `v${n}`, js: "1" } }, { expect: { name: `v${n}`, equals: 1 } }],
  caption: { t: "t", d: "d", target: "table" },
  ...extra,
});

test("validation: one operation per step, one comparator, one source, within not on name, target required", () => {
  const doc = { scenarios: [
    { n: "01", slug: "a", title: "a", steps: [
      { click: "#a", fill: { selector: "#b", value: "x" } },
      { expect: { js: "1", equals: 1, gt: 0 } },
      { expect: { js: "1", name: "x", equals: 1 } },
      { read: { name: "count", js: "1" } },
      { expect: { name: "count", equals: 1, within: 500 } },
      { expect: { js: "1", equals: 1, as: "nope" } },
      { click: "#c", bogus: true },
      { wait: "networkidle" },
    ], caption: { t: "t", d: "d" } },
  ] };
  const p = validateScenarios(doc);
  const has = (re) => assert.ok(p.some((x) => re.test(x)), `expected a problem matching ${re}, got:\n${p.join("\n")}`);
  has(/one operation per step, this one has click and fill/);
  has(/exactly one comparator \(has equals, gt\)/);
  has(/exactly one of js, name, db \(has js, name\)/);
  has(/cannot use "within" on a stored value/);
  has(/"as": "nope" is not one of/);
  has(/unknown key "bogus" next to click/);
  has(/wait "networkidle" is a guess/);
  has(/caption has no "target"/);
});

test("validation: db steps need withDB, sql fixtures need db.writes, uses must exist, refs must be read", () => {
  const doc = {
    setups: { seed: { prepare: [{ sql: { query: "INSERT INTO t VALUES (1)" } }] } },
    scenarios: [
      okScenario("01", { uses: ["nothere"], steps: [{ db: { name: "row", query: "SELECT 1" } }, { expect: { name: "row", equals: 1 } }, { expect: { name: "ghost", equals: 1 } }] }),
    ],
  };
  const p = validateScenarios(doc, { dbWrites: false });
  const has = (re) => assert.ok(p.some((x) => re.test(x)), `expected ${re}, got:\n${p.join("\n")}`);
  has(/reads the database but the file does not declare "withDB": true/);
  has(/sql steps need "withDB": true/);
  has(/uses setup "nothere", which is not defined/);
  has(/refers to \$\{ghost\} but no earlier read stores it/);
  assert.equal(validateScenarios({ ...doc, withDB: true, scenarios: [okScenario("01", { steps: [{ db: { name: "row", query: "SELECT 1" } }, { expect: { name: "row", equals: 1 } }] })] }, { dbWrites: true }).length, 0);
});

test("validation under --only: a ${ref} read by a scenario outside the selection is reported", () => {
  const doc = { scenarios: [
    okScenario("01"),
    okScenario("02", { steps: [{ goto: "/" }, { expect: { js: "1", equals: "${v01}" } }] }),
    okScenario("03", { requires: ["01"], steps: [{ goto: "/" }, { expect: { js: "1", equals: "${v01}" } }] }),
  ] };
  assert.equal(validateScenarios(doc).length, 0, "the whole file reads in order");
  const p = validateScenarios(doc, { only: ["02"] });
  assert.ok(p.some((x) => /scenario 02 uses \$\{v01\}, read by 01, which is not in this run — add 01 to its requires/.test(x)), p.join("\n"));
  assert.equal(validateScenarios(doc, { only: ["03"] }).length, 0, "03 pulls 01 in through requires");
  assert.deepEqual(selectScenarios(doc.scenarios, ["03"]).selected.map((s) => s.n), ["01", "03"]);
});

test("hash v2 changes with requires, uses and the content of a used setup", () => {
  const base = okScenario("02");
  const setups = { seed: { prepare: [{ shell: "true" }] } };
  const h0 = hashOf(base, setups);
  assert.notEqual(hashOf({ ...base, requires: ["01"] }, setups), h0);
  assert.notEqual(hashOf({ ...base, uses: ["seed"] }, setups), h0);
  assert.notEqual(hashOf({ ...base, uses: ["seed"] }, setups), hashOf({ ...base, uses: ["seed"] }, { seed: { prepare: [{ shell: "false" }] } }));
  assert.equal(hashOf({ ...base, title: "renamed" }, setups), h0, "the title is not part of what is checked");
});

// ------------------------------------------------------------ fake page

/** A page whose js expressions read `state`; actions are recorded. */
function fakePage(state, { shots = true } = {}) {
  const actions = [];
  const page = {
    state, actions, listeners: {},
    on(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    async evaluate(x, arg) {
      if (typeof x === "function") return arg === undefined ? true : { tag: "ann", missing: state.missing || [] };
      return new Function("state", `return (${x})`)(state);
    },
    async goto(url) { actions.push(["goto", url]); },
    async reload() { actions.push(["reload"]); },
    async waitForLoadState() {},
    async waitForTimeout(ms) { actions.push(["wait", ms]); },
    async waitForFunction(js) { if (!new Function("state", `return (${js})`)(state)) throw new Error(`waitForFunction: Timeout 10000ms exceeded.\n  ${js}`); },
    async waitForURL() {},
    async addScriptTag() {},
    async screenshot({ path: file }) { if (shots) fs.writeFileSync(file, Buffer.alloc(6000, 1)); },
    locator(sel) {
      const loc = {
        first: () => loc,
        async waitFor() { if (state.hidden?.includes(sel)) throw new Error(`locator.waitFor: Timeout 10000ms exceeded.\n  waiting for ${sel}`); },
        async click() { actions.push(["click", sel]); if (state.onClick) state.onClick(sel); },
      };
      return loc;
    },
  };
  return page;
}

function setupTask(scenariosDoc) {
  const taskDir = tmp();
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify(scenariosDoc));
  return taskDir;
}

async function runOnce(taskDir, doc, state, { only = null, keepData = false, abort = { requested: false }, ledger = null, fixtures = null, db = null, prevByN = null } = {}) {
  const list = doc.scenarios;
  const { selected } = selectScenarios(list, only);
  const prev = prevByN || new Map(loadIndex(taskDir).scenarios.map((r) => [r.n, r]));
  const run = startRun(taskDir, { driver: "playwright", scope: only ? { only } : "all" });
  const page = fakePage(state);
  const led = ledger || new Ledger(path.join(taskDir, "records.json"), run.runId);
  const values = { runId: run.runId };
  const fx = fixtures || { runId: run.runId, baseUrl: "http://app", values, db, ledger: led, cwd: taskDir };
  const out = await executeScenarios({
    page, annotateSrc: "", taskDir, run, doc, selected, opts: { baseUrl: "http://app", timeout: 100, keepData }, db, ledger: led, values, fixtures: fx,
    prevByN: prev, abort, log: () => {},
  });
  return { ...out, run, page, prevByN: prev, meta: loadIndex(taskDir).run };
}

// --------------------------------------------------------------- loop

test("loop: pass, fail with reason and source, blocked by given, blocked by requires, error", async () => {
  const doc = { scenarios: [
    okScenario("01", { steps: [{ goto: "/" }, { read: { name: "total", js: "state.rows.length" } }, { expect: { name: "total", equals: 3 } }] }),
    okScenario("02", { steps: [{ goto: "/" }, { expect: { js: "state.rows", equals: ["a", "b"], desc: "two ids" } }] }),
    okScenario("03", { given: [{ js: "state.rows.length", equals: 99, desc: "99 rows" }], steps: [{ goto: "/" }, { expect: { js: "1", equals: 1 } }] }),
    okScenario("04", { requires: ["03"], steps: [{ goto: "/" }, { expect: { js: "1", equals: 1 } }] }),
    okScenario("05", { steps: [{ wait: "#gone" }, { expect: { js: "1", equals: 1 } }] }),
  ] };
  const taskDir = setupTask(doc);
  const { results, errored, run } = await runOnce(taskDir, doc, { rows: ["a", "b", "c"], hidden: ["#gone"] });
  const by = Object.fromEntries(results.map((r) => [r.n, r]));
  assert.equal(by["01"].status, "pass");
  assert.equal(by["02"].status, "fail");
  assert.equal(by["02"].expects[0].source, "ui");
  assert.match(by["02"].expects[0].reason, /expected array/);
  assert.equal(by["03"].status, "blocked");
  assert.equal(by["03"].blockedBy, "given");
  assert.equal(by["04"].status, "blocked");
  assert.equal(by["04"].blockedBy, "03");
  assert.equal(by["05"].status, "error");
  assert.equal(by["05"].failedStep.index, 0);
  assert.equal(by["05"].screenshot, "screenshots/05-s05.error.jpg");
  assert.equal(errored, 1);
  assert.equal(by["01"].values.total, 3);
  const index = loadIndex(taskDir);
  assert.equal(index.run.status, "completed");
  assert.deepEqual(index.run.executed, ["01", "02", "03", "04", "05"]);
  assert.ok(fs.existsSync(path.join(taskDir, by["01"].screenshot)));
  assert.equal(by["03"].screenshot, null, "blocked has no picture");
  assert.equal(index.runId, run.runId);
  assert.ok(index.scenarios.every((r) => r.runId === run.runId));
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")), "nothing created, no ledger file");
});

test("partial re-run: the untouched scenario keeps its old run id and its picture, the re-run one is overwritten in place", async () => {
  const doc = { scenarios: [okScenario("01"), okScenario("02", { requires: ["01"] })] };
  const taskDir = setupTask(doc);
  const first = await runOnce(taskDir, doc, {});
  const pic01 = path.join(taskDir, first.results[0].screenshot);
  const pic02 = path.join(taskDir, first.results[1].screenshot);
  const stamp02 = fs.statSync(pic02).mtimeMs;
  fs.writeFileSync(pic01, Buffer.alloc(6000, 7));
  const second = await runOnce(taskDir, doc, {}, { only: ["02"] });
  assert.deepEqual(second.results.map((r) => r.n), ["01", "02"], "02 pulls 01 in");
  const index = loadIndex(taskDir);
  assert.ok(index.scenarios.every((r) => r.runId === second.run.runId));
  assert.equal(index.scenarios[1].screenshot, "screenshots/02-s02.jpg", "same path, overwritten");
  assert.ok(fs.statSync(pic02).mtimeMs >= stamp02);
  // A third run touching only 01 leaves 02 pointing at the second run, picture untouched.
  const before02 = fs.readFileSync(pic02);
  const third = await runOnce(taskDir, doc, {}, { only: ["01"] });
  const idx3 = loadIndex(taskDir);
  assert.equal(idx3.runId, third.run.runId);
  assert.equal(idx3.scenarios[0].runId, third.run.runId);
  assert.equal(idx3.scenarios[1].runId, second.run.runId);
  assert.deepEqual(fs.readFileSync(pic02), before02, "02 was not re-captured");
  assert.deepEqual(fs.readdirSync(path.join(taskDir, "screenshots")).sort(), ["01-s01.jpg", "02-s02.jpg"]);
});

test("clearShots: a re-run removes the scenario's earlier pictures, whatever their slug or suffix", () => {
  const dir = tmp();
  for (const f of ["03-old-slug.jpg", "03-old-slug.error.jpg", "030-other.jpg", "04-keep.jpg"]) fs.writeFileSync(path.join(dir, f), "x");
  assert.deepEqual(clearShots(dir, "03").sort(), ["03-old-slug.error.jpg", "03-old-slug.jpg"]);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["030-other.jpg", "04-keep.jpg"]);
  assert.deepEqual(clearShots(path.join(dir, "missing"), "01"), []);
});

test("rewrite detection: a changed comparator is reported against the previous results.json, with the revision's coverage", async () => {
  const doc = { scenarios: [okScenario("01", { steps: [{ goto: "/" }, { read: { name: "n", js: "state.n" } }, { expect: { name: "n", equals: 5 } }] })] };
  const taskDir = setupTask(doc);
  await runOnce(taskDir, doc, { n: 4 });
  const doc2 = { scenarios: [okScenario("01", { revision: "5 was the seed before the migration; 4 is right", steps: [{ goto: "/" }, { read: { name: "n", js: "state.n" } }, { expect: { name: "n", equals: 4 } }] })] };
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify(doc2));
  const second = await runOnce(taskDir, doc2, { n: 4 });
  const r = loadIndex(taskDir).scenarios[0];
  assert.equal(r.status, "pass");
  assert.equal(r.revisionHash, r.stepsHash);
  const diff = diffAgainst(second.prevByN, second.results);
  assert.deepEqual(diff, [{ n: "01", stepsChanged: true, statusFrom: "fail", status: "pass", revisionMissing: false }]);
  // The same revision sentence on a second rewrite does not cover the new steps.
  const doc3 = { scenarios: [okScenario("01", { revision: doc2.scenarios[0].revision, steps: [{ goto: "/" }, { read: { name: "n", js: "state.n" } }, { expect: { name: "n", lt: 10 } }] })] };
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify(doc3));
  const third = await runOnce(taskDir, doc3, { n: 4 });
  const diff3 = diffAgainst(third.prevByN, third.results);
  assert.equal(diff3[0].stepsChanged, true);
  assert.equal(diff3[0].revisionMissing, true);
  assert.deepEqual(diffAgainst(new Map(), third.results), [], "nothing to compare on the first run");
});

test("interrupt: results written after every scenario, the run is marked interrupted, cleanup still runs", async () => {
  const doc = {
    setups: { seed: { prepare: [{ shell: { command: "echo 41", record: { kind: "thing", id: "stdout", cleanup: { shell: "echo cleaned ${id} >> \"$QA_CLEAN_LOG\"" } } } }] } },
    scenarios: [okScenario("01", { uses: ["seed"] }), okScenario("02"), okScenario("03")],
  };
  const taskDir = setupTask(doc);
  const abort = { requested: false };
  const log = path.join(taskDir, "clean.log");
  process.env.QA_CLEAN_LOG = log;
  const state = { onClick: null };
  // Ask to stop as soon as 01 has run: the loop checks between scenarios.
  const page = fakePage(state);
  const run = startRun(taskDir, { driver: "playwright", scope: "all" });
  const ledger = new Ledger(path.join(taskDir, "records.json"), run.runId);
  const values = { runId: run.runId };
  const fixtures = { runId: run.runId, baseUrl: "http://app", values, db: null, ledger, cwd: taskDir };
  let count = 0;
  const out = await executeScenarios({
    page, annotateSrc: "", taskDir, run, doc, selected: doc.scenarios, opts: { baseUrl: "http://app", timeout: 100 }, db: null, ledger, values, fixtures,
    prevByN: new Map(), abort, log: () => { if (++count === 2) abort.requested = true; }, // "setup seed prepared" then "PASS 01"
  });
  assert.equal(out.interrupted, true);
  assert.deepEqual(out.results.map((r) => r.n), ["01"]);
  const idx = loadIndex(taskDir);
  assert.equal(idx.run.status, "interrupted");
  assert.equal(idx.run.stoppedAfter, "01");
  assert.equal(idx.run.data.records, 1);
  assert.equal(idx.run.data.cleaned, 1);
  assert.match(fs.readFileSync(log, "utf8"), /cleaned 41/);
  assert.equal(idx.scenarios.length, 1);
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")), "cleaned up: the ledger file is gone");
});

test("loadIndex: no file reads as an empty index, and entries survive the start of a run", () => {
  assert.deepEqual(loadIndex(tmp()), { runId: null, run: null, scenarios: [] });
  const taskDir = tmp();
  writeJsonAtomic(path.join(taskDir, "results.json"), {
    runId: "20260910-171010-1aef", run: { runId: "20260910-171010-1aef", status: "completed" },
    scenarios: [{ n: "01", status: "pass", runId: "20260910-171010-1aef", screenshot: "screenshots/01-a.jpg" }],
  });
  startRun(taskDir, { driver: "playwright" });
  const after = loadIndex(taskDir);
  assert.equal(after.run.status, "running");
  assert.equal(after.scenarios[0].runId, "20260910-171010-1aef", "entries survive the start of a run");
});

// ------------------------------------------------------------ fixtures

async function sqliteFixture() {
  const db = await openDb({ engine: "sqlite", file: ":memory:", writes: true }, { writes: true });
  // reach the raw handle to create the schema
  const { open } = await import("./lib/db-sqlite.mjs");
  const raw = open({ file: ":memory:", readOnly: false });
  raw.raw("CREATE TABLE views (id INTEGER PRIMARY KEY, name TEXT, owner_id INTEGER, email TEXT)");
  raw.raw("INSERT INTO views (name, owner_id, email) VALUES ('someone else''s view', 2, 'x@y.z')");
  const wrapped = {
    engine: "sqlite", readOnly: false, describe: () => ({ engine: "sqlite" }),
    query: (sql, params = [], o = {}) => {
      if (!isReadQuery(sql) && !o.write) throw new Error("refused: scenarios only read the database");
      return raw.query(sql, params, o);
    },
    close: () => raw.close(), raw,
  };
  db.close();
  return wrapped;
}

test("setups: prepare once per run, records in the ledger with the run id, cleanup removes only those", async () => {
  const db = await sqliteFixture();
  const doc = {
    withDB: true,
    setups: { seed: { prepare: [
      { sql: { query: "INSERT INTO views (name, owner_id) VALUES (?, 1)", params: ["QA ${runId} villas"], record: { kind: "views", id: "insertId", cleanup: { sql: { query: "DELETE FROM views WHERE id = ? AND name LIKE 'QA %'", params: ["${id}"] } } } } },
    ] } },
    scenarios: [
      okScenario("01", { uses: ["seed"], steps: [{ db: { name: "row", query: "SELECT name, owner_id FROM views WHERE name = ?", params: ["QA ${runId} villas"], one: true } }, { expect: { name: "row", path: "owner_id", equals: 1, desc: "owned by tenant 1" } }, { expect: { db: { query: "SELECT COUNT(*) AS n FROM views WHERE name = ?", params: ["QA ${runId} villas"] }, path: "0.n", equals: 1, desc: "no duplicate" } }] }),
      okScenario("02", { uses: ["seed"], steps: [{ expect: { db: { query: "SELECT COUNT(*) AS n FROM views" }, path: "0.n", equals: 2, desc: "seed plus the stranger's row" } }] }),
    ],
  };
  const taskDir = setupTask(doc);
  assert.equal(validateScenarios(doc, { dbWrites: true }).length, 0);
  const { results, run } = await runOnce(taskDir, doc, {}, { db });
  assert.equal(results[0].status, "pass", JSON.stringify(results[0].expects));
  assert.equal(results[0].expects[0].source, "db");
  assert.equal(results[1].status, "pass", "setup ran once: still one seeded row");
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")), "everything cleaned: no ledger file left");
  const left = await db.query("SELECT name FROM views");
  assert.deepEqual(left.map((r) => r.name), ["someone else's view"], "cleanup removed the run's row and nothing else");
  const meta = loadIndex(taskDir).run;
  assert.equal(meta.data.records, 1);
  assert.equal(meta.data.cleaned, 1);
});

test("--keep-data leaves the records and says so; cleanupRun later removes them", async () => {
  const db = await sqliteFixture();
  const doc = {
    withDB: true,
    setups: { seed: { prepare: [{ sql: { query: "INSERT INTO views (name, owner_id) VALUES (?, 1)", params: ["QA ${runId}"], record: { kind: "views", id: "insertId", cleanup: { sql: { query: "DELETE FROM views WHERE id = ?", params: ["${id}"] } } } } }] } },
    scenarios: [okScenario("01", { uses: ["seed"], steps: [{ expect: { db: { query: "SELECT COUNT(*) AS n FROM views WHERE name = ?", params: ["QA ${runId}"] }, path: "0.n", equals: 1 } }] })],
  };
  const taskDir = setupTask(doc);
  const { run } = await runOnce(taskDir, doc, {}, { db, keepData: true });
  assert.equal(loadIndex(taskDir).run.data.kept, true);
  assert.equal((await db.query("SELECT COUNT(*) AS n FROM views"))[0].n, 2);
  const file = path.join(taskDir, "records.json");
  const kept = readJson(file);
  assert.equal(kept.records.length, 1, "the ledger stays while the row is there");
  assert.deepEqual(kept.prepared, [{ name: "seed", runId: run.runId, baseUrl: "http://app" }], "a prepared setup remembers where it was prepared");
  assert.equal(kept.cleaned, undefined, "no cleaned list: what is cleaned leaves the file");
  // A second run sees the leftover, cleans only its own, and the file keeps the old row.
  const second = await runOnce(taskDir, doc, {}, { db });
  assert.equal(second.results[0].status, "pass");
  assert.equal((await db.query("SELECT COUNT(*) AS n FROM views"))[0].n, 2, "the kept row is still there, the second run's row is gone");
  const stillThere = readJson(file);
  assert.deepEqual(stillThere.records.map((r) => r.runId), [run.runId]);
  assert.equal(second.meta.data.records, 1, "counts this run's records only");
  // --cleanup walks everything.
  const ledger = new Ledger(file, "cleanup");
  assert.equal(ledger.leftovers().length, 1);
  const c = await cleanupRun({ runId: "cleanup", values: {}, db, ledger, cwd: taskDir }, { setups: doc.setups, all: true });
  assert.equal(c.cleaned, 1);
  assert.equal(ledger.compact(), false);
  assert.ok(!fs.existsSync(file), "nothing left, no file");
  assert.equal((await db.query("SELECT COUNT(*) AS n FROM views"))[0].n, 1);
});

test("a failing setup blocks the scenarios that use it; a failing cleanup is recorded, not swallowed", async () => {
  const doc = {
    setups: {
      broken: { prepare: [{ shell: "exit 3" }] },
      fine: { prepare: [{ shell: { command: "echo 7", record: { kind: "x", id: "stdout", cleanup: { shell: "exit 4" } } } }] },
    },
    scenarios: [okScenario("01", { uses: ["broken"] }), okScenario("02", { uses: ["fine"] })],
  };
  const taskDir = setupTask(doc);
  const { results, run } = await runOnce(taskDir, doc, {});
  assert.equal(results[0].status, "blocked");
  assert.equal(results[0].blockedBy, "setup:broken");
  assert.equal(results[1].status, "pass");
  const meta = loadIndex(taskDir).run;
  assert.equal(meta.data.failures.length, 1);
  assert.equal(meta.data.failures[0].id, "7");
  const ledger = readJson(path.join(taskDir, "records.json"));
  assert.ok(ledger, "a failed cleanup keeps the file");
  assert.equal(ledger.records.length, 1, "the record it could not remove is still listed");
  assert.equal(ledger.failures.length, 1);
});

/** A store served over http: DELETE /api/views/:id removes, and remembers what it was asked. */
async function stubApi(ids = []) {
  const http = await import("node:http");
  const store = new Set(ids);
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    const id = Number(req.url.split("/").pop());
    if (req.method === "DELETE" && req.url.startsWith("/api/views/") && store.has(id)) {
      store.delete(id);
      res.writeHead(204);
    } else {
      res.writeHead(404);
    }
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { store, seen, baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

const DELETE_VIEW = { http: { method: "DELETE", url: "/api/views/${id}" } };

test("cleanup removes each record where it was made, not where the context happens to point", async () => {
  const a = await stubApi([1]);
  const b = await stubApi([1, 2]);
  const taskDir = tmp();
  const file = path.join(taskDir, "records.json");
  writeJsonAtomic(file, {
    prepared: [],
    records: [
      { runId: "20260101-000000-aaaa", kind: "view", id: 1, via: "http", baseUrl: a.baseUrl, cleanup: DELETE_VIEW },
      { runId: "20260102-000000-bbbb", kind: "view", id: 2, via: "http", baseUrl: b.baseUrl, cleanup: DELETE_VIEW },
    ],
    failures: [],
  });
  const ledger = new Ledger(file, "20260102-000000-bbbb");
  // The context points at B, as it would after a second run against another app.
  const c = await cleanupRun({ runId: "20260102-000000-bbbb", baseUrl: b.baseUrl, values: {}, db: null, ledger, cwd: taskDir }, { setups: {}, all: true });
  assert.equal(c.cleaned, 2);
  assert.deepEqual([...a.store], [], "A's record was removed at A");
  assert.deepEqual([...b.store], [1], "the row B holds under A's id is untouched");
  assert.ok(!a.seen.some((l) => l.endsWith("/2")), "A never saw B's id");
  assert.ok(!b.seen.some((l) => l.endsWith("/1")), "B never saw A's id");
  assert.equal(ledger.compact(), false);
  a.close();
  b.close();
});

test("cleanup refuses a record with no base URL, and --base-url names one on purpose", async () => {
  const a = await stubApi([7, 8]);
  const taskDir = tmp();
  const file = path.join(taskDir, "records.json");
  writeJsonAtomic(file, { prepared: [], records: [{ runId: "20260101-000000-aaaa", kind: "view", id: 7, via: "http", cleanup: DELETE_VIEW }], failures: [] });
  const ledger = new Ledger(file, "cleanup");
  const ctx = { runId: "cleanup", baseUrl: a.baseUrl, values: {}, db: null, ledger, cwd: taskDir };
  let c = await cleanupRun(ctx, { setups: {}, all: true });
  assert.equal(c.cleaned, 0);
  assert.equal(c.failures.length, 1);
  assert.match(c.failures[0].error, /no base URL/);
  assert.equal(ledger.records.length, 1, "the record stays listed rather than being sent somewhere unnamed");
  assert.deepEqual([...a.store], [7, 8], "nothing was guessed at from the context");
  c = await cleanupRun(ctx, { setups: {}, all: true, baseUrl: a.baseUrl });
  assert.equal(c.cleaned, 1);
  assert.deepEqual([...a.store], [8]);
  assert.equal(ledger.failures.length, 0, "a failure the retry solved leaves the ledger");
  assert.equal(ledger.compact(), false);
  a.close();
});

test("cleanup retry: an unsolved task stays retryable, and prepared alone keeps the file", async () => {
  const taskDir = tmp();
  const file = path.join(taskDir, "records.json");
  const once = (flag) => ({ shell: `if [ -e ${path.join(taskDir, flag)} ]; then exit 0; else touch ${path.join(taskDir, flag)}; exit 1; fi` });
  const setups = { seed: { prepare: [], cleanup: [once("setup-tried")] } };
  writeJsonAtomic(file, {
    prepared: [{ name: "seed", runId: "r1" }],
    records: [{ runId: "r1", kind: "view", id: 5, via: "shell", cleanup: once("record-tried") }],
    failures: [],
  });
  const ledger = new Ledger(file, "r1");
  const ctx = { runId: "r1", baseUrl: null, values: {}, db: null, ledger, cwd: taskDir };

  let c = await cleanupRun(ctx, { setups });
  assert.equal(c.cleaned, 0);
  assert.equal(c.failures.length, 2, "both the record and the setup failed");
  assert.equal(ledger.records.length, 1);
  assert.deepEqual(ledger.prepared.map((p) => p.name), ["seed"], "a setup whose cleanup failed is still owed it");
  assert.equal(ledger.compact(), true, "nothing solved, the file stays");

  c = await cleanupRun(ctx, { setups });
  assert.equal(c.cleaned, 1);
  assert.equal(c.failures.length, 0);
  assert.equal(ledger.records.length, 0);
  assert.equal(ledger.prepared.length, 0);
  assert.equal(ledger.failures.length, 0, "the earlier failures were about tasks now done");
  assert.equal(ledger.compact(), false);
  assert.ok(!fs.existsSync(file), "nothing to clean up or explain, no file");

  const owed = new Ledger(path.join(tmp(), "records.json"), "r1");
  owed.prepared.push({ name: "seed", runId: "r1" });
  assert.equal(owed.compact(), true, "a setup still owed its cleanup block keeps the file on its own");
});

test("a setup's cleanup retries only the steps that did not finish", async () => {
  const taskDir = tmp();
  const file = path.join(taskDir, "records.json");
  const log = path.join(taskDir, "steps.log");
  const flag = path.join(taskDir, "second-tried");
  const setups = {
    seed: {
      prepare: [],
      cleanup: [
        { shell: `echo one >> ${log}` },
        { shell: `echo two >> ${log}; if [ -e ${flag} ]; then exit 0; else touch ${flag}; exit 1; fi` },
      ],
    },
  };
  writeJsonAtomic(file, { prepared: [{ name: "seed", runId: "r1" }], records: [], failures: [] });
  const ledger = new Ledger(file, "r1");
  const ctx = { runId: "r1", baseUrl: null, values: {}, db: null, ledger, cwd: taskDir };

  let c = await cleanupRun(ctx, { setups });
  assert.equal(c.failures.length, 1, "the second step failed");
  assert.deepEqual(ledger.prepared[0].cleanupDone, [0], "the first step is remembered as done");

  c = await cleanupRun(ctx, { setups });
  assert.equal(c.failures.length, 0, "the retry repeated only what was left, and it worked");
  assert.equal(ledger.prepared.length, 0);
  assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["one", "two", "two"], "the step that had succeeded was not run again");
  assert.equal(ledger.compact(), false);
});

test("cleanup keeps a setup it can no longer run, rather than forgetting it", async () => {
  const taskDir = tmp();
  const file = path.join(taskDir, "records.json");
  writeJsonAtomic(file, { prepared: [{ name: "gone", runId: "r1" }], records: [], failures: [] });
  const ledger = new Ledger(file, "r1");
  const c = await cleanupRun({ runId: "r1", baseUrl: null, values: {}, db: null, ledger, cwd: taskDir }, { setups: {} });
  assert.equal(c.failures.length, 1);
  assert.match(c.failures[0].error, /no longer in the scenario file/);
  assert.deepEqual(ledger.prepared.map((p) => p.name), ["gone"]);
});

test("http fixture step: creates through the API, records the id from the response, cleans up through DELETE", async () => {
  const http = await import("node:http");
  const store = new Map();
  let nextId = 100;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method === "POST" && req.url === "/api/views") {
        const id = nextId++;
        store.set(id, JSON.parse(body));
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ id, ...store.get(id) }));
      } else if (req.method === "DELETE" && req.url.startsWith("/api/views/")) {
        store.delete(Number(req.url.split("/").pop()));
        res.writeHead(204);
        res.end();
      } else { res.writeHead(404); res.end(); }
    });
  });
  await new Promise((r) => server.listen(0, r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const taskDir = tmp();
  const ledger = new Ledger(path.join(taskDir, "records.json"), "20260910-000000-0000");
  const ctx = { runId: "20260910-000000-0000", baseUrl, values: {}, db: null, ledger, cwd: taskDir };
  const setup = { prepare: [{ http: { method: "POST", url: "/api/views", json: { name: "QA ${runId} v" }, expectStatus: 201, name: "created", record: { kind: "view", id: "json.id", cleanup: { http: { method: "DELETE", url: "/api/views/${id}" } } } } }] };
  await prepareSetup("api", setup, ctx);
  assert.equal(store.size, 1);
  assert.equal(ctx.values.created.json.name, "QA 20260910-000000-0000 v");
  assert.equal(ledger.records[0].id, 100);
  const c = await cleanupRun(ctx, {});
  assert.equal(c.cleaned, 1);
  assert.equal(store.size, 0);
  server.close();
});

// --------------------------------------------------------------- withDB

test("withDB off: a db step is refused by validation; withDB on without a database errors the scenario, not a silent UI-only PASS", async () => {
  const doc = { withDB: true, scenarios: [okScenario("01", { steps: [{ goto: "/" }, { expect: { js: "1", equals: 1 } }, { expect: { db: { query: "SELECT 1 AS n" }, path: "0.n", equals: 1 } }] })] };
  assert.ok(validateScenarios({ ...doc, withDB: false }).some((p) => /does not declare "withDB": true/.test(p)));
  const taskDir = setupTask(doc);
  const { results } = await runOnce(taskDir, doc, {}, { db: null });
  assert.equal(results[0].status, "error");
  assert.match(results[0].error, /database step but no database/);
});

test("wrong data in the database is a FAIL with source db, next to a UI expect that passed", async () => {
  const db = await sqliteFixture();
  const doc = { withDB: true, scenarios: [okScenario("01", { steps: [
    { read: { name: "uiOwner", js: "state.owner" } },
    { expect: { name: "uiOwner", equals: 2, desc: "UI shows owner 2" } },
    { expect: { db: { query: "SELECT owner_id FROM views WHERE id = 1" }, path: "0.owner_id", equals: 1, desc: "DB row belongs to tenant 1 (the requirement)" } },
  ] })] };
  const taskDir = setupTask(doc);
  const { results } = await runOnce(taskDir, doc, { owner: 2 }, { db });
  assert.equal(results[0].status, "fail");
  assert.equal(results[0].expects[0].passed, true);
  assert.equal(results[0].expects[0].source, "ui");
  assert.equal(results[0].expects[1].passed, false);
  assert.equal(results[0].expects[1].source, "db");
});

test("database guard: reads only unless the caller writes with writes: true; masking hides listed columns", async () => {
  const db = await openDb({ engine: "sqlite", file: ":memory:", mask: ["email"] }, { writes: false });
  await assert.rejects(db.query("DELETE FROM x"), /refused: scenarios only read/);
  await assert.rejects(db.query("DELETE FROM x", [], { write: true }), /has no "writes": true/);
  db.close();
  assert.deepEqual(maskRows([{ id: 1, email: "a@b", phone: null }], ["email", "phone"]), [{ id: 1, email: "***", phone: null }]);
  assert.equal(isReadQuery("  select 1"), true);
  assert.equal(isReadQuery("UPDATE t SET a = 1"), false);
  await assert.rejects(openDb({ engine: "postgres" }), /has no adapter here/);
});

test("mysql adapter: literals are escaped into SET, the statement is a constant, --xml is parsed with NULL kept apart from 'NULL'", () => {
  assert.equal(escapeLiteral("O'Brien \\ \n"), "'O\\'Brien \\\\ \\n'");
  assert.equal(escapeLiteral(null), "NULL");
  assert.equal(escapeLiteral(true), "1");
  const script = buildScript("SELECT * FROM t WHERE a = ? AND b = ?", ["x'; DROP TABLE t; --", 5]);
  assert.match(script, /^SET SESSION TRANSACTION READ ONLY;/);
  assert.match(script, /SET @p0 = 'x\\'; DROP TABLE t; --';/);
  assert.match(script, /PREPARE qa_stmt FROM 'SELECT \* FROM t WHERE a = \? AND b = \?';/);
  assert.match(script, /EXECUTE qa_stmt USING @p0, @p1;/);
  assert.doesNotMatch(buildScript("INSERT INTO t VALUES (1)", [], { write: true }), /READ ONLY/);
  assert.match(buildScript("INSERT INTO t VALUES (1)", [], { write: true }), /LAST_INSERT_ID\(\) AS insertId/);
  const xml = `<?xml version="1.0"?>
<resultset statement="SET @p0 = 1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"></resultset>
<resultset statement="EXECUTE qa_stmt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <row>
\t<field name="id">1</field>
\t<field name="name" xsi:nil="true" />
\t<field name="label">NULL</field>
\t<field name="html">a &lt;b&gt; &amp; &#39;c&#39;</field>
  </row>
</resultset>`;
  assert.deepEqual(parseXml(xml), [{ id: "1", name: null, label: "NULL", html: "a <b> & 'c'" }]);
});

// ------------------------------------------------------- check-evidence

test("check-evidence: accepts a consistent report, refuses a wrong (earlier) mark, a missing picture, an unmarked interrupted run and a leftover ledger", async () => {
  const doc = { scenarios: [okScenario("01"), okScenario("02", { given: [{ js: "false", truthy: true, desc: "never" }] })] };
  const taskDir = setupTask(doc);
  const { run } = await runOnce(taskDir, doc, {});
  const report = (result01, extra = "") => `# QA — demo\n\nRun ${run.runId} on http://app.${extra}\n\n| # | Scenario | Result |\n| --- | --- | --- |\n| 01 | S 01 | ${result01} |\n| 02 | S 02 | BLOCKED |\n\n## Not run\n\n- **02** — precondition never held.\n`;
  const file = path.join(taskDir, "report.md");
  const check = () => spawnSync("node", [path.join(HERE, "check-evidence.js"), file], { encoding: "utf8" });
  fs.writeFileSync(file, report("PASS"));
  let r = check();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`run ${run.runId}`));
  // "(earlier)" on a row this run executed
  fs.writeFileSync(file, report("PASS (earlier)"));
  r = check();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /marked "\(earlier\)" but run .* executed it/);
  // a row from an earlier run without the mark
  const idx = loadIndex(taskDir);
  idx.scenarios[0].runId = "20200101-000000-dead";
  writeJsonAtomic(path.join(taskDir, "results.json"), idx);
  fs.writeFileSync(file, report("PASS"));
  r = check();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /last executed by run 20200101-000000-dead, not the latest .* "PASS \(earlier\)"/);
  fs.writeFileSync(file, report("PASS (earlier)"));
  r = check();
  assert.equal(r.status, 0, r.stderr);
  idx.scenarios[0].runId = run.runId;
  writeJsonAtomic(path.join(taskDir, "results.json"), idx);
  fs.writeFileSync(file, report("PASS"));
  // a missing picture
  fs.unlinkSync(path.join(taskDir, idx.scenarios[0].screenshot));
  r = check();
  assert.match(r.stderr, /01 \(S 01\): no screenshot/);
  fs.writeFileSync(path.join(taskDir, idx.scenarios[0].screenshot), Buffer.alloc(6000, 1));
  // an interrupted run has to be named as such
  patchRun(taskDir, { status: "interrupted" });
  r = check();
  assert.match(r.stderr, /rows from it are partial; the report has to say the run was interrupted/);
  fs.writeFileSync(file, report("PASS", ` The run ${run.runId} was interrupted after 02.`));
  r = check();
  assert.equal(r.status, 0, r.stderr);
  // a ledger still listing rows has to be mentioned
  writeJsonAtomic(path.join(taskDir, "records.json"), { prepared: [], records: [{ runId: run.runId, kind: "x", id: 1 }], failures: [] });
  r = check();
  assert.match(r.stderr, /records\.json exists, so test data is still in the database/);
  fs.writeFileSync(file, report("PASS", ` The run ${run.runId} was interrupted after 02.\n\n## Test data\n\nOne record is still there, see records.json; --cleanup removes it.`));
  r = check();
  assert.equal(r.status, 0, r.stderr);
  // a fourth column is refused: an earlier run is marked in the Result cell
  fs.writeFileSync(file, report("PASS", ` The run ${run.runId} was interrupted after 02.\n\n## Test data\n\nrecords.json`).replace("| # | Scenario | Result |", "| # | Scenario | Result | Run |"));
  r = check();
  assert.match(r.stderr, /the table has a "Run" column/);
});

test("the CLI validates before touching a browser and explains the file", () => {
  const taskDir = tmp();
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify({ scenarios: [{ n: "01", slug: "a", title: "a", steps: [{ click: "#x", fill: {} }], caption: {} }] }));
  const r = spawnSync("node", [path.join(HERE, "run-scenarios.mjs"), "--base-url", "http://localhost:1", "--task-dir", taskDir], { encoding: "utf8", cwd: taskDir });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /one operation per step/);
  assert.match(r.stderr, /no expect step and not manual/);
  assert.match(r.stderr, /caption has no "target"/);
});

// ------------------------------------------------------- review follow-ups

test("a scenario read cannot write, even as WITH … UPDATE … RETURNING on a connection that setups may write through", async () => {
  const db = await sqliteFixture();
  // fixture writes work on this connection
  await db.query("INSERT INTO views (name, owner_id) VALUES ('w', 1)", [], { write: true });
  await assert.rejects(
    db.query("WITH x AS (SELECT 1) UPDATE views SET owner_id = 9 WHERE id = 1 RETURNING id"),
    /readonly|read-only|query_only|refused/i,
  );
  const rows = await db.query("SELECT owner_id FROM views WHERE id = 1");
  assert.equal(rows[0].owner_id, 2, "the row is unchanged");
  // and through the runner's wrapper, on a file, with writes allowed for fixtures
  const file = path.join(tmp(), "app.db");
  const { open } = await import("./lib/db-sqlite.mjs");
  const seed = open({ file, readOnly: false });
  seed.raw("CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER); INSERT INTO t (v) VALUES (1)");
  seed.close();
  const wrapped = await openDb({ engine: "sqlite", file, writes: true }, { writes: true });
  await assert.rejects(wrapped.query("WITH x AS (SELECT 1) UPDATE t SET v = 9 WHERE id = 1 RETURNING id"), /readonly|query_only|refused/i);
  assert.equal((await wrapped.query("SELECT v FROM t WHERE id = 1"))[0].v, 1);
  assert.equal((await wrapped.query("UPDATE t SET v = 2 WHERE id = 1", [], { write: true }))[0].changes, 1, "a fixture write still works");
  wrapped.close();
});

test("a record created through the UI is in the ledger before the step that errors, so cleanup finds it", async () => {
  const doc = { scenarios: [okScenario("01", {
    steps: [
      { goto: "/" },
      { read: { name: "newId", js: "state.created" } },
      { wait: "#missing-button" },
      { expect: { js: "1", equals: 1 } },
    ],
    leaves: [{ kind: "view", id: "${newId}", cleanup: { shell: "echo cleaned ${id} >> \"$QA_CLEAN_LOG\"" } }],
  })] };
  const taskDir = setupTask(doc);
  const log = path.join(taskDir, "clean.log");
  process.env.QA_CLEAN_LOG = log;
  const { results, run } = await runOnce(taskDir, doc, { created: 77, hidden: ["#missing-button"] });
  assert.equal(results[0].status, "error");
  assert.match(fs.readFileSync(log, "utf8"), /cleaned 77/);
  const meta = loadIndex(taskDir).run;
  assert.equal(meta.data.records, 1);
  assert.equal(meta.data.cleaned, 1);
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")));
});

test("an error picture is replaced when a later run re-executes the scenario, and refused while the row is still an error", async () => {
  const doc = { scenarios: [okScenario("01"), okScenario("02", { steps: [{ wait: "#gone" }, { expect: { js: "1", equals: 1 } }] })] };
  const taskDir = setupTask(doc);
  const runA = await runOnce(taskDir, doc, { hidden: ["#gone"] });
  assert.equal(runA.results[1].status, "error");
  const shots = path.join(taskDir, "screenshots");
  assert.ok(fs.existsSync(path.join(shots, "02-s02.error.jpg")));
  const file = path.join(taskDir, "report.md");
  fs.writeFileSync(file, `# QA\n\nRun ${runA.run.runId} on http://app.\n\n| # | Scenario | Result |\n| --- | --- | --- |\n| 01 | S 01 | PASS |\n| 02 | S 02 | PASS |\n`);
  const r1 = spawnSync("node", [path.join(HERE, "check-evidence.js"), file], { encoding: "utf8" });
  assert.equal(r1.status, 1);
  assert.match(r1.stderr, /02-s02\.error\.jpg: an errored scenario/);
  assert.match(r1.stderr, /still "error" in results\.json/);
  const runB = await runOnce(taskDir, doc, {}, { only: ["02"] });
  assert.equal(runB.results[0].status, "pass");
  assert.deepEqual(fs.readdirSync(shots).sort(), ["01-s01.jpg", "02-s02.jpg"], "the error picture is gone, one picture per number");
  fs.writeFileSync(file, `# QA\n\nRun ${runB.run.runId} on http://app; 01 from run ${runA.run.runId}.\n\n| # | Scenario | Result |\n| --- | --- | --- |\n| 01 | S 01 | PASS (earlier) |\n| 02 | S 02 | PASS |\n`);
  const r2 = spawnSync("node", [path.join(HERE, "check-evidence.js"), file], { encoding: "utf8" });
  assert.equal(r2.status, 0, r2.stderr);
});

/** The CLI as a child process. Async on purpose: some of these children talk
 *  to a stub server running here, and spawnSync would block it from answering. */
const cli = (taskDir, ...args) =>
  new Promise((resolve) => {
    const child = spawn("node", [path.join(HERE, "run-scenarios.mjs"), ...args, "--task-dir", taskDir], { cwd: taskDir, encoding: "utf8" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });

function handDrivenRun(taskDir, { runId, baseUrl, doc }) {
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify(doc));
  fs.mkdirSync(path.join(taskDir, "screenshots"), { recursive: true });
  fs.writeFileSync(path.join(taskDir, "screenshots", "01-s01.jpg"), Buffer.alloc(6000, 1));
  writeJsonAtomic(path.join(taskDir, "results.json"), {
    runId,
    run: { runId, status: "manual", startedAt: new Date().toISOString(), finishedAt: null, driver: "chrome", baseUrl },
    scenarios: [{
      n: "01", slug: "s01", title: "S 01", status: "pass", runId, completed: true,
      expects: [{ desc: "the row is listed", source: "ui", passed: true, actual: 1, expected: 1 }],
      screenshot: "screenshots/01-s01.jpg",
    }],
  });
}

test("--cleanup does not send an earlier run's record to the environment the latest run used", async () => {
  const a = await stubApi([11]);
  const b = await stubApi([11]);
  const taskDir = tmp();
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify({ scenarios: [okScenario("01")] }));
  writeJsonAtomic(path.join(taskDir, "results.json"), {
    runId: "20260102-000000-bbbb",
    run: { runId: "20260102-000000-bbbb", status: "completed", baseUrl: b.baseUrl, data: { records: 0 } },
    scenarios: [],
  });
  writeJsonAtomic(path.join(taskDir, "records.json"), {
    prepared: [],
    records: [{ runId: "20260101-000000-aaaa", kind: "view", id: 11, via: "http", baseUrl: a.baseUrl, cleanup: DELETE_VIEW }],
    failures: [],
  });
  const r = await cli(taskDir, "--cleanup");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual([...a.store], [], "removed where it was made");
  assert.deepEqual([...b.store], [11], "the latest run's environment is untouched");
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")));
  a.close();
  b.close();
});

test("--finish cleans through one ledger: what it removed does not come back", async () => {
  const a = await stubApi([21]);
  const taskDir = tmp();
  const runId = "20260103-000000-cccc";
  const flag = path.join(taskDir, "unloaded");
  handDrivenRun(taskDir, { runId, baseUrl: a.baseUrl, doc: { scenarios: [okScenario("01", { uses: ["seed"] })], setups: { seed: { prepare: [{ shell: "true" }], cleanup: [{ shell: `touch ${flag}` }] } } } });
  writeJsonAtomic(path.join(taskDir, "records.json"), {
    prepared: [{ name: "seed", runId, baseUrl: a.baseUrl }],
    records: [{ runId, kind: "view", id: 21, via: "http", baseUrl: a.baseUrl, cleanup: DELETE_VIEW }],
    failures: [],
  });
  const r = await cli(taskDir, "--finish");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual([...a.store], [], "the record was deleted");
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")), "and was not written back by a stale snapshot");
  assert.ok(fs.existsSync(flag), "the setup's cleanup block ran too");
  const data = loadIndex(taskDir).run.data;
  assert.equal(data.cleaned, 1);
  assert.deepEqual(data.failures, []);
  a.close();
});

test("--finish drops a prepared setup that owes no cleanup instead of keeping the ledger alive", async () => {
  const taskDir = tmp();
  const runId = "20260105-000000-eeee";
  handDrivenRun(taskDir, { runId, baseUrl: "http://app", doc: { scenarios: [okScenario("01", { uses: ["seed"] })], setups: { seed: { prepare: [{ shell: "true" }] } } } });
  writeJsonAtomic(path.join(taskDir, "records.json"), { prepared: [{ name: "seed", runId, baseUrl: "http://app" }], records: [], failures: [] });
  const r = await cli(taskDir, "--finish");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")), "nothing owed and nothing left, so no file");
});

test("--cleanup keeps the run's created count and adds to what earlier walks removed", async () => {
  const a = await stubApi([31]);
  const taskDir = tmp();
  const runId = "20260106-000000-ffff";
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify({ scenarios: [okScenario("01")] }));
  writeJsonAtomic(path.join(taskDir, "results.json"), {
    runId,
    // the run created two records and an earlier walk removed one of them
    run: { runId, status: "completed", baseUrl: a.baseUrl, data: { records: 2, cleaned: 1, skipped: 0, kept: false, failures: [] } },
    scenarios: [],
  });
  writeJsonAtomic(path.join(taskDir, "records.json"), {
    prepared: [],
    records: [{ runId, kind: "view", id: 31, via: "http", baseUrl: a.baseUrl, cleanup: DELETE_VIEW }],
    failures: [],
  });
  const r = await cli(taskDir, "--cleanup");
  assert.equal(r.status, 0, r.stderr);
  const data = loadIndex(taskDir).run.data;
  assert.equal(data.records, 2, "how many the run created is a fact about the run, not a count of what is left");
  assert.equal(data.cleaned, 2, "this walk adds to what the earlier one removed");
  assert.equal(data.kept, false);
  assert.deepEqual(data.failures, []);
  a.close();
});

test("--finish runs a setup's cleanup block even when the setup recorded nothing", async () => {
  const taskDir = tmp();
  const runId = "20260104-000000-dddd";
  const flag = path.join(taskDir, "unloaded");
  handDrivenRun(taskDir, { runId, baseUrl: "http://app", doc: { scenarios: [okScenario("01", { uses: ["seed"] })], setups: { seed: { prepare: [{ shell: "true" }], cleanup: [{ shell: `touch ${flag}` }] } } } });
  writeJsonAtomic(path.join(taskDir, "records.json"), { prepared: [{ name: "seed", runId, baseUrl: "http://app" }], records: [], failures: [] });
  const r = await cli(taskDir, "--finish");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(flag), "a teardown with no records of its own is still owed");
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")));
});

test("--cleanup with a browser-session step: refused with the way out when no QA window is open", () => {
  const taskDir = tmp();
  const doc = { setups: { s: { prepare: [{ http: { method: "POST", url: "/x", session: "browser", record: { kind: "x", id: "json.id", cleanup: { http: { method: "DELETE", url: "/x/${id}", session: "browser" } } } } }] } }, scenarios: [okScenario("01", { uses: ["s"] })] };
  fs.writeFileSync(path.join(taskDir, "scenarios.json"), JSON.stringify(doc));
  const run = startRun(taskDir, { baseUrl: "http://127.0.0.1:1", scope: "all" });
  writeJsonAtomic(path.join(taskDir, "records.json"), { prepared: [{ name: "s", runId: run.runId }], records: [{ runId: run.runId, kind: "x", id: 5, via: "http", cleanup: { http: { method: "DELETE", url: "/x/${id}", session: "browser" } } }], failures: [] });
  const r = spawnSync("node", [path.join(HERE, "run-scenarios.mjs"), "--task-dir", taskDir, "--cleanup", "--port", "1"], { encoding: "utf8", cwd: taskDir, env: { ...process.env, HOME: taskDir } });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /needs the QA window and none is open — start it with --open/);
  // With nothing to clean the command says so and creates no file.
  fs.unlinkSync(path.join(taskDir, "records.json"));
  const r2 = spawnSync("node", [path.join(HERE, "run-scenarios.mjs"), "--task-dir", taskDir, "--cleanup"], { encoding: "utf8", cwd: taskDir, env: { ...process.env, HOME: taskDir } });
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.match(r2.stdout, /nothing to clean/);
  assert.ok(!fs.existsSync(path.join(taskDir, "records.json")));
});

test("writeJsonAtomic leaves no partial file behind", () => {
  const dir = tmp();
  const f = path.join(dir, "x.json");
  writeJsonAtomic(f, { a: 1 });
  assert.deepEqual(readJson(f), { a: 1 });
  assert.deepEqual(fs.readdirSync(dir), ["x.json"]);
});
