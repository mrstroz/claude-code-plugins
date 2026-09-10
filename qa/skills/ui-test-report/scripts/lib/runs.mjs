/*
 * The task directory on disk: docs/qa/<TASK>/ holds scenarios.json, one
 * results.json, one screenshots/ directory and, only while something is left
 * in the database, records.json. results.json carries the metadata of the
 * latest run under `run` and one entry per scenario; a scenario the latest run
 * did not execute keeps its earlier entry with its own runId, which is what
 * the report's "(earlier)" mark comes from. Nothing is archived per run: the
 * repository's history is the archive between builds, and a picture that a
 * later run replaced was evidence for a result that no longer stands.
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

export const RUN_ID_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;

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
const DROPPED = ["history", "fresh", "rewritten", "statusChangedFrom", "sourceRunId"];

/**
 * The index, or an empty one. A 0.7.0 index (latestRunId + runs/) is read
 * into the flat shape: the run that last executed each scenario becomes its
 * runId, the per-run bookkeeping is dropped, and screenshot paths point at
 * screenshots/ — the pictures themselves are not moved, the next run takes
 * new ones. The caller says so when it notices `migratedFrom`.
 */
export function loadIndex(taskDir) {
  const doc = readJson(indexFile(taskDir));
  if (!doc) return { runId: null, run: null, scenarios: [] };
  if (doc.latestRunId === undefined && doc.run !== undefined) return doc;
  const legacy = doc.latestRunId !== undefined ? "0.7.0" : "0.6.0";
  const scenarios = (doc.scenarios || []).map((r) => {
    const out = { ...r, runId: r.sourceRunId && r.sourceRunId !== "legacy" ? r.sourceRunId : r.runId || null };
    for (const k of DROPPED) delete out[k];
    if (out.screenshot) out.screenshot = path.posix.join(SHOTS_DIR, path.posix.basename(out.screenshot));
    return out;
  });
  return { runId: doc.latestRunId || null, run: null, scenarios, migratedFrom: legacy };
}

/** Start a run: a fresh id, `run` in the index set to running, screenshots/ present. */
export function startRun(taskDir, meta = {}, { runId = newRunId() } = {}) {
  const index = loadIndex(taskDir);
  const migratedFrom = index.migratedFrom;
  delete index.migratedFrom;
  index.runId = runId;
  index.run = { runId, status: "running", startedAt: new Date().toISOString(), finishedAt: null, ...meta };
  index.updatedAt = index.run.startedAt;
  fs.mkdirSync(path.join(taskDir, SHOTS_DIR), { recursive: true });
  writeJsonAtomic(indexFile(taskDir), index);
  return { runId, dir: taskDir, shotsDir: path.join(taskDir, SHOTS_DIR), migratedFrom };
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
  delete index.migratedFrom;
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
 * rewritten (same hash version, different hash), status changed, and a
 * rewrite that carries no revision for the steps as they are now. Printed at
 * the end of the run; the report's "Changes to the scenarios" section is
 * written from that print, since the index keeps no history.
 */
export function diffAgainst(prevByN, entries) {
  const out = [];
  for (const e of entries) {
    const p = prevByN?.get(e.n);
    if (!p) continue;
    const stepsChanged = !!(p.stepsHash && e.stepsHash && p.hashVersion === e.hashVersion && p.stepsHash !== e.stepsHash);
    const statusFrom = p.status && p.status !== e.status ? p.status : null;
    const revisionMissing = stepsChanged && (!e.revision || (e.revisionHash && e.revisionHash !== e.stepsHash));
    if (stepsChanged || statusFrom) out.push({ n: e.n, stepsChanged, statusFrom, status: e.status, revisionMissing });
  }
  return out;
}
