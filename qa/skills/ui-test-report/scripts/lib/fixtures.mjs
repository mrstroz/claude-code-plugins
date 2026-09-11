/*
 * Test data: preparing it, remembering what was created, and removing it.
 *
 * A setup is a named block of prepare steps — http, sql, shell — that a
 * scenario declares with `uses`. It runs once per run, before the first
 * scenario that needs it, so `--only 07` prepares 07's data without replaying
 * the six scenarios before it. Every record a step creates is written to
 * records.json in the task directory with the run id, and cleanup walks that
 * ledger backwards. Only the ledger: nothing is truncated, reset or guessed,
 * and a record the run did not create is never touched. Names built with
 * ${runId} carry the provenance into the data itself, so a stray
 * "QA 20260910-103212-9f3a villas" in a shared database says where it came
 * from without opening any file.
 *
 * The ledger lists what is still there and what could not be explained. A
 * record that cleanup removed leaves the file, a failure that a retry solved
 * leaves it too, and a file with nothing left — no record, no prepared setup
 * owed its cleanup block, no failure — is deleted. So records.json existing at
 * all means there is still something to remove or to explain. A run cleans its
 * own records; --cleanup walks everything the file lists.
 *
 * Every record remembers the base URL it was created against, because an http
 * cleanup step is relative and a later run may point at another environment.
 * Cleanup uses the record's own URL, never the current run's.
 *
 * The runner opens no transaction around the app's own writes and does not
 * pretend one exists; cleanup is explicit, recorded, and reported when it
 * fails.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fill, getPath } from "./compare.mjs";
import { fixtureKind } from "./validate.mjs";
import { writeJsonAtomic, readJson } from "./runs.mjs";

/** What a failure is about, so a solved one can be dropped instead of piling up. */
const failureKey = (f) =>
  f.setup !== undefined
    ? `setup:${f.runId ?? ""}:${f.setup}`
    : `record:${f.runId ?? ""}:${f.kind ?? ""}:${String(f.id ?? "")}`;

export class Ledger {
  constructor(file, runId) {
    this.file = file;
    this.runId = runId;
    const existing = readJson(file);
    this.records = existing?.records || [];
    this.failures = existing?.failures || [];
    this.prepared = existing?.prepared || [];
  }
  /** Setups this run has prepared. */
  preparedNames() {
    return this.prepared.filter((p) => p.runId === this.runId).map((p) => p.name);
  }
  markPrepared(name, baseUrl = null) {
    if (!this.preparedNames().includes(name)) this.prepared.push({ name, runId: this.runId, baseUrl: baseUrl ?? undefined });
    this.save();
  }
  /** The caller passes `baseUrl` — where the record was made; cleanup goes back to that one. */
  add(record) {
    this.records.push({ runId: this.runId, at: new Date().toISOString(), ...record });
    this.save();
  }
  /** Records other runs left behind — kept with --keep-data or not removable. */
  leftovers() {
    return this.records.filter((r) => r.runId !== this.runId);
  }
  /** Forget what was recorded about one record or setup before trying it again. */
  dropFailuresFor(target) {
    const key = failureKey(target);
    this.failures = this.failures.filter((f) => failureKey(f) !== key);
  }
  save() {
    writeJsonAtomic(this.file, { prepared: this.prepared, records: this.records, failures: this.failures });
  }
  /** Save, or remove the file when nothing is left to clean up or explain. */
  compact() {
    if (this.records.length === 0 && this.prepared.length === 0 && this.failures.length === 0) {
      try { fs.rmSync(this.file); } catch { /* never written */ }
      return false;
    }
    this.save();
    return true;
  }
}

/**
 * ${runId}, ${name} from the values map and ${env.NAME} from the shell, in
 * every string of the step. An env value is used and never written anywhere.
 */
function fillAll(v, ctx, extra = {}) {
  const values = { ...ctx.values, runId: ctx.runId, ...extra };
  const walk = (x) => {
    if (typeof x === "string") return fill(x.replace(/\$\{env\.([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => process.env[k] ?? m), values);
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, walk(y)]));
    return x;
  };
  return walk(v);
}

async function httpStep(spec, ctx, extra) {
  const s = fillAll(spec, ctx, extra);
  const url = /^https?:\/\//.test(s.url) ? s.url : (ctx.baseUrl || "") + (s.url.startsWith("/") ? s.url : "/" + s.url);
  const headers = { ...(s.headers || {}) };
  if (s.json !== undefined && !headers["content-type"] && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (s.session === "browser") {
    if (!ctx.cookieHeader) throw new Error(`http step wants "session": "browser" but no browser session is available (Playwright driver only)`);
    headers.Cookie = await ctx.cookieHeader(url);
  }
  const res = await fetch(url, { method: s.method || "GET", headers, body: s.json !== undefined ? JSON.stringify(s.json) : s.body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not json */ }
  const out = { status: res.status, ok: res.ok, url, method: s.method || "GET", json, text: json === undefined ? text.slice(0, 2000) : undefined };
  const want = s.expectStatus;
  if (want !== undefined && res.status !== Number(want)) throw new Error(`${out.method} ${url} returned ${res.status}, expected ${want}: ${text.slice(0, 200)}`);
  if (want === undefined && !res.ok) throw new Error(`${out.method} ${url} returned ${res.status}: ${text.slice(0, 200)}`);
  return out;
}

async function sqlStep(spec, ctx, extra) {
  if (!ctx.db) throw new Error(`sql step needs the database (withDB with a db block in qa.config.json)`);
  const s = fillAll(spec, ctx, extra);
  const rows = await ctx.db.query(s.query, s.params || [], { write: true });
  return { rows, ...(rows[0] || {}) };
}

function shellStep(spec, ctx, extra) {
  const s = typeof spec === "string" ? { command: spec } : spec;
  const filled = fillAll(s, ctx, extra);
  const stdout = execFileSync("/bin/sh", ["-c", filled.command], {
    cwd: filled.cwd || ctx.cwd || process.cwd(),
    env: { ...process.env, QA_RUN_ID: ctx.runId, ...(filled.env || {}) },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: Number(filled.timeout) || 120000,
  }).toString();
  let json;
  try { json = JSON.parse(stdout); } catch { /* plain text */ }
  return { stdout: stdout.trim(), json };
}

const RUNNERS = { http: httpStep, sql: sqlStep, shell: shellStep };

/** One http / sql / shell step; returns what it produced. */
export async function runFixtureStep(step, ctx, extra = {}) {
  const kind = fixtureKind(step);
  if (!kind) throw new Error(`fixture step needs exactly one of http, sql, shell: ${JSON.stringify(step)}`);
  return RUNNERS[kind](typeof step === "string" ? step : step[kind], ctx, extra);
}

function idOf(result, idPath) {
  if (idPath === undefined) return undefined;
  const v = getPath(result, idPath);
  if (v === undefined || v === null) throw new Error(`record.id "${idPath}" found nothing in ${JSON.stringify(result).slice(0, 300)}`);
  return v;
}

/**
 * Run one setup's prepare steps, appending every `record` to the ledger as it
 * is made — not at the end, so a step that fails half way still leaves the
 * earlier records where cleanup will find them.
 */
export async function prepareSetup(name, setup, ctx) {
  const results = [];
  for (const [i, step] of (setup.prepare || []).entries()) {
    const kind = fixtureKind(step);
    const spec = typeof step === "string" ? {} : step[kind];
    let result;
    try {
      result = await runFixtureStep(step, ctx);
    } catch (e) {
      throw new Error(`setup "${name}" step ${i + 1} (${kind}): ${e.message}`);
    }
    if (spec.name) ctx.values[spec.name] = result;
    if (spec.record) {
      const id = idOf(result, spec.record.id);
      ctx.ledger.add({ setup: name, kind: spec.record.kind, id, via: kind, baseUrl: ctx.baseUrl ?? undefined, cleanup: spec.record.cleanup || null, note: spec.record.note });
    }
    results.push({ step: i, kind, ok: true });
  }
  return results;
}

/** An http cleanup step with a relative url cannot run without knowing where. */
function needsBaseUrl(step) {
  if (fixtureKind(step) !== "http") return false;
  const url = typeof step?.http?.url === "string" ? step.http.url : "";
  return !/^https?:\/\//.test(url);
}

/**
 * Remove what a run created: its records in reverse order, each through its
 * own cleanup step with ${id} and ${runId} filled in, against the base URL the
 * record itself remembers; then every setup it prepared, through the setup's
 * cleanup block. A record or setup that came off cleanly leaves the ledger,
 * together with whatever failure an earlier attempt had recorded about it; one
 * that did not stays listed with the reason, and the walk continues, so one
 * record that will not delete does not leave ten others behind unreported.
 * With `all: true` (--cleanup) the walk covers every run the ledger lists, and
 * `baseUrl` overrides what the records remember — the way out when the app has
 * moved since.
 */
export async function cleanupRun(ctx, { setups = {}, all = false, baseUrl = null, log = null } = {}) {
  const ledger = ctx.ledger;
  const mine = (r) => all || r.runId === ledger.runId;
  const failures = [];
  let cleaned = 0;
  let skipped = 0;
  const fail = (entry) => {
    const f = { ...entry, at: new Date().toISOString() };
    ledger.failures.push(f);
    failures.push(f);
  };

  for (let i = ledger.records.length - 1; i >= 0; i--) {
    const rec = ledger.records[i];
    if (!mine(rec)) continue;
    // No cleanup step: the record is still there, so it stays listed.
    if (!rec.cleanup) { skipped++; continue; }
    const target = { runId: rec.runId, kind: rec.kind, id: rec.id };
    ledger.dropFailuresFor(target);
    const where = baseUrl || rec.baseUrl || null;
    if (needsBaseUrl(rec.cleanup) && !where) {
      fail({ ...target, error: `no base URL on this record and its cleanup step is a relative http call — run --cleanup --base-url <where it was created> rather than send it somewhere else` });
      ledger.save();
      continue;
    }
    try {
      await runFixtureStep(rec.cleanup, { ...ctx, runId: rec.runId, baseUrl: where }, { id: rec.id });
      ledger.records.splice(i, 1);
      cleaned++;
      log?.(`removed ${rec.kind} ${rec.id ?? ""} of run ${rec.runId}${where ? ` at ${where}` : ""}`);
    } catch (e) {
      fail({ ...target, error: e.message });
    }
    ledger.save();
  }

  for (const p of [...ledger.prepared.filter(mine)].reverse()) {
    const target = { runId: p.runId, setup: p.name };
    ledger.dropFailuresFor(target);
    const setup = setups[p.name];
    if (!setup) {
      fail({ ...target, error: `setup "${p.name}" is no longer in the scenario file, so its cleanup cannot be run — restore it, or drop this entry from records.json by hand` });
      ledger.save();
      continue;
    }
    const steps = setup.cleanup || [];
    const where = baseUrl || p.baseUrl || null;
    // Which of this setup's cleanup steps already ran. A retry repeats only
    // what is left: a DELETE that worked the first time answers 404 the
    // second, which would look like a new failure of a job already done.
    const cleanedSteps = new Set(p.cleanupDone || []);
    for (const [i, step] of steps.entries()) {
      if (cleanedSteps.has(i)) continue;
      if (needsBaseUrl(step) && !where) {
        fail({ ...target, step: i, error: `no base URL on this setup and cleanup step ${i + 1} is a relative http call — run --cleanup --base-url <where it was prepared>` });
        continue;
      }
      try {
        await runFixtureStep(step, { ...ctx, runId: p.runId, baseUrl: where });
        cleanedSteps.add(i);
      } catch (e) {
        fail({ ...target, step: i, error: e.message });
      }
    }
    // The entry leaves only when nothing is owed any more; a teardown that
    // did not finish stays retryable, remembering how far it got.
    if (cleanedSteps.size === steps.length) ledger.prepared.splice(ledger.prepared.indexOf(p), 1);
    else p.cleanupDone = [...cleanedSteps].sort((a, b) => a - b);
    ledger.save();
  }

  return { cleaned, skipped, failures };
}
