/*
 * Runs on disk. Every execution gets a directory of its own under
 * docs/qa/<TASK>/runs/<runId>/ — its metadata, the scenario file as it was
 * executed, its results, its data ledger and its screenshots — and the task
 * directory keeps one index, results.json, that says for every scenario which
 * run last executed it and what it found. Nothing from an earlier run is
 * overwritten: a re-run of 07 writes a new picture in a new directory, and the
 * index points at it while the old one stays where it was.
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
export const RUNS_DIR = "runs";

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

export const runDirOf = (taskDir, runId) => path.join(taskDir, RUNS_DIR, runId);

export function listRuns(taskDir) {
  const dir = path.join(taskDir, RUNS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((d) => RUN_ID_RE.test(d)).sort();
}

const pidAlive = (pid) => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

/** A run.json still "running" whose process is gone was killed; say so. */
export function markStaleRuns(taskDir) {
  const marked = [];
  for (const id of listRuns(taskDir)) {
    const file = path.join(runDirOf(taskDir, id), "run.json");
    const meta = readJson(file);
    if (meta?.status === "running" && !pidAlive(meta.pid)) {
      meta.status = "interrupted";
      meta.finishedAt = meta.finishedAt || null;
      meta.note = "marked interrupted by a later run: the process that started it is gone and it never finished";
      writeJsonAtomic(file, meta);
      marked.push(id);
    }
  }
  return marked;
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

/** Create runs/<runId>/ with run.json and the scenario snapshot. */
export function createRun(taskDir, { runId = newRunId(), scenariosDoc, meta }) {
  const dir = runDirOf(taskDir, runId);
  if (fs.existsSync(dir)) throw new Error(`run ${runId} already exists`);
  fs.mkdirSync(path.join(dir, "screenshots"), { recursive: true });
  const runFile = path.join(dir, "run.json");
  const run = { runId, status: "running", pid: process.pid, startedAt: new Date().toISOString(), finishedAt: null, ...meta };
  writeJsonAtomic(runFile, run);
  if (scenariosDoc !== undefined) writeJsonAtomic(path.join(dir, "scenarios.json"), scenariosDoc);
  return { runId, dir, runFile, run };
}

export function updateRun(runFile, patch) {
  const run = readJson(runFile) || {};
  Object.assign(run, patch);
  writeJsonAtomic(runFile, run);
  return run;
}

/** What an earlier entry keeps when it moves into `history`. */
export function snapshotEntry(p) {
  return {
    runId: p.sourceRunId || p.runId || null, at: p.at || null, status: p.status, completed: p.completed, title: p.title,
    expects: p.expects, error: p.error, errorDetail: p.errorDetail, failedStep: p.failedStep,
    stepsHash: p.stepsHash, hashVersion: p.hashVersion, revision: p.revision, revisionHash: p.revisionHash,
    diagnosis: p.diagnosis, screenshot: p.screenshot,
  };
}

/** The index, or an empty one; a pre-0.7.0 flat results.json is read as its predecessor. */
export function loadIndex(taskDir) {
  const doc = readJson(path.join(taskDir, INDEX_FILE));
  if (!doc) return { latestRunId: null, scenarios: [] };
  if (doc.latestRunId !== undefined) return doc;
  // 0.6.0 layout: one results.json, screenshots/ beside it. Keep its entries as history.
  return {
    latestRunId: null,
    legacy: { driver: doc.driver, startedAt: doc.startedAt, note: "entries below were recorded by a pre-0.7.0 run into results.json + screenshots/" },
    scenarios: (doc.scenarios || []).map((r) => ({ ...r, sourceRunId: "legacy", fresh: false })),
  };
}

/**
 * Merge this run's entries into the index. An entry executed now replaces the
 * previous one for that number and points at this run; a scenario whose
 * status or steps changed keeps the earlier entry under history. Entries this
 * run did not execute stay as they were, marked fresh: false.
 */
export function updateIndex(taskDir, runId, entries, { scope = "all" } = {}) {
  const index = loadIndex(taskDir);
  const byN = new Map(index.scenarios.map((r) => [r.n, r]));
  for (const r of index.scenarios) r.fresh = false;
  for (const e of entries) {
    const p = byN.get(e.n);
    const out = { ...e, sourceRunId: runId, fresh: true };
    if (p && p.sourceRunId === runId) {
      // The same run writing again after another scenario: keep what the first
      // write worked out, do not make the run its own history.
      for (const k of ["history", "rewritten", "statusChangedFrom"]) if (p[k] !== undefined) out[k] = p[k];
    } else if (p) {
      const comparable = p.hashVersion === e.hashVersion;
      const rewritten = comparable && p.stepsHash !== e.stepsHash;
      const older = p.history || [];
      // Every earlier execution stays on record with its run id; the flags say
      // what changed, so the report can tell a re-run from a rewrite.
      out.history = [...older, snapshotEntry(p)];
      if (rewritten) out.rewritten = true;
      if (p.status !== e.status) out.statusChangedFrom = p.status;
      if (out.history.length === 0) delete out.history;
    }
    byN.set(e.n, out);
  }
  index.latestRunId = runId;
  index.latestScope = scope;
  index.updatedAt = new Date().toISOString();
  index.scenarios = [...byN.values()].sort((a, b) => a.n.localeCompare(b.n));
  writeJsonAtomic(path.join(taskDir, INDEX_FILE), index);
  return index;
}

/** Rewritten since an earlier run and the revision does not cover this version of the steps. */
export const unexplainedRewrite = (r) =>
  (r.history || []).some((h) => h.stepsHash && h.hashVersion === r.hashVersion && h.stepsHash !== r.stepsHash) && (!r.revision || r.revisionHash !== r.stepsHash);
