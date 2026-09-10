/*
 * Values, comparators and the check itself — the part of the runner that
 * decides PASS or FAIL, kept free of Playwright so it can be tested on its own.
 *
 * Comparisons are strict on purpose. The one deliberate normalisation is a
 * number against a string that spells a number, because the DOM hands back
 * "11" where the file says 11; everything else that used to pass through
 * String() — null against "null", an array flattened to "P-101,P-103" so that
 * contains matched a substring of one id — now fails with a reason saying why.
 * A value that needs converting is converted where it is read, with `as`.
 */

export const REF_RE = /^\$\{([a-zA-Z0-9_]+)((?:\.[a-zA-Z0-9_]+)*)\}$/;
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const PLACEHOLDER_RE = /\$\{([a-zA-Z0-9_]+)((?:\.[a-zA-Z0-9_]+)*)\}/g;

/** Replace ${name} or ${name.path.to.field} with the stored value; an unknown name stays visible in the text. */
export function fill(template, values) {
  if (typeof template !== "string") return template;
  return template.replace(PLACEHOLDER_RE, (m, k, p) => (k in values ? stringify(getPath(values[k], p ? p.slice(1) : "")) : m));
}

/** Fill every string inside a JSON structure — request bodies, params, urls. */
export function fillDeep(v, values) {
  if (typeof v === "string") return fill(v, values);
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, values));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x, values)]));
  return v;
}

function stringify(v) {
  if (v === null || v === undefined) return String(v);
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** A whole-string ${ref} resolves to the stored value; anything else is literal. */
export function operand(v, values) {
  if (typeof v === "string") {
    const m = v.match(REF_RE);
    if (m) {
      if (!(m[1] in values)) throw new Error(`\${${m[1]}} has not been read in this run — the scenario that reads it did not run; include it in requires`);
      return getPath(values[m[1]], m[2] ? m[2].slice(1) : "");
    }
  }
  return v;
}

/** "a.b.0.c" into a value; undefined when any segment is missing. */
export function getPath(value, path) {
  if (path === undefined || path === null || path === "") return value;
  let cur = value;
  for (const seg of String(path).split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[seg];
  }
  return cur;
}

export const NORMALIZERS = {
  number: (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && NUMERIC_RE.test(v.trim())) return Number(v.trim());
    if (typeof v === "string") {
      // "1 234,50 zł" → 1234.5: keep digits, one separator, the sign
      const cleaned = v.replace(/[^\d,.\-]/g, "").replace(/,/g, ".");
      const m = cleaned.match(/-?\d+(\.\d+)?/);
      if (m) return Number(m[0]);
    }
    throw new Error(`cannot read ${JSON.stringify(v)} as a number`);
  },
  string: (v) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)),
  trim: (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v),
  boolean: (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(s)) return true;
      if (["false", "0", "no", "off", ""].includes(s)) return false;
    }
    if (typeof v === "number") return v !== 0;
    if (v === null || v === undefined) return false;
    throw new Error(`cannot read ${JSON.stringify(v)} as a boolean`);
  },
  json: (v) => (typeof v === "string" ? JSON.parse(v) : v),
};

/** Apply a declared `as` conversion; arrays convert element by element. */
export function normalize(value, as) {
  if (!as) return value;
  const fn = NORMALIZERS[as];
  if (!fn) throw new Error(`unknown "as": ${as} (one of ${Object.keys(NORMALIZERS).join(", ")})`);
  return Array.isArray(value) && as !== "json" && as !== "string" ? value.map(fn) : fn(value);
}

const isObj = (v) => v !== null && typeof v === "object";
const numericString = (v) => typeof v === "string" && NUMERIC_RE.test(v.trim());
const asNumber = (v) => (typeof v === "number" ? v : numericString(v) ? Number(v.trim()) : NaN);
export const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

/** Deep equality with one concession: a number equals the string that spells it. */
export function same(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && numericString(b)) return a === Number(b.trim());
  if (typeof b === "number" && numericString(a)) return b === Number(a.trim());
  if (isObj(a) && isObj(b)) {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
  }
  return false;
}

const ok = () => ({ passed: true });
const no = (reason) => ({ passed: false, reason });

function numeric(op, a, b, test) {
  const x = asNumber(a);
  const y = asNumber(b);
  if (Number.isNaN(x)) return no(`${op} needs a number on the left, got ${typeOf(a)} ${JSON.stringify(a)}`);
  if (Number.isNaN(y)) return no(`${op} needs a number on the right, got ${typeOf(b)} ${JSON.stringify(b)}`);
  return test(x, y) ? ok() : no(`${x} ${op} ${y} does not hold`);
}

/** Each comparator returns { passed, reason? }; the reason explains a fail in one line. */
export const COMPARATORS = {
  equals: (a, b) => (same(a, b) ? ok() : no(`expected ${typeOf(b)} ${JSON.stringify(b)}, got ${typeOf(a)} ${JSON.stringify(a)}`)),
  notEquals: (a, b) => (same(a, b) ? no(`expected anything but ${JSON.stringify(b)}`) : ok()),
  matches: (a, b) => {
    if (typeof a !== "string" && typeof a !== "number") return no(`matches needs a string, got ${typeOf(a)} ${JSON.stringify(a)}`);
    if (typeof b !== "string") return no(`matches needs a pattern string, got ${typeOf(b)}`);
    return new RegExp(b).test(String(a)) ? ok() : no(`${JSON.stringify(String(a))} does not match /${b}/`);
  },
  contains: (a, b) => {
    if (typeof a === "string") {
      if (typeof b !== "string" && typeof b !== "number") return no(`contains on a string needs a string, got ${typeOf(b)}`);
      return a.includes(String(b)) ? ok() : no(`${JSON.stringify(a)} does not contain ${JSON.stringify(String(b))}`);
    }
    if (Array.isArray(a)) return a.some((v) => same(v, b)) ? ok() : no(`array ${JSON.stringify(a)} has no element equal to ${JSON.stringify(b)}`);
    if (isObj(a)) return Object.hasOwn(a, String(b)) ? ok() : no(`object has no key ${JSON.stringify(String(b))}`);
    return no(`contains needs a string, array or object on the left, got ${typeOf(a)} ${JSON.stringify(a)}`);
  },
  gt: (a, b) => numeric("gt", a, b, (x, y) => x > y),
  gte: (a, b) => numeric("gte", a, b, (x, y) => x >= y),
  lt: (a, b) => numeric("lt", a, b, (x, y) => x < y),
  lte: (a, b) => numeric("lte", a, b, (x, y) => x <= y),
  truthy: (a) => (a ? ok() : no(`expected a truthy value, got ${typeOf(a)} ${JSON.stringify(a)}`)),
  falsy: (a) => (a ? no(`expected a falsy value, got ${typeOf(a)} ${JSON.stringify(a)}`) : ok()),
};

export const comparatorsIn = (spec) => Object.keys(COMPARATORS).filter((k) => k in spec);
export const comparatorOf = (spec) => comparatorsIn(spec)[0];

/** Which of js / name / db a check reads. */
export const sourceOf = (spec) => (spec.js !== undefined ? "js" : spec.db !== undefined ? "db" : spec.name !== undefined ? "name" : null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Evaluate one check — an `expect` step or a `given` entry.
 *
 * `readers` supplies the page and the database: { js(expr), db(spec) }.
 * `sources[name]` says where a stored value came from (ui, db, http), so the
 * result can say which kind of evidence it is.
 *
 * With `within`, the read and the comparison are repeated until the condition
 * holds or the time is up; the action that changed the state is never
 * repeated, and a stored value is never re-read (the validator refuses
 * `within` on `name`, since polling a constant is waiting for nothing).
 */
export async function check(spec, values, readers, sources = {}) {
  const src = sourceOf(spec);
  if (!src) throw new Error(`check needs js, name or db: ${JSON.stringify(spec)}`);
  const op = comparatorOf(spec);
  if (!op) throw new Error(`check without a comparator: ${JSON.stringify(spec)}`);
  const expected = normalize(operand(spec[op], values), spec.expectedAs);
  const source = src === "js" ? "ui" : src === "db" ? "db" : sources[spec.name] || "value";
  const readOnce = async () => {
    const raw = src === "js" ? await readers.js(spec.js) : src === "db" ? await readers.db(spec.db, values) : operand(`\${${spec.name}}`, values);
    return normalize(getPath(raw, spec.path), spec.as);
  };
  const what = spec.js || (spec.db ? `db:${spec.db.query}` : "${" + spec.name + "}") + (spec.path ? `.${spec.path}` : "");
  const desc = spec.desc || `${what} ${op} ${JSON.stringify(spec[op])}`;
  const result = { desc, source, passed: false, actual: undefined, expected: op === "truthy" || op === "falsy" ? undefined : expected };

  const started = Date.now();
  const within = Number(spec.within) || 0;
  const every = Number(spec.every) || 200;
  let attempts = 0;
  let verdict;
  for (;;) {
    attempts++;
    result.actual = await readOnce();
    verdict = COMPARATORS[op](result.actual, expected);
    if (verdict.passed || !within || Date.now() - started >= within) break;
    await sleep(Math.min(every, Math.max(0, within - (Date.now() - started))));
  }
  result.passed = verdict.passed;
  if (!verdict.passed) {
    result.reason = verdict.reason;
    result.actualType = typeOf(result.actual);
  }
  if (within) {
    result.waitedMs = Date.now() - started;
    result.attempts = attempts;
    if (!verdict.passed) result.timedOut = true;
  }
  return result;
}
