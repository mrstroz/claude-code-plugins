#!/usr/bin/env node
/*
 * Check that a QA report, its screenshots and its results file agree.
 *
 *   node check-evidence.js <report.md> [screenshots-dir] [results.json]
 *
 * Defaults: screenshots/ and results.json next to the report. The results file
 * is optional — a run driven through the Chrome extension has none — and when
 * it is missing only the report and the pictures are compared. Exits non-zero
 * on any problem, so it can be the last thing a run does before handover.
 *
 * What it owns:
 *   - every PASS, FAIL or CHECK row has a screenshot, and every screenshot has
 *     a row. Across forty scenarios a missing file is invisible to whoever reads
 *     the report — they see a row that says PASS and no way to tell nobody looked
 *   - a BLOCKED row has no screenshot (a picture of a state the scenario never
 *     reached is not evidence) and is explained somewhere below the table
 *   - with results.json: the status in each row is the status the runner
 *     recorded; no scenario is still `error` (that is a step nobody diagnosed —
 *     fix it and re-run, or record a verdict); a scenario rewritten since an
 *     earlier run carries a revision written for the steps as they are now;
 *     a row whose verdict differs from the badge on its picture says so
 */
const fs = require("fs");
const path = require("path");

const NAME_RE = /^(\d{2,3})-[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png)$/;
const MIN_BYTES = 5 * 1024; // a blank or truncated capture is far below this
const STATUSES = ["PASS", "FAIL", "CHECK", "BLOCKED"];

const [, , reportArg, dirArg, resultsArg] = process.argv;
if (!reportArg) {
  console.error("usage: node check-evidence.js <report.md> [screenshots-dir] [results.json]");
  process.exit(2);
}
const reportPath = path.resolve(reportArg);
const shotsDir = path.resolve(dirArg || path.join(path.dirname(reportPath), "screenshots"));
const resultsPath = resultsArg ? path.resolve(resultsArg) : path.join(path.dirname(reportPath), "results.json");

if (!fs.existsSync(reportPath)) {
  console.error(`report not found: ${reportPath}`);
  process.exit(2);
}
if (!fs.existsSync(shotsDir)) {
  console.error(`screenshots directory not found: ${shotsDir}`);
  process.exit(2);
}

const report = fs.readFileSync(reportPath, "utf8");
const lines = report.split("\n");
const problems = [];

/** Rows of the results table: number → { title, status }, from "| NN | title | STATUS |". */
function rowsOf(lines) {
  const rows = new Map();
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    // "| 01 | Baseline | PASS |" splits into ["", "01", "Baseline", "PASS", ""]
    if (cells.length < 4 || !/^\d{2,3}$/.test(cells[1])) continue;
    const status = cells[cells.length - 2];
    if (rows.has(cells[1])) problems.push(`row ${cells[1]} appears twice in the table`);
    rows.set(cells[1], { title: cells[2], status });
  }
  return rows;
}

const rows = rowsOf(lines);
if (rows.size === 0) {
  problems.push(`no scenario rows found in ${path.basename(reportPath)} — the results table needs a leading "| NN |" column`);
}

// ---- rows vs. pictures

const files = fs.readdirSync(shotsDir).filter((f) => !f.startsWith("."));
const byNumber = new Map();
for (const file of files) {
  const m = file.match(NAME_RE);
  if (!m) {
    problems.push(
      /\.error\.(jpg|jpeg|png)$/.test(file)
        ? `${file}: an errored scenario — fix the step and re-run it, or record a verdict (run-scenarios.mjs --verdict NN=fail --reason "…")`
        : `${file}: name does not match NN-slug.jpg`,
    );
    continue;
  }
  const size = fs.statSync(path.join(shotsDir, file)).size;
  if (size < MIN_BYTES) problems.push(`${file}: only ${size} bytes — looks like an empty capture`);
  if (byNumber.has(m[1])) problems.push(`scenario ${m[1]}: two files claim it (${byNumber.get(m[1])}, ${file})`);
  byNumber.set(m[1], file);
}

const prose = lines.filter((l) => !/^\s*\|/.test(l));
for (const [num, { title, status }] of rows) {
  if (!STATUSES.includes(status)) {
    problems.push(`scenario ${num} (${title}): result "${status}" is not one of ${STATUSES.join(", ")}`);
    continue;
  }
  if (status === "BLOCKED") {
    if (byNumber.has(num)) problems.push(`scenario ${num} (${title}): BLOCKED but ${byNumber.get(num)} exists — a picture of a state the scenario never reached is not evidence; remove it or change the row`);
    if (!prose.some((l) => l.includes(`**${num}**`))) problems.push(`scenario ${num} (${title}): BLOCKED with no entry below the table — say what blocked it, as "**${num}** …" under Not run`);
  } else if (!byNumber.has(num)) {
    problems.push(`scenario ${num} (${title}): no screenshot`);
  }
}
for (const [num, file] of byNumber) {
  if (!rows.has(num)) problems.push(`${file}: no row ${num} in the report`);
}

// ---- rows vs. results.json

let results = null;
if (fs.existsSync(resultsPath)) {
  try {
    results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  } catch (e) {
    problems.push(`${path.basename(resultsPath)}: not valid JSON (${e.message})`);
  }
}
if (results) {
  const entries = new Map((results.scenarios || []).map((r) => [r.n, r]));
  const wordOf = { pass: "PASS", fail: "FAIL", check: "CHECK", blocked: "BLOCKED", error: "ERROR" };
  for (const [num, { title, status }] of rows) {
    const r = entries.get(num);
    if (!r) { problems.push(`scenario ${num} (${title}): in the report but not in ${path.basename(resultsPath)}`); continue; }
    if (r.status === "error") {
      problems.push(`scenario ${num} (${title}): still "error" in the results — establish why the step could not run, then re-run it or record a verdict with --verdict ${num}=fail|check --reason "…"`);
    } else if (wordOf[r.status] !== status) {
      problems.push(`scenario ${num} (${title}): the report says ${status}, the results say ${wordOf[r.status] || r.status}`);
    }
    if (r.status === "blocked" && !r.reason) problems.push(`scenario ${num} (${title}): blocked without a reason in the results`);
    const rewritten = (r.history || []).some((h) => h.stepsHash && h.stepsHash !== r.stepsHash);
    if (rewritten && !r.revision) {
      problems.push(`scenario ${num} (${title}): its steps were rewritten since an earlier run and the scenario has no "revision" — say what the earlier check got wrong, so the report can tell a corrected check from a fixed bug`);
    } else if (rewritten && r.revisionHash && r.revisionHash !== r.stepsHash) {
      problems.push(`scenario ${num} (${title}): its "revision" was written for an earlier version of the steps and the steps changed again — a second rewrite needs its own sentence`);
    }
    // A verdict changes the row, not the badge drawn on the picture. The reader
    // who opens the file sees the badge; the report has to say the verdict wins.
    if (r.pictureSays && r.pictureSays !== status && !prose.some((l) => l.includes(num) && l.includes(r.pictureSays))) {
      problems.push(`scenario ${num} (${title}): the caption on its screenshot reads ${r.pictureSays} but the row says ${status} — the finding has to say so in one line naming ${num} and ${r.pictureSays}, so the picture is read as superseded by the verdict`);
    }
  }
  for (const num of entries.keys()) {
    if (!rows.has(num)) problems.push(`scenario ${num}: in ${path.basename(resultsPath)} but not in the report`);
  }
}

const checked = `${rows.size} row(s), ${files.length} file(s) in ${path.relative(process.cwd(), shotsDir) || "."}${results ? `, ${path.basename(resultsPath)}` : ""}`;
if (problems.length === 0) {
  console.log(`evidence complete — ${checked}`);
  process.exit(0);
}
console.error(`evidence incomplete — ${checked}`);
for (const p of problems) console.error(`  - ${p}`);
process.exit(1);
