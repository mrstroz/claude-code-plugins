#!/usr/bin/env node
/*
 * Check that every scenario in a QA report has a screenshot behind it, and that
 * every screenshot belongs to a scenario.
 *
 *   node check-evidence.js <report.md> [screenshots-dir]     (typically docs/qa/<TASK>/report.md and its screenshots/)
 *
 * Defaults the directory to ./screenshots. Exits non-zero on any problem, so it
 * can be the last thing a run does before the report is handed over.
 *
 * The whole value of the report is that each row is backed by a picture. Across
 * forty scenarios a missing file is invisible to whoever reads the report — they
 * see a row that says PASS and no way to tell nobody ever looked. That is what
 * this owns; an instruction to "remember to save each screenshot" does not.
 */
const fs = require("fs");
const path = require("path");

const NAME_RE = /^(\d{2,3})-[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png)$/;
const MIN_BYTES = 5 * 1024; // a blank or truncated capture is far below this

const [, , reportArg, dirArg] = process.argv;
if (!reportArg) {
  console.error("usage: node check-evidence.js <report.md> [screenshots-dir]");
  process.exit(2);
}
const reportPath = path.resolve(reportArg);
const shotsDir = path.resolve(dirArg || "screenshots");

if (!fs.existsSync(reportPath)) {
  console.error(`report not found: ${reportPath}`);
  process.exit(2);
}
if (!fs.existsSync(shotsDir)) {
  console.error(`screenshots directory not found: ${shotsDir}`);
  process.exit(2);
}

/** Scenario numbers from the leading column of the results table. */
function scenariosFromReport(md) {
  const found = new Map(); // number -> row text, for the message
  for (const line of md.split("\n")) {
    const m = line.match(/^\s*\|\s*(\d{2,3})\s*\|(.*)$/);
    if (!m) continue;
    found.set(m[1], m[2].split("|")[0].trim());
  }
  return found;
}

const scenarios = scenariosFromReport(fs.readFileSync(reportPath, "utf8"));
const files = fs.readdirSync(shotsDir).filter((f) => !f.startsWith("."));

const problems = [];

if (scenarios.size === 0) {
  problems.push(
    `no scenario rows found in ${path.basename(reportPath)} — the results table needs a leading "| NN |" column`,
  );
}

const byNumber = new Map();
for (const file of files) {
  const m = file.match(NAME_RE);
  if (!m) {
    problems.push(`${file}: name does not match NN-slug.jpg`);
    continue;
  }
  const size = fs.statSync(path.join(shotsDir, file)).size;
  if (size < MIN_BYTES) {
    problems.push(`${file}: only ${size} bytes — looks like an empty capture`);
  }
  if (byNumber.has(m[1])) {
    problems.push(`scenario ${m[1]}: two files claim it (${byNumber.get(m[1])}, ${file})`);
  }
  byNumber.set(m[1], file);
}

for (const [num, title] of scenarios) {
  if (!byNumber.has(num)) problems.push(`scenario ${num} (${title}): no screenshot`);
}
for (const [num, file] of byNumber) {
  if (!scenarios.has(num)) problems.push(`${file}: no row ${num} in the report`);
}

const checked = `${scenarios.size} scenario(s), ${files.length} file(s) in ${path.relative(process.cwd(), shotsDir) || "."}`;
if (problems.length === 0) {
  console.log(`evidence complete — ${checked}`);
  process.exit(0);
}
console.error(`evidence incomplete — ${checked}`);
for (const p of problems) console.error(`  - ${p}`);
process.exit(1);
