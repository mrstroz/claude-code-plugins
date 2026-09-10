#!/usr/bin/env node
/*
 * Check that a QA report, its runs and its index agree.
 *
 *   node check-evidence.js <report.md>
 *
 * Layout (0.7.0): docs/qa/<TASK>/report.md, results.json (the index), and
 * runs/<runId>/ with run.json, results.json and screenshots/. A directory with
 * no runs/ is read as the 0.6.0 layout — results.json + screenshots/ beside
 * the report — and checked as before, so an old report can still be verified.
 *
 * Exits non-zero on any problem. What it owns:
 *   - every PASS, FAIL or CHECK row names a run and has a screenshot in that
 *     run's directory; every screenshot in the runs the report cites has a row
 *   - a BLOCKED row has no screenshot and is explained under Not run
 *   - the Run column says which execution the row comes from and agrees with
 *     the index, so a result from an earlier run cannot be shown as this one's
 *   - a run cited by a row finished (status completed); a row from an
 *     interrupted run is named as such somewhere below the table
 *   - no scenario is still `error`; a rewritten scenario carries a revision
 *     for the steps as they are now; a verdict that overturned the badge on
 *     the picture is said so in the prose; data kept in place is mentioned
 */
const fs = require("fs");
const path = require("path");

const NAME_RE = /^(\d{2,3})-[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png)$/;
const RUN_ID_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;
const MIN_BYTES = 5 * 1024;
const STATUSES = ["PASS", "FAIL", "CHECK", "BLOCKED"];
const WORD_OF = { pass: "PASS", fail: "FAIL", check: "CHECK", blocked: "BLOCKED", error: "ERROR" };

const [, , reportArg, dirArg, resultsArg] = process.argv;
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
const problems = [];
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

/** Table rows: number → { title, status, run }. The header names the columns. */
function rowsOf(lines) {
  const rows = new Map();
  let cols = null;
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim()).slice(1, -1);
    if (cells.length < 3) continue;
    if (/^#$/.test(cells[0])) {
      cols = { status: cells.findIndex((c) => /^result$/i.test(c)), run: cells.findIndex((c) => /^run$/i.test(c)), title: cells.findIndex((c) => /^scenario$/i.test(c)) };
      continue;
    }
    if (!/^\d{2,3}$/.test(cells[0])) continue;
    const status = cols && cols.status >= 0 ? cells[cols.status] : cells[cells.length - 1];
    const run = cols && cols.run >= 0 ? cells[cols.run] : null;
    const title = cols && cols.title >= 0 ? cells[cols.title] : cells[1];
    if (rows.has(cells[0])) problems.push(`row ${cells[0]} appears twice in the table`);
    rows.set(cells[0], { title, status, run, hasRunColumn: !!(cols && cols.run >= 0) });
  }
  return rows;
}

const rows = rowsOf(lines);
if (rows.size === 0) problems.push(`no scenario rows found in ${path.basename(reportPath)} — the results table needs a leading "| # |" header and "| NN |" rows`);

const runsDir = path.join(taskDir, "runs");
const legacy = !fs.existsSync(runsDir);

function checkPictures(dir, expectedRows, label, allRows = expectedRows) {
  if (!fs.existsSync(dir)) { problems.push(`${label}: screenshots directory not found`); return new Map(); }
  const byNumber = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => !f.startsWith("."))) {
    const m = file.match(NAME_RE);
    if (!m) {
      const err = file.match(/^(\d{2,3})-[a-z0-9][a-z0-9-]*\.error\.(jpg|jpeg|png)$/);
      // An error picture of a scenario a later run re-executed is history —
      // the row cites the later run — and stays where it is. One for a
      // scenario the report cites from this run is an undiagnosed error.
      if (err && !expectedRows.has(err[1])) continue;
      problems.push(err
        ? `${label}/${file}: an errored scenario — fix the step and re-run it, or record a verdict (run-scenarios.mjs --verdict NN=fail --reason "…")`
        : `${label}/${file}: name does not match NN-slug.jpg`);
      continue;
    }
    // Same for a regular picture: only the rows citing this run are held against it.
    if (!expectedRows.has(m[1]) && allRows.has(m[1])) continue;
    const size = fs.statSync(path.join(dir, file)).size;
    if (size < MIN_BYTES) problems.push(`${label}/${file}: only ${size} bytes — looks like an empty capture`);
    if (byNumber.has(m[1])) problems.push(`${label}: two files claim scenario ${m[1]} (${byNumber.get(m[1])}, ${file})`);
    byNumber.set(m[1], file);
  }
  // A picture of a scenario the report no longer lists is a result that
  // vanished. A picture of a scenario a later run re-executed is history and
  // stays where it is.
  for (const [num, file] of byNumber) if (!allRows.has(num)) problems.push(`${label}/${file}: no row ${num} in the report`);
  return byNumber;
}

function checkEntry(num, title, status, r, resultsName) {
  if (r.status === "error") {
    problems.push(`scenario ${num} (${title}): still "error" in ${resultsName} — establish why the step could not run, then re-run it or record a verdict with --verdict ${num}=fail|check --reason "…"`);
  } else if (WORD_OF[r.status] !== status) {
    problems.push(`scenario ${num} (${title}): the report says ${status}, ${resultsName} says ${WORD_OF[r.status] || r.status}`);
  }
  if (r.status === "blocked" && !r.reason) problems.push(`scenario ${num} (${title}): blocked without a reason in ${resultsName}`);
  const rewritten = (r.history || []).some((h) => h.stepsHash && (h.hashVersion ?? 1) === (r.hashVersion ?? 1) && h.stepsHash !== r.stepsHash);
  if (rewritten && !r.revision) {
    problems.push(`scenario ${num} (${title}): its steps were rewritten since an earlier run and the scenario has no "revision" — say what the earlier check got wrong, so the report can tell a corrected check from a fixed bug`);
  } else if (rewritten && r.revisionHash && r.revisionHash !== r.stepsHash) {
    problems.push(`scenario ${num} (${title}): its "revision" was written for an earlier version of the steps and the steps changed again — a second rewrite needs its own sentence`);
  }
  if (r.pictureSays && r.pictureSays !== status && !prose.some((l) => l.includes(num) && l.includes(r.pictureSays))) {
    problems.push(`scenario ${num} (${title}): the caption on its screenshot reads ${r.pictureSays} but the row says ${status} — the finding has to say so in one line naming ${num} and ${r.pictureSays}`);
  }
}

if (legacy) {
  // ---- 0.6.0: one results.json and screenshots/ beside the report
  const shotsDir = path.resolve(dirArg || path.join(taskDir, "screenshots"));
  const resultsPath = resultsArg ? path.resolve(resultsArg) : path.join(taskDir, "results.json");
  const byNumber = checkPictures(shotsDir, rows, path.relative(process.cwd(), shotsDir) || "screenshots");
  for (const [num, { title, status }] of rows) {
    if (!STATUSES.includes(status)) { problems.push(`scenario ${num} (${title}): result "${status}" is not one of ${STATUSES.join(", ")}`); continue; }
    if (status === "BLOCKED") {
      if (byNumber.has(num)) problems.push(`scenario ${num} (${title}): BLOCKED but ${byNumber.get(num)} exists — remove it or change the row`);
      if (!prose.some((l) => l.includes(`**${num}**`))) problems.push(`scenario ${num} (${title}): BLOCKED with no entry below the table — "**${num}** …" under Not run`);
    } else if (!byNumber.has(num)) problems.push(`scenario ${num} (${title}): no screenshot`);
  }
  const results = fs.existsSync(resultsPath) ? readJson(resultsPath) : null;
  if (fs.existsSync(resultsPath) && !results) problems.push(`${path.basename(resultsPath)}: not valid JSON`);
  if (results) {
    const entries = new Map((results.scenarios || []).map((r) => [r.n, r]));
    for (const [num, { title, status }] of rows) {
      const r = entries.get(num);
      if (!r) { problems.push(`scenario ${num} (${title}): in the report but not in results.json`); continue; }
      checkEntry(num, title, status, r, "results.json");
    }
    for (const num of entries.keys()) if (!rows.has(num)) problems.push(`scenario ${num}: in results.json but not in the report`);
  }
} else {
  // ---- 0.7.0: index + runs/<runId>/
  const index = readJson(path.join(taskDir, "results.json"));
  if (!index) problems.push(`results.json (the index) is missing or not valid JSON`);
  const entries = new Map((index?.scenarios || []).map((r) => [r.n, r]));
  const runsCited = new Set();
  for (const [num, { title, status, run, hasRunColumn }] of rows) {
    if (!STATUSES.includes(status)) { problems.push(`scenario ${num} (${title}): result "${status}" is not one of ${STATUSES.join(", ")}`); continue; }
    if (!hasRunColumn) { problems.push(`the table has no "Run" column — every row has to say which run it comes from (| # | Scenario | Result | Run |)`); break; }
    const runId = (run || "").match(/\d{8}-\d{6}-[0-9a-f]{4}/)?.[0] || null;
    const r = entries.get(num);
    if (!r) { problems.push(`scenario ${num} (${title}): in the report but not in the index`); continue; }
    if (!runId) problems.push(`scenario ${num} (${title}): Run column "${run}" names no run id`);
    else if (runId !== r.sourceRunId) problems.push(`scenario ${num} (${title}): the report says run ${runId}, the index says its last execution was ${r.sourceRunId}`);
    if (runId) runsCited.add(runId);
    checkEntry(num, title, status, r, "the index");
    if (status === "BLOCKED") {
      if (r.screenshot && fs.existsSync(path.join(taskDir, r.screenshot))) problems.push(`scenario ${num} (${title}): BLOCKED but ${r.screenshot} exists — a picture of a state the scenario never reached is not evidence`);
      if (!prose.some((l) => l.includes(`**${num}**`))) problems.push(`scenario ${num} (${title}): BLOCKED with no entry below the table — "**${num}** …" under Not run`);
    } else {
      if (!r.screenshot) problems.push(`scenario ${num} (${title}): no screenshot in the index`);
      else {
        const abs = path.join(taskDir, r.screenshot);
        if (!fs.existsSync(abs)) problems.push(`scenario ${num} (${title}): ${r.screenshot} not found`);
        else if (runId && !r.screenshot.includes(`runs/${runId}/`)) problems.push(`scenario ${num} (${title}): ${r.screenshot} is not in run ${runId}`);
      }
    }
  }
  for (const num of entries.keys()) if (!rows.has(num)) problems.push(`scenario ${num}: in the index but not in the report`);
  for (const runId of runsCited) {
    const dir = path.join(runsDir, runId);
    const meta = readJson(path.join(dir, "run.json"));
    if (!meta) { problems.push(`run ${runId}: no run.json under runs/`); continue; }
    if (meta.status !== "completed" && !prose.some((l) => l.includes(runId) && /interrupt/i.test(l))) {
      problems.push(`run ${runId}: status "${meta.status}" — rows from it are partial; the report has to say the run was interrupted, naming ${runId}`);
    }
    if (meta.data?.kept && !/\bkept\b|\bleft in place\b|\bzachowan/i.test(prose.join("\n"))) {
      problems.push(`run ${runId}: test data was kept (--keep-data) and the report does not say so under Test data`);
    }
    if (meta.data?.failures?.length && !/cleanup|sprząt/i.test(prose.join("\n"))) {
      problems.push(`run ${runId}: ${meta.data.failures.length} cleanup failure(s) — the records are still there and the report does not mention them`);
    }
    const expected = new Map([...rows].filter(([, v]) => (v.run || "").includes(runId) && v.status !== "BLOCKED"));
    checkPictures(path.join(dir, "screenshots"), expected, `runs/${runId}/screenshots`, rows);
  }
  if (!prose.some((l) => runsCited.size === 0 || [...runsCited].some((id) => l.includes(id)))) {
    problems.push(`no run id appears in the prose — the opening paragraph has to name the run(s) the table comes from`);
  }
}

const checked = `${rows.size} row(s), ${legacy ? "0.6.0 layout" : "runs/ layout"}`;
if (problems.length === 0) {
  console.log(`evidence complete — ${checked}`);
  process.exit(0);
}
console.error(`evidence incomplete — ${checked}`);
for (const p of problems) console.error(`  - ${p}`);
process.exit(1);
