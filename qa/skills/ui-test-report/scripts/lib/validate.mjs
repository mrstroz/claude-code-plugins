/*
 * The scenario file, checked before anything is clicked. Every problem in the
 * file is reported at once — a broken step discovered on scenario 37 of 40 has
 * cost the whole run — and the rules encode what a trustworthy result needs:
 * an assertion behind every PASS, one operation per step, one comparator per
 * check, a value read before it is used, a dependency earlier in the file, a
 * visual target for the picture, and no database step without withDB.
 */
import crypto from "node:crypto";
import { REF_RE, comparatorsIn, sourceOf, NORMALIZERS } from "./compare.mjs";

export const ACTION_STEPS = ["click", "dblclick", "hover", "fill", "type", "select", "check", "uncheck", "press"];
export const STEP_KINDS = [...ACTION_STEPS, "goto", "reload", "wait", "read", "db", "expect"];
export const FIXTURE_KINDS = ["http", "sql", "shell"];
/** Keys a step may carry next to its operation, and on which operations. */
const MODIFIERS = { awaitResponse: new Set(ACTION_STEPS), desc: new Set(STEP_KINDS) };
const RESERVED_NAMES = new Set(["runId", "env"]);

export const numberOf = (sc) => String(sc.n ?? "").padStart(2, "0");
export const requiresOf = (sc) => (sc.requires || []).map((d) => String(d).padStart(2, "0"));
export const usesOf = (sc) => (Array.isArray(sc.uses) ? sc.uses : sc.uses ? [sc.uses] : []);

/** The operation a step carries — exactly one of STEP_KINDS — or null. */
export function stepKind(step) {
  if (!step || typeof step !== "object") return null;
  const kinds = Object.keys(step).filter((k) => STEP_KINDS.includes(k));
  return kinds.length === 1 ? kinds[0] : null;
}

export function fixtureKind(step) {
  if (!step || typeof step !== "object") return typeof step === "string" ? "shell" : null;
  const kinds = Object.keys(step).filter((k) => FIXTURE_KINDS.includes(k));
  return kinds.length === 1 ? kinds[0] : null;
}

/** Names a check refers to: its own `name` and a ${ref} on the right-hand side. */
export function refsOf(spec) {
  const refs = [];
  if (spec.name !== undefined) refs.push(String(spec.name));
  for (const op of comparatorsIn(spec)) {
    const m = typeof spec[op] === "string" ? spec[op].match(REF_RE) : null;
    if (m) refs.push(m[1]);
  }
  return refs;
}

/** Names a setup's prepare steps store (`name` on an http / sql / shell step). */
export function setupReadsOf(setup) {
  return (setup?.prepare || []).map((st) => { const k = fixtureKind(st); return k && typeof st === "object" ? st[k]?.name : undefined; }).filter((x) => typeof x === "string");
}

/** Names a scenario stores: read, db, awaitResponse, and what the setups it uses store. */
export function readsOf(sc, setups = {}) {
  const names = usesOf(sc).flatMap((u) => setupReadsOf(setups[u]));
  for (const step of sc.steps || []) {
    if (step?.read?.name) names.push(String(step.read.name));
    if (step?.db?.name) names.push(String(step.db.name));
    if (step?.awaitResponse?.name) names.push(String(step.awaitResponse.name));
  }
  return names;
}

/** Names a scenario uses: given, expect right-hand sides, ${…} in captions and step values. */
export function usedRefsOf(sc) {
  const refs = new Set();
  const scan = (v) => {
    if (typeof v === "string") for (const m of v.matchAll(/\$\{([a-zA-Z0-9_]+)(?:\.[a-zA-Z0-9_]+)*\}/g)) refs.add(m[1]);
    else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === "object") Object.values(v).forEach(scan);
  };
  for (const g of sc.given || []) refsOf(g).forEach((r) => refs.add(r));
  for (const step of sc.steps || []) {
    if (step?.expect) refsOf(step.expect).forEach((r) => refs.add(r));
    scan(step);
  }
  scan(sc.caption);
  return [...refs].filter((r) => !RESERVED_NAMES.has(r));
}

/**
 * The identity of what a scenario checks: its steps and preconditions, the
 * scenarios it builds on, and the setups it runs on — with their content, so a
 * changed fixture changes the hash of every scenario that depends on it.
 */
export function hashOf(sc, setups = {}) {
  const body = JSON.stringify({
    given: sc.given || [],
    steps: sc.steps || [],
    manual: !!sc.manual,
    requires: requiresOf(sc),
    uses: usesOf(sc).map((u) => [u, setups[u] ?? null]),
  });
  return crypto.createHash("sha1").update(body).digest("hex").slice(0, 12);
}

function checkSpec(problems, where, kind, spec, reads, withDB) {
  if (!spec || typeof spec !== "object") return problems.push(`${where}: ${kind} must be an object`);
  const sources = ["js", "name", "db"].filter((k) => spec[k] !== undefined);
  if (sources.length !== 1) problems.push(`${where}: ${kind} needs exactly one of js, name, db (has ${sources.length ? sources.join(", ") : "none"}): ${JSON.stringify(spec)}`);
  const ops = comparatorsIn(spec);
  if (ops.length !== 1) problems.push(`${where}: ${kind} needs exactly one comparator (has ${ops.length ? ops.join(", ") : "none"}): ${JSON.stringify(spec)}`);
  if (spec.within !== undefined) {
    if (sourceOf(spec) === "name") problems.push(`${where}: ${kind} cannot use "within" on a stored value — ${"${" + spec.name + "}"} was read once and will not change; put "within" on the read (js or db) instead`);
    if (!(Number(spec.within) > 0)) problems.push(`${where}: ${kind} "within" must be milliseconds > 0`);
  }
  if (spec.every !== undefined && !(Number(spec.every) > 0)) problems.push(`${where}: ${kind} "every" must be milliseconds > 0`);
  for (const key of ["as", "expectedAs"]) if (spec[key] !== undefined && !NORMALIZERS[spec[key]]) problems.push(`${where}: ${kind} "${key}": ${JSON.stringify(spec[key])} is not one of ${Object.keys(NORMALIZERS).join(", ")}`);
  if (spec.db !== undefined) checkDbSpec(problems, where, kind, spec.db, withDB);
  for (const ref of refsOf(spec)) {
    if (RESERVED_NAMES.has(ref)) continue;
    if (!reads.has(ref)) problems.push(`${where}: ${kind} refers to \${${ref}} but no earlier read stores it`);
  }
}

function checkDbSpec(problems, where, kind, db, withDB) {
  if (!withDB) problems.push(`${where}: ${kind} reads the database but the file does not declare "withDB": true — the run was set up as UI only`);
  if (!db || typeof db !== "object" || typeof db.query !== "string") problems.push(`${where}: ${kind} db needs { "query": "SELECT …", "params": […] }`);
  else if (db.params !== undefined && !Array.isArray(db.params)) problems.push(`${where}: ${kind} db params must be an array`);
}

function checkTarget(problems, where, sc) {
  const t = sc.caption?.target;
  if (t === undefined) {
    problems.push(`${where}: caption has no "target" — name the element or region that proves the result (the saved row, the changed field, the counter, the validation message; for an absence, the container or empty state), or write "target": { "none": "why nothing on screen proves this" }`);
    return;
  }
  const okShape = typeof t === "string" || (t && typeof t === "object" && (typeof t.selector === "string" || typeof t.none === "string"));
  if (!okShape) problems.push(`${where}: caption.target must be a selector string, { "selector", "label"? } or { "none": "reason" }`);
}

function checkFixtureSteps(problems, where, steps, withDB, writes) {
  if (!Array.isArray(steps)) return problems.push(`${where}: must be an array of http / sql / shell steps`);
  steps.forEach((step, i) => {
    const kind = fixtureKind(step);
    const at = `${where}[${i}]`;
    if (!kind) return problems.push(`${at}: exactly one of ${FIXTURE_KINDS.join(", ")}: ${JSON.stringify(step)}`);
    const spec = step[kind];
    if (kind === "http" && (!spec || typeof spec.url !== "string")) problems.push(`${at}: http needs a url`);
    if (kind === "sql") {
      if (!withDB) problems.push(`${at}: sql steps need "withDB": true`);
      else if (!writes) problems.push(`${at}: sql steps write to the database; qa.config.json must set db.writes: true for that`);
      if (!spec || typeof spec.query !== "string") problems.push(`${at}: sql needs a query`);
    }
    if (kind === "shell" && !(typeof spec === "string" || typeof spec?.command === "string")) problems.push(`${at}: shell needs a command`);
    const rec = spec && typeof spec === "object" ? spec.record : undefined;
    if (rec !== undefined) {
      if (!rec || typeof rec !== "object" || !rec.kind) problems.push(`${at}: record needs { "kind", "id", "cleanup"? }`);
      else if (rec.cleanup !== undefined && !fixtureKind(rec.cleanup)) problems.push(`${at}: record.cleanup must be one http / sql / shell step`);
    }
  });
}

/**
 * Validate the whole document. `only` (an array of numbers) also checks the
 * selection: every ${ref} a selected scenario uses has to be stored by a
 * selected scenario, or the re-run has nothing to compare against.
 */
export function validateScenarios(doc, { only = null, dbWrites = false } = {}) {
  const problems = [];
  const list = Array.isArray(doc) ? doc : doc?.scenarios;
  if (!Array.isArray(list) || list.length === 0) return ["no scenarios in the file (expected an array or { scenarios: [...] })"];
  const top = Array.isArray(doc) ? {} : doc;
  const withDB = top.withDB === true;
  const setups = top.setups && typeof top.setups === "object" ? top.setups : {};

  if (top.withDB !== undefined && typeof top.withDB !== "boolean") problems.push(`withDB must be true or false`);
  if (top.ready !== undefined && !(typeof top.ready === "string" || typeof top.ready?.js === "string" || typeof top.ready?.selector === "string")) {
    problems.push(`ready must be a selector string, { "js": "…" } or { "selector": "…" }`);
  }
  if (top.setups !== undefined && (typeof top.setups !== "object" || Array.isArray(top.setups))) problems.push(`setups must be an object of named setups`);
  for (const [name, setup] of Object.entries(setups)) {
    if (name === "version") continue;
    if (!setup || typeof setup !== "object") { problems.push(`setup "${name}" must be an object with prepare and optional cleanup`); continue; }
    if (setup.prepare === undefined) problems.push(`setup "${name}" has no prepare steps`);
    else checkFixtureSteps(problems, `setup "${name}".prepare`, setup.prepare, withDB, dbWrites);
    if (setup.cleanup !== undefined) checkFixtureSteps(problems, `setup "${name}".cleanup`, setup.cleanup, withDB, dbWrites);
  }

  const seen = new Set();
  const reads = new Set();
  const readerOf = new Map(); // name → scenario number that stores it

  list.forEach((sc, i) => {
    const n = numberOf(sc);
    const where = `scenario ${sc.n ?? "#" + (i + 1)}`;
    if (!/^\d{2,3}$/.test(n)) problems.push(`${where}: n must be a number like "01"`);
    else if (seen.has(n)) problems.push(`${where}: number ${n} is used twice`);
    if (sc.requires !== undefined && !Array.isArray(sc.requires)) problems.push(`${where}: requires must be an array of scenario numbers`);
    for (const d of requiresOf(sc)) {
      if (d === n) problems.push(`${where}: requires itself`);
      else if (!seen.has(d)) problems.push(`${where}: requires ${d}, which is not an earlier scenario in the file`);
    }
    seen.add(n);
    const slug = sc.slug || "scenario";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) problems.push(`${where}: slug "${slug}" must be lowercase letters, digits and dashes`);
    for (const u of usesOf(sc)) {
      if (!setups[u]) { problems.push(`${where}: uses setup "${u}", which is not defined under setups`); continue; }
      // A setup runs before the scenario, so what its steps store is readable here.
      for (const nm of setupReadsOf(setups[u])) { reads.add(nm); readerOf.set(nm, n); }
    }
    for (const spec of sc.given || []) checkSpec(problems, where, "given", spec, reads, withDB);
    checkTarget(problems, where, sc);

    let expects = 0;
    (sc.steps || []).forEach((step, j) => {
      const at = `${where} step ${j + 1}`;
      const kind = stepKind(step);
      if (!kind) {
        const ops = step && typeof step === "object" ? Object.keys(step).filter((k) => STEP_KINDS.includes(k)) : [];
        problems.push(ops.length > 1 ? `${at}: one operation per step, this one has ${ops.join(" and ")}` : `${at}: unknown step ${JSON.stringify(step)}`);
        return;
      }
      for (const key of Object.keys(step)) {
        if (key === kind) continue;
        if (!(key in MODIFIERS)) problems.push(`${at}: unknown key "${key}" next to ${kind}`);
        else if (!MODIFIERS[key].has(kind)) problems.push(`${at}: "${key}" is not allowed on ${kind}`);
      }
      const store = (name, what) => {
        if (!name || typeof name !== "string") return problems.push(`${at}: ${what} needs a name`);
        if (RESERVED_NAMES.has(name)) return problems.push(`${at}: "${name}" is reserved`);
        reads.add(name);
        readerOf.set(name, n);
      };
      if (kind === "read") {
        if (typeof step.read?.js !== "string") problems.push(`${at}: read needs js: ${JSON.stringify(step)}`);
        if (step.read?.as !== undefined && !NORMALIZERS[step.read.as]) problems.push(`${at}: read "as": ${JSON.stringify(step.read.as)} is not one of ${Object.keys(NORMALIZERS).join(", ")}`);
        store(step.read?.name, "read");
      }
      if (kind === "db") {
        checkDbSpec(problems, at, "db", step.db, withDB);
        store(step.db?.name, "db");
      }
      if (step.awaitResponse !== undefined) {
        const a = step.awaitResponse;
        if (!a || typeof a !== "object" || typeof a.url !== "string") problems.push(`${at}: awaitResponse needs { "name", "url", "method"?, "status"?, "timeout"? }`);
        else store(a.name, "awaitResponse");
      }
      if (kind === "expect") { expects++; checkSpec(problems, at, "expect", step.expect, reads, withDB); }
      if (kind === "wait" && step.wait === "networkidle") problems.push(`${at}: wait "networkidle" is a guess about readiness — prefer a selector, a URL or a js condition; if nothing else exists, write "wait": { "loadState": "networkidle" } to say so on purpose`);
    });
    if (sc.leaves !== undefined) {
      if (!Array.isArray(sc.leaves)) problems.push(`${where}: leaves must be an array of { "kind", "id", "cleanup" }`);
      else sc.leaves.forEach((l, i) => {
        if (!l || typeof l !== "object" || !l.kind || l.id === undefined) problems.push(`${where}: leaves[${i}] needs kind and id (a \${ref} read in this scenario)`);
        else if (l.cleanup !== undefined && !fixtureKind(l.cleanup)) problems.push(`${where}: leaves[${i}].cleanup must be one http / sql / shell step`);
      });
    }
    if (!sc.manual && expects === 0) problems.push(`${where}: no expect step and not manual — add an assertion, or set "manual": true if the tooling cannot verify it`);
  });

  if (only) {
    const { selected, missing } = selectScenarios(list, only);
    for (const m of missing) problems.push(`--only ${m}: no such scenario in the file`);
    const chosen = new Set(selected.map(numberOf));
    for (const sc of selected) {
      const own = new Set(readsOf(sc, setups));
      for (const ref of usedRefsOf(sc)) {
        if (own.has(ref)) continue;
        const reader = readerOf.get(ref);
        if (reader && !chosen.has(reader)) problems.push(`scenario ${numberOf(sc)} uses \${${ref}}, read by ${reader}, which is not in this run — add ${reader} to its requires`);
      }
    }
  }
  return problems;
}

/**
 * Which scenarios run, in file order. --only names some; each pulls in what it
 * requires, transitively, because a dependency's PASS from an earlier run says
 * nothing about the state of the app now.
 */
export function selectScenarios(list, only) {
  if (!only) return { selected: list, pulled: [], missing: [] };
  const byN = new Map(list.map((sc) => [numberOf(sc), sc]));
  const wanted = new Set(only.map((n) => String(n).padStart(2, "0")));
  const missing = [...wanted].filter((n) => !byN.has(n));
  const pulled = [];
  const add = (n, forWhom) => {
    for (const dep of requiresOf(byN.get(n) || {})) {
      if (!wanted.has(dep)) { wanted.add(dep); pulled.push(`${dep} for ${forWhom}`); }
      add(dep, forWhom);
    }
  };
  for (const n of [...wanted]) if (byN.has(n)) add(n, n);
  return { selected: list.filter((sc) => wanted.has(numberOf(sc))), pulled: pulled.sort(), missing };
}
