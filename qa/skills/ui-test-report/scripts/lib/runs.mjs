/*
 * The task directory on disk: docs/qa/<TASK>/ holds scenarios.json, one
 * results.json, one screenshots/ directory and, only while something is left
 * in the database, records.json. results.json carries the metadata of the
 * latest run under `run` and one entry per scenario; a scenario the latest run
 * did not execute keeps its earlier entry with its own runId, which is what
 * the report's "(earlier)" mark comes from. A re-run overwrites the entry and
 * the picture of every scenario it executed and leaves the rest untouched.
 *
 * Files are written atomically (tmp + rename) after every scenario, so a run
 * killed half way leaves a readable record with status "interrupted" rather
 * than a truncated JSON.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const INDEX_FILE = "results.json";
export const LEDGER_FILE = "records.json";
export const SHOTS_DIR = "screenshots";

export function runnerVersion() {
  try {
    const p = path.join(HERE, "..", "..", "..", "..", ".claude-plugin", "plugin.json");
    return JSON.parse(fs.readFileSync(p, "utf8")).version || null;
  } catch {
    return null;
  }
}

/** 20260910-103212-9f3a: sortable by time, unique enough for one directory. */
export function newRunId(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `${stamp}-${crypto.randomBytes(2).toString("hex")}`;
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

/**
 * What the working tree says about the code — and only that. The app at
 * baseUrl may be a container built an hour ago or a remote deployment; the
 * local HEAD is evidence about the checkout, not about the build under test,
 * and the note says so in the file itself.
 */
export function gitBuildInfo(cwd) {
  const git = (...args) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  try {
    const localCommit = git("rev-parse", "HEAD");
    const branch = git("rev-parse", "--abbrev-ref", "HEAD");
    const changed = git("status", "--porcelain").split("\n").filter(Boolean);
    return {
      branch,
      localCommit,
      dirty: changed.length > 0,
      changedFiles: changed.length,
      note: "local working tree at the time of the run; not verified as the build running at baseUrl",
    };
  } catch {
    return null;
  }
}

const indexFile = (taskDir) => path.join(taskDir, INDEX_FILE);

/** The index, or an empty one when there is no file yet. */
export function loadIndex(taskDir) {
  return readJson(indexFile(taskDir)) || { runId: null, run: null, scenarios: [] };
}

/** Start a run: a fresh id, `run` in the index set to running, screenshots/ present. */
export function startRun(taskDir, meta = {}, { runId = newRunId() } = {}) {
  const index = loadIndex(taskDir);
  index.runId = runId;
  index.run = { runId, status: "running", startedAt: new Date().toISOString(), finishedAt: null, ...meta };
  index.updatedAt = index.run.startedAt;
  fs.mkdirSync(path.join(taskDir, SHOTS_DIR), { recursive: true });
  writeJsonAtomic(indexFile(taskDir), index);
  return { runId, dir: taskDir, shotsDir: path.join(taskDir, SHOTS_DIR) };
}

/** Merge fields into the latest run's metadata. */
export function patchRun(taskDir, patch) {
  const index = loadIndex(taskDir);
  index.run = { ...(index.run || {}), ...patch };
  index.updatedAt = new Date().toISOString();
  writeJsonAtomic(indexFile(taskDir), index);
  return index.run;
}

/**
 * Write this run's entries into the index. An entry executed now replaces the
 * previous one for that number; entries this run did not execute stay as they
 * were, with their own runId.
 */
export function updateIndex(taskDir, runId, entries) {
  const index = loadIndex(taskDir);
  const byN = new Map(index.scenarios.map((r) => [r.n, r]));
  for (const e of entries) byN.set(e.n, { ...e, runId });
  index.runId = runId;
  index.updatedAt = new Date().toISOString();
  index.scenarios = [...byN.values()].sort((a, b) => a.n.localeCompare(b.n));
  writeJsonAtomic(indexFile(taskDir), index);
  return index;
}

/**
 * What changed between the previous index and this run's entries: steps
 * rewritten (a different hash), status changed, and a
 * rewrite that carries no revision for the steps as they are now. Printed at
 * the end of the run; the report's "Changes to the scenarios" section is
 * written from that print, since the index keeps no history.
 */
export function diffAgainst(prevByN, entries) {
  const out = [];
  for (const e of entries) {
    const p = prevByN?.get(e.n);
    if (!p) continue;
    const stepsChanged = !!(p.stepsHash && e.stepsHash && p.stepsHash !== e.stepsHash);
    const statusFrom = p.status && p.status !== e.status ? p.status : null;
    const revisionMissing = stepsChanged && (!e.revision || (e.revisionHash && e.revisionHash !== e.stepsHash));
    if (stepsChanged || statusFrom) out.push({ n: e.n, stepsChanged, statusFrom, status: e.status, revisionMissing });
  }
  return out;
}
