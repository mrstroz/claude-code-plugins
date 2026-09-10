#!/usr/bin/env node
/*
 * Check that a QA report, its results.json and its screenshots agree.
 *
 *   node check-evidence.js <report.md>
 *
 * Layout: docs/qa/<TASK>/report.md, results.json (the latest run under `run`,
 * one entry per scenario with the run that executed it), screenshots/ with
 * one picture per scenario, and records.json only while test data is still
 * in the database.
 *
 * Exits non-zero on any problem. What it owns:
 *   - every PASS, FAIL or CHECK row has a screenshot; every screenshot has a row
 *   - a BLOCKED row has no screenshot and is explained under Not run
 *   - a row the latest run did not execute says "(earlier)" in its Result
 *     cell, and a row it did execute does not — so a result from the build
 *     before this one cannot sit in the table looking current
 *   - the latest run id appears in the prose; a run that did not complete is
 *     named as interrupted; data kept in place, a cleanup that failed and a
 *     records.json still listing rows are all mentioned
 *   - no scenario is still `error`; a verdict that overturned the badge on
 *     the picture is said so in the prose
 *   - a runs/ directory from 0.7.0 is refused: nothing reads it any more
 */
const fs = require("fs");
const path = require("path");

const NAME_RE = /^(\d{2,3})-[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png)$/;
const ERROR_RE = /^(\d{2,3})-[a-z0-9][a-z0-9-]*\.error\.(jpg|jpeg|png)$/;
const MIN_BYTES = 5 * 1024;
const STATUSES = ["PASS", "FAIL", "CHECK", "BLOCKED"];
const WORD_OF = { pass: "PASS", fail: "FAIL", check: "CHECK", blocked: "BLOCKED", error: "ERROR" };

const [, , reportArg] = process.argv;
if (!reportArg) {
  console.error("usage: node check-evidence.js <report.md>");
  process.exit(2);
}
const reportPath = path.resolve(reportArg);
const taskDir = path.dirname(reportPath);
if (!fs.existsSync(reportPath)) {
  console.error(`report not found: ${reportPath}`);
  process.exit(2);
}

const report = fs.readFileSync(reportPath, "utf8");
const lines = report.split("\n");
const prose = lines.filter((l) => !/^\s*\|/.test(l));
const proseText = prose.join("\n");
const problems = [];
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

/** Table rows: number → { title, status, earlier }. The header names the columns. */
function rowsOf(lines) {
  const rows = new Map();
  let cols = null;
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim()).slice(1, -1);
    if (cells.length < 3) continue;
    if (/^#$/.test(cells[0])) {
      cols = { status: cells.findIndex((c) => /^result$/i.test(c)), title: cells.findIndex((c) => /^scenario$/i.test(c)) };
      if (cells.some((c) => /^run$/i.test(c))) problems.push(`the table has a "Run" column — 0.8.0 reports have three columns; a row from an earlier run says "(earlier)" in its Result cell instead`);
      continue;
    }
    if (!/^\d{2,3}$/.test(cells[0])) continue;
    const cell = cols && cols.status >= 0 ? cells[cols.status] : cells[cells.length - 1];
    const m = cell.match(/^(\S+)(?:\s+\((earlier)\))?$/);
    const title = cols && cols.title >= 0 ? cells[cols.title] : cells[1];
    if (rows.has(cells[0])) problems.push(`row ${cells[0]} appears twice in the table`);
    rows.set(cells[0], { title, status: m ? m[1] : cell, earlier: !!(m && m[2]) });
  }
  return rows;
}

const rows = rowsOf(lines);
if (rows.size === 0) problems.push(`no scenario rows found in ${path.basename(reportPath)} — the results table needs a leading "| # |" header and "| NN |" rows`);

if (fs.existsSync(path.join(taskDir, "runs"))) {
  problems.push(`runs/ exists — a 0.7.0 layout; nothing reads it since 0.8.0 and its pictures are not this report's evidence. Delete it`);
}

// ---- pictures: one per number, none for a row that did not run
const shotsDir = path.join(taskDir, "screenshots");
const byNumber = new Map();
if (!fs.existsSync(shotsDir)) problems.push(`screenshots/ not found`);
else {
  for (const file of fs.readdirSync(shotsDir).filter((f) => !f.startsWith("."))) {
    const m = file.match(NAME_RE);
    if (!m) {
      problems.push(ERROR_RE.test(file)
        ? `screenshots/${file}: an errored scenario — fix the step and re-run it, or record a verdict (run-scenarios.mjs --verdict NN=fail --reason "…")`
        : `screenshots/${file}: name does not match NN-slug.jpg`);
      continue;
    }
    const size = fs.statSync(path.join(shotsDir, file)).size;
    if (size < MIN_BYTES) problems.push(`screenshots/${file}: only ${size} bytes — looks like an empty capture`);
    if (byNumber.has(m[1])) problems.push(`screenshots: two files claim scenario ${m[1]} (${byNumber.get(m[1])}, ${file})`);
    byNumber.set(m[1], file);
  }
  for (const [num, file] of byNumber) if (!rows.has(num)) problems.push(`screenshots/${file}: no row ${num} in the report`);
}

// ---- rows against results.json
const index = readJson(path.join(taskDir, "results.json"));
if (!index) problems.push(`results.json is missing or not valid JSON`);
else if (index.latestRunId !== undefined) problems.push(`results.json is a 0.7.0 index — run the scenarios again with the 0.8.0 runner, which rewrites it`);
const entries = new Map((index?.scenarios || []).map((r) => [r.n, r]));
const latest = index?.runId || null;

for (const [num, { title, status, earlier }] of rows) {
  if (!STATUSES.includes(status)) { problems.push(`scenario ${num} (${title}): result "${status}" is not one of ${STATUSES.join(", ")}`); continue; }
  if (status === "BLOCKED") {
    if (byNumber.has(num)) problems.push(`scenario ${num} (${title}): BLOCKED but ${byNumber.get(num)} exists — a picture of a state the scenario never reached is not evidence`);
    if (!prose.some((l) => l.includes(`**${num}**`))) problems.push(`scenario ${num} (${title}): BLOCKED with no entry below the table — "**${num}** …" under Not run`);
  } else if (!byNumber.has(num)) problems.push(`scenario ${num} (${title}): no screenshot`);
  const r = entries.get(num);
  if (!r) { if (index) problems.push(`scenario ${num} (${title}): in the report but not in results.json`); continue; }
  if (r.status === "error") {
    problems.push(`scenario ${num} (${title}): still "error" in results.json — establish why the step could not run, then re-run it or record a verdict with --verdict ${num}=fail|check --reason "…"`);
  } else if (WORD_OF[r.status] !== status) {
    problems.push(`scenario ${num} (${title}): the report says ${status}, results.json says ${WORD_OF[r.status] || r.status}`);
  }
  if (r.status === "blocked" && !r.reason) problems.push(`scenario ${num} (${title}): blocked without a reason in results.json`);
  if (latest && r.runId && r.runId !== latest && !earlier) {
    problems.push(`scenario ${num} (${title}): last executed by run ${r.runId}, not the latest (${latest}) — its Result cell has to read "${status} (earlier)"`);
  } else if (latest && r.runId === latest && earlier) {
    problems.push(`scenario ${num} (${title}): marked "(earlier)" but run ${latest} executed it — drop the mark`);
  }
  if (r.screenshot && status !== "BLOCKED" && byNumber.get(num) !== path.basename(r.screenshot)) {
    problems.push(`scenario ${num} (${title}): results.json names ${r.screenshot}, screenshots/ holds ${byNumber.get(num) || "nothing"}`);
  }
  if (r.pictureSays && r.pictureSays !== status && !prose.some((l) => l.includes(num) && l.includes(r.pictureSays))) {
    problems.push(`scenario ${num} (${title}): the caption on its screenshot reads ${r.pictureSays} but the row says ${status} — the finding has to say so in one line naming ${num} and ${r.pictureSays}`);
  }
}
for (const num of entries.keys()) if (!rows.has(num)) problems.push(`scenario ${num}: in results.json but not in the report`);

// ---- the run itself
if (index?.run) {
  const run = index.run;
  if (latest && !prose.some((l) => l.includes(latest))) problems.push(`run ${latest} is not named in the prose — the opening paragraph has to say which run the table comes from`);
  if (run.status !== "completed" && !prose.some((l) => l.includes(latest) && /interrupt|przerwan/i.test(l))) {
    problems.push(`run ${latest}: status "${run.status}" — rows from it are partial; the report has to say the run was interrupted, naming ${latest}`);
  }
  if (run.data?.kept && !/--keep-data|--cleanup|\bkept\b|\bleft in place\b|\bzachowan/i.test(proseText)) {
    problems.push(`run ${latest}: test data was kept (--keep-data) and the report does not say so under Test data`);
  }
  if (run.data?.failures?.length && !/cleanup|sprząt/i.test(proseText)) {
    problems.push(`run ${latest}: ${run.data.failures.length} cleanup failure(s) — the records are still there and the report does not mention them`);
  }
}
if (fs.existsSync(path.join(taskDir, "records.json")) && !/records\.json/.test(proseText)) {
  problems.push(`records.json exists, so test data is still in the database — the report has to say so under Test data, naming records.json and --cleanup`);
}

const checked = `${rows.size} row(s)${latest ? `, run ${latest}` : ""}`;
if (problems.length === 0) {
  console.log(`evidence complete — ${checked}`);
  process.exit(0);
}
console.error(`evidence incomplete — ${checked}`);
for (const p of problems) console.error(`  - ${p}`);
process.exit(1);
