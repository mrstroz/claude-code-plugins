#!/usr/bin/env node

// payload-api.mjs — generic Payload CMS 3.x REST client
// Zero dependencies — requires Node 18+ (built-in fetch, FormData, Blob).
//
// This is a TRANSPORT, not an SDK: it knows nothing about any project's
// collections, blocks or fields. It exists because five things are easy to get
// subtly wrong by hand and expensive to get wrong at all — the two auth modes,
// `where` bracket serialization (a malformed filter returns EVERYTHING, not an
// error), multipart uploads, Payload's nested validation-error shape, and the
// backup/confirm guards around writes that cannot be undone.
//
// Usage:
//   node payload-api.mjs <command> [args] [options]
//
// Commands:
//   whoami                          GET  /api/<users>/me — who am I, and against which base URL
//   login                           POST /api/<users>/login — fetch and cache a JWT
//   find     <collection>           GET  /api/<collection>
//   get      <collection> <id>      GET  /api/<collection>/<id>
//   create   <collection>           POST /api/<collection>
//   update   <collection> <id>      PATCH /api/<collection>/<id>
//   delete   <collection> <id>      DELETE /api/<collection>/<id>
//   upload   <collection> --file P  POST multipart (parts: `file` + `_payload`)
//   get-global    <slug>            GET  /api/globals/<slug>
//   update-global <slug>            POST /api/globals/<slug>
//
// Options:
//   --base <url>            Base URL. Else PAYLOAD_BASE_URL. Else http://localhost:3000 for GETs only —
//                           every write needs an explicit base, because guessing a write target is the
//                           one mistake with no undo.
//   --env-file <path>       Load KEY=VALUE pairs before resolving auth (values are never printed).
//   --locale <code|all>     ?locale=   — `all` returns {pl: …, en: …} for localized fields.
//   --fallback-locale <c>   ?fallback-locale=  (`none` disables fallback)
//   --depth <n>             Default 0. A depth>=1 read returns populated relationship OBJECTS, and
//                           writing one of those back is how a related document gets clobbered.
//   --where <json|k=v>      '{"slug":{"equals":"x"}}' or the shorthand 'slug=x' / 'title:like=foo'.
//   --sort <field>          e.g. -createdAt
//   --limit <n> --page <n>
//   --select <a,b,c>        ?select[a]=true… — trims the response.
//   --data <json> | --data-file <path> | (stdin)   Request body.
//   --file <path>           Binary for `upload`.
//   --out <path>            Save the full response JSON here.
//   --dry-run               Print method, URL, body and a path-level diff. Send nothing.
//                           There is no server-side validation endpoint, so this shows what WOULD be
//                           sent — never that the server would accept it.
//   --backup-dir <path>     Default ./.payload-backups
//   --no-backup             Skip the pre-write backup. Must be passed explicitly.
//   --yes                   Confirm a write to a non-localhost base.
//   --read-only             Refuse any non-GET request. payload-query always passes this.
//   --no-cache              Do not read or write the cached JWT.
//   --raw                   Print the full response instead of the compact summary.
//   --api-route <path>      API prefix when the project overrides `routes.api` (default /api).
//   --auth-collection <s>   Collection carrying `auth: true` (default users).
//   --timeout <ms>          Default 30000.
//
// Env:
//   PAYLOAD_BASE_URL              Base URL, if --base is not given.
//   PAYLOAD_API_KEY               → Authorization: <collection> API-Key <key>
//   PAYLOAD_AUTH_COLLECTION       Collection carrying `auth: true` (default "users").
//   PAYLOAD_API_ROUTE             API route prefix if the project overrides `routes.api` (default "/api").
//   PAYLOAD_TOKEN                 → Authorization: JWT <token>
//   PAYLOAD_EMAIL / PAYLOAD_PASSWORD   Fallback: log in, then cache the JWT.
//
// Exit codes: 0 ok · 1 HTTP 4xx/5xx · 2 usage, auth or a refused guard · 3 network/timeout.

import { writeFileSync, readFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { dirname, basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const READ_COMMANDS = new Set(['whoami', 'find', 'get', 'get-global']);
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.json': 'application/json',
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const FLAGS = new Set(['--dry-run', '--no-backup', '--yes', '--read-only', '--no-cache', '--raw']);

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (FLAGS.has(a)) opts[a.slice(2)] = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

function die(code, msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

function loadEnvFile(path) {
  if (!existsSync(path)) die(2, `--env-file: no such file: ${path}`);
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Query serialization
// ---------------------------------------------------------------------------

// Payload reads filters as bracket-notation query params. `and`/`or` take arrays
// of objects and need numeric indices; operators like `in`/`all` take a comma
// list. Getting this wrong does not error — it silently widens the match.
function serializeInto(params, value, prefix) {
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== 'object')) {
      params.append(prefix, value.join(','));
      return;
    }
    value.forEach((item, i) => serializeInto(params, item, `${prefix}[${i}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) serializeInto(params, v, `${prefix}[${k}]`);
    return;
  }
  params.append(prefix, String(value));
}

const OPERATORS = new Set([
  'equals', 'not_equals', 'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal',
  'like', 'contains', 'in', 'not_in', 'all', 'exists', 'near', 'within', 'intersects',
]);

// Shorthand so the common case does not need JSON: `slug=oferta`, `title:like=foo`,
// or several joined with `&`. Anything starting with `{` is parsed as JSON.
//
// Both checks below exist because Payload ignores a filter it cannot parse rather
// than rejecting it — so a malformed `where` returns the WHOLE collection and reads
// as a legitimate result. Failing here is the only place that mistake is visible.
function parseWhere(input) {
  const text = input.trim();
  if (text.startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      die(2, `--where is not valid JSON: ${e.message}`);
    }
  }
  const clauses = text.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 0) die(2, `--where shorthand needs field=value, got: ${pair}`);
    const left = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const [field, operator = 'equals'] = left.split(':');
    if (/[[\]]/.test(field)) {
      die(2, [
        `--where: "${field}" contains a bracket, so it is bracket syntax written into the shorthand.`,
        `The shorthand takes the operator after a colon — write "${field.replace(/\[([^\]]*)\]/, ':$1')}"`,
        `or pass the JSON form: --where '{"${field.split('[')[0]}":{"${(field.match(/\[([^\]]*)\]/) || [, 'equals'])[1]}":${JSON.stringify(value)}}}'`,
      ].join('\n'));
    }
    if (!OPERATORS.has(operator)) {
      die(2, `--where: "${operator}" is not a Payload operator. Available: ${[...OPERATORS].join(', ')}.`);
    }
    return { [field]: { [operator]: value } };
  });
  return clauses.length === 1 ? clauses[0] : { and: clauses };
}

function buildQuery(opts) {
  const params = new URLSearchParams();
  if (opts.where) serializeInto(params, parseWhere(opts.where), 'where');
  if (opts.locale) params.set('locale', opts.locale);
  if (opts['fallback-locale']) params.set('fallback-locale', opts['fallback-locale']);
  params.set('depth', opts.depth ?? '0');
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.limit) params.set('limit', opts.limit);
  if (opts.page) params.set('page', opts.page);
  for (const f of (opts.select || '').split(',').filter(Boolean)) params.set(`select[${f.trim()}]`, 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function tokenCachePath(base, email) {
  const id = createHash('sha1').update(`${base}|${email}`).digest('hex').slice(0, 16);
  return join(tmpdir(), `payload-api-token-${id}.json`);
}

async function resolveAuth(base, api, opts) {
  // Payload's auth collection is conventionally `users`, but nothing requires it —
  // it is whichever collection carries `auth: true`, and discovery reports the name.
  const collection = opts['auth-collection']
    || process.env.PAYLOAD_AUTH_COLLECTION
    || process.env.PAYLOAD_API_KEY_COLLECTION
    || 'users';

  if (process.env.PAYLOAD_API_KEY) {
    // An API key authenticates against whichever database holds that user. A
    // production key silently makes every request a production request, which is
    // why `whoami` reports the email alongside the base URL.
    return { header: `${collection} API-Key ${process.env.PAYLOAD_API_KEY}`, mode: `API-Key (${collection})`, collection };
  }
  if (process.env.PAYLOAD_TOKEN) {
    return { header: `JWT ${process.env.PAYLOAD_TOKEN}`, mode: 'JWT (PAYLOAD_TOKEN)', collection };
  }

  const email = process.env.PAYLOAD_EMAIL;
  const password = process.env.PAYLOAD_PASSWORD;
  if (!email || !password) {
    die(2, [
      'No credentials. Set one of:',
      '  PAYLOAD_API_KEY          (+ PAYLOAD_AUTH_COLLECTION if the auth collection is not "users")',
      '  PAYLOAD_TOKEN            an existing JWT',
      '  PAYLOAD_EMAIL + PAYLOAD_PASSWORD',
      'A project keeping its key in a gitignored .env can pass --env-file <path>.',
    ].join('\n'));
  }

  const cache = tokenCachePath(base, email);
  if (!opts['no-cache'] && existsSync(cache)) {
    try {
      const { token, exp } = JSON.parse(readFileSync(cache, 'utf8'));
      if (token && exp && exp * 1000 > Date.now() + 60_000) {
        return { header: `JWT ${token}`, mode: `JWT (cached login as ${email})`, collection };
      }
    } catch { /* a corrupt cache is not worth reporting — just log in again */ }
  }

  let res;
  try {
    res = await fetch(`${base}${api}/${collection}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(Number(opts.timeout || 30000)),
    });
  } catch (e) {
    die(3, `Cannot reach ${base}${api}/${collection}/login — ${e.message}\n`
      + '  Check that the server is running and that --base and --api-route are right.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    die(2, `Login failed at ${base}${api}/${collection}/login (HTTP ${res.status}): ${body?.errors?.[0]?.message || 'no token returned'}`);
  }
  if (!opts['no-cache']) {
    try {
      writeFileSync(cache, JSON.stringify({ token: body.token, exp: body.exp }), { mode: 0o600 });
      chmodSync(cache, 0o600);
    } catch { /* caching is an optimisation; failing to cache must not fail the call */ }
  }
  return { header: `JWT ${body.token}`, mode: `JWT (login as ${email})`, collection };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

// Payload nests validation failures two levels deep. Flattened to `path — message`
// lines this is the difference between a fixable failure and a wall of JSON.
function flattenErrors(body) {
  const lines = [];
  for (const err of body?.errors || []) {
    const inner = err?.data?.errors || err?.data;
    if (Array.isArray(inner) && inner.length) {
      for (const d of inner) lines.push(`  ${d.path || d.field || '?'} — ${d.message}`);
    } else {
      lines.push(`  ${err.message || JSON.stringify(err)}`);
    }
  }
  return lines.length ? lines : ['  (no error detail in the response body)'];
}

function reportHttpError(res, bodyText, body, ctx) {
  const out = [`HTTP ${res.status} ${res.statusText} — ${ctx.method} ${ctx.url}`];
  if (body) {
    out.push(...flattenErrors(body));
  } else {
    out.push('  Response was not JSON. If this is a Next.js dev server it may still be compiling.');
    out.push(`  First 500 chars: ${bodyText.slice(0, 500)}`);
  }
  if (res.status === 401 || res.status === 403) {
    out.push(`  Auth mode used: ${ctx.authMode}. Run \`whoami\` against ${ctx.base} to check who the credentials resolve to.`);
  }
  if (res.status === 404) {
    out.push('  A 404 means either the collection slug or the document id is wrong — check the slug first.');
  }
  if (ctx.method !== 'GET') {
    out.push('  Do NOT retry this write. On Workers/D1 a failed-looking write can have succeeded; a retry duplicates it.');
  }
  die(1, out.join('\n'));
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const isRichText = (v) => isObj(v) && isObj(v.root);

function fmtValue(v) {
  if (v === undefined) return '(absent)';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v.length > 60 ? `${v.slice(0, 57)}…` : v);
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
  if (isRichText(v)) return `rich text (${v.root.children?.length ?? 0} blocks)`;
  if (isObj(v)) return `{${Object.keys(v).length} keys}`;
  return JSON.stringify(v);
}

// A path-level summary that reaches the leaves. A group reported as "meta: changed"
// tells you nothing about which of its fields moved, and on a database without
// version history the diff is the last chance to notice a change you did not intend.
// A diff too big to read is not a safety measure either, so values are truncated and
// rich text is summarized rather than expanded.
function walkDiff(a, b, path, lines, warnings, depth) {
  if (same(a, b)) { if (depth === 0) lines.push(`  ${path}: unchanged`); return; }

  if (Array.isArray(a) && Array.isArray(b) && a.every(isObj) && b.every(isObj)) {
    const idsBefore = a.map((r) => r.id).filter((v) => v !== undefined && v !== null);
    const idsAfter = b.map((r) => r.id).filter((v) => v !== undefined && v !== null);
    const identical = idsBefore.length === idsAfter.length
      && idsBefore.every((v, i) => String(v) === String(idsAfter[i]));

    const changed = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (!same(a[i], b[i])) changed.push(i);
    const label = b.map((r, i) => (r.blockType && changed.includes(i) ? `${i} (${r.blockType})` : null)).filter(Boolean);
    const rows = (n) => `${n} row${n === 1 ? '' : 's'}`;

    lines.push(`  ${path}: ${rows(a.length)} in → ${rows(b.length)} out; row ids ${identical ? 'IDENTICAL' : '*** CHANGED ***'}`);
    if (changed.length) lines.push(`    rows touched: ${label.length ? label.join(', ') : changed.join(', ')}`);
    for (const i of changed) {
      if (a[i] && b[i]) walkDiff(a[i], b[i], `${path}[${i}]`, lines, warnings, depth + 1);
    }

    if (idsBefore.length && idsAfter.length < idsBefore.length) {
      const missing = idsBefore.length - idsAfter.length;
      warnings.push(
        `  ${path}: ${missing} outgoing ${missing === 1 ? 'row carries' : 'rows carry'} no \`id\`.\n` +
        '    Payload treats an id-less row as NEW. Rows recreated this way lose the localized values\n' +
        "    stored against the old rows in whatever locale you are not currently looking at.\n" +
        '    Unless you are deliberately replacing this array, re-send each existing row with its `id`.',
      );
    }
    return;
  }

  // Recurse through groups, block rows and the {pl, en} wrappers a locale=all read
  // produces — but stop at rich text, which would expand into hundreds of lines.
  if (isObj(a) && isObj(b) && !isRichText(a) && !isRichText(b) && depth < 6) {
    for (const key of Object.keys(b)) {
      walkDiff(a[key], b[key], `${path}.${key}`, lines, warnings, depth + 1);
    }
    return;
  }

  lines.push(`  ${path}: ${fmtValue(a)} → ${fmtValue(b)}`);
}

function summarizeDiff(before, after) {
  const lines = [];
  const warnings = [];
  for (const key of Object.keys(after)) walkDiff(before?.[key], after[key], key, lines, warnings, 0);
  return { lines, warnings };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function request(ctx, { method, path, query = '', body, formData }) {
  const url = `${ctx.base}${path}${query}`;
  const headers = { Authorization: ctx.auth.header };
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, signal: AbortSignal.timeout(ctx.timeout) });
  } catch (e) {
    const extra = method === 'GET' ? '' : '\n  A timeout is NOT proof the write failed. Verify with a read before retrying.';
    die(3, `Network error — ${method} ${url}\n  ${e.message}${extra}`);
  }

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* handled below */ }
  if (!res.ok) reportHttpError(res, text, json, { method, url, base: ctx.base, authMode: ctx.auth.mode });
  if (json === null) die(1, `Response was not JSON — ${method} ${url}\n  First 500 chars: ${text.slice(0, 500)}`);
  return json;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function readBody(opts) {
  if (opts.data) return JSON.parse(opts.data);
  if (opts['data-file']) return JSON.parse(readFileSync(opts['data-file'], 'utf8'));
  if (!process.stdin.isTTY) {
    const text = readFileSync(0, 'utf8').trim();
    if (text) return JSON.parse(text);
  }
  die(2, 'This command needs a body: pass --data <json>, --data-file <path>, or pipe JSON on stdin.');
}

function saveBackup(opts, collection, id, doc) {
  const dir = opts['backup-dir'] || '.payload-backups';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${collection}-${id}-${stamp}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(doc, null, 2));
  return file;
}

async function main() {
  const opts = parseArgs();
  const [command, arg1, arg2] = opts._;
  if (!command) die(2, 'Usage: node payload-api.mjs <command> [args] [options] — see the header of this file.');
  if (opts['env-file']) loadEnvFile(opts['env-file']);

  const isRead = READ_COMMANDS.has(command);
  if (opts['read-only'] && !isRead) {
    die(2, `--read-only is set, so \`${command}\` is refused. Reads available: ${[...READ_COMMANDS].join(', ')}.`);
  }

  const explicitBase = opts.base || process.env.PAYLOAD_BASE_URL;
  if (!explicitBase && !isRead) {
    die(2, [
      `\`${command}\` writes, so it needs an explicit target: pass --base <url> or set PAYLOAD_BASE_URL.`,
      'Reads fall back to http://localhost:3000; writes never guess, because a write to the wrong',
      'environment cannot be undone in a project without drafts or version history.',
    ].join('\n'));
  }
  const base = (explicitBase || 'http://localhost:3000').replace(/\/+$/, '');

  const host = (() => { try { return new URL(base).hostname; } catch { return die(2, `--base is not a valid URL: ${base}`); } })();
  const isLocal = LOCAL_HOSTS.has(host);
  if (!isRead && !isLocal && !opts.yes && !opts['dry-run']) {
    die(2, [
      `Refusing to ${command} against a non-local host: ${base}`,
      'This is a live target. Re-run with --yes once you have confirmed it with the user,',
      'or use --dry-run to see exactly what would be sent.',
    ].join('\n'));
  }

  // `routes.api` is configurable in payload.config.ts; `/api` is only the default.
  const api = `/${(opts['api-route'] ?? process.env.PAYLOAD_API_ROUTE ?? '/api').replace(/^\/+|\/+$/g, '')}`;
  const ctx = { base, api, timeout: Number(opts.timeout || 30000), auth: await resolveAuth(base, api, opts) };
  const query = buildQuery(opts);
  const out = (obj) => {
    if (opts.out) { mkdirSync(dirname(opts.out), { recursive: true }); writeFileSync(opts.out, JSON.stringify(obj, null, 2)); }
    if (opts.raw) process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
  };

  switch (command) {
    case 'whoami': {
      const me = await request(ctx, { method: 'GET', path: `${ctx.api}/${ctx.auth.collection}/me` });
      out(me);
      process.stdout.write(`base:  ${base}\nauth:  ${ctx.auth.mode}\n`);
      process.stdout.write(isLocal ? 'target: LOCAL\n' : 'target: *** NOT LOCAL — writes here are live ***\n');
      // `/me` answers 200 with `user: null` for a key that is simply unknown here —
      // credentials are scoped to one database, so a production key resolves to
      // nobody against a local one. Without this check an unauthenticated session
      // looks healthy until the first write fails with a confusing 403.
      if (!me?.user) {
        die(2, [
          'user:  NONE — these credentials are not valid against this base URL.',
          `An API key or login only exists in the database it was created in, so a key from another`,
          'environment resolves to nobody here rather than erroring. Check that the key and the base',
          'URL belong to the same environment before writing anything.',
        ].join('\n'));
      }
      process.stdout.write(`user:  ${me.user.email}\nid:    ${me.user.id}\n`);
      break;
    }

    case 'login': {
      process.stdout.write(`base: ${base}\nauth: ${ctx.auth.mode}\n`);
      break;
    }

    case 'find': {
      if (!arg1) die(2, 'find needs a collection slug.');
      const res = await request(ctx, { method: 'GET', path: `${ctx.api}/${arg1}`, query });
      out(res);

      // Payload ignores a filter it cannot resolve instead of rejecting it, so a
      // mistyped field name silently returns the whole collection. One cheap
      // unfiltered count makes that visible instead of leaving it to be noticed.
      if (opts.where) {
        const total = await request(ctx, {
          method: 'GET', path: `${ctx.api}/${arg1}`, query: '?limit=1&depth=0&select[id]=true',
        });
        if (res.totalDocs > 0 && res.totalDocs === total.totalDocs) {
          process.stderr.write(
            `\nCHECK THE FILTER — it matched every document in ${arg1} (${res.totalDocs} of ${total.totalDocs}).\n` +
            '  That is a legitimate result if the condition really is true of all of them. It is also\n' +
            '  exactly what a filter Payload could not resolve looks like, because an unresolvable\n' +
            '  path is ignored rather than rejected. Confirm the field name before acting on this,\n' +
            '  especially before a bulk write.\n\n',
          );
        }
      }

      if (opts.raw) break;
      process.stdout.write(`${res.totalDocs} doc(s) in ${arg1}; page ${res.page}/${res.totalPages}, ${res.docs?.length ?? 0} returned\n`);
      const body = JSON.stringify(res.docs ?? [], null, 2);
      // Documents with a full block stack run to hundreds of kilobytes. Spilling
      // that into a caller's context by default is worse than making them ask:
      // write it out and say so, rather than truncating something they'd read as complete.
      if (body.length <= 50_000) { process.stdout.write(`${body}\n`); break; }
      const spill = opts.out || join(tmpdir(), `payload-find-${arg1}-${Date.now()}.json`);
      if (!opts.out) writeFileSync(spill, JSON.stringify(res, null, 2));
      process.stdout.write(
        `Response is ${Math.round(body.length / 1024)} KB — written to ${spill} instead of printed.\n` +
        'Re-run with --select <fields> to trim it, or read that file.\n',
      );
      break;
    }

    case 'get': {
      if (!arg1 || !arg2) die(2, 'get needs a collection slug and a document id.');
      const doc = await request(ctx, { method: 'GET', path: `${ctx.api}/${arg1}/${arg2}`, query });
      out(doc);
      if (!opts.raw) process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
      break;
    }

    case 'get-global': {
      if (!arg1) die(2, 'get-global needs a global slug.');
      const doc = await request(ctx, { method: 'GET', path: `${ctx.api}/globals/${arg1}`, query });
      out(doc);
      if (!opts.raw) process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
      break;
    }

    case 'create': {
      if (!arg1) die(2, 'create needs a collection slug.');
      const data = readBody(opts);
      if (opts['dry-run']) {
        process.stdout.write(`DRY RUN — POST ${base}${ctx.api}/${arg1}${query}\n${JSON.stringify(data, null, 2)}\n`);
        break;
      }
      const res = await request(ctx, { method: 'POST', path: `${ctx.api}/${arg1}`, query, body: data });
      out(res);
      process.stdout.write(`created ${arg1}/${res?.doc?.id} at ${base}\n`);
      break;
    }

    case 'update': {
      if (!arg1 || !arg2) die(2, 'update needs a collection slug and a document id.');
      const data = readBody(opts);

      // Always compare against locale=all: a single-locale read cannot show what a
      // write is about to do to the other locale.
      const current = await request(ctx, {
        method: 'GET', path: `${ctx.api}/${arg1}/${arg2}`, query: '?depth=0&locale=all',
      });
      const { lines, warnings } = summarizeDiff(current, data);
      process.stdout.write(`${opts['dry-run'] ? 'DRY RUN — ' : ''}PATCH ${base}${ctx.api}/${arg1}/${arg2}${query}\n`);
      process.stdout.write(`${lines.join('\n')}\n`);
      if (warnings.length) process.stderr.write(`\nWARNING\n${warnings.join('\n')}\n\n`);
      if (opts['dry-run']) break;

      if (!opts['no-backup']) process.stdout.write(`backup: ${saveBackup(opts, arg1, arg2, current)}\n`);
      const res = await request(ctx, { method: 'PATCH', path: `${ctx.api}/${arg1}/${arg2}`, query, body: data });
      out(res);
      process.stdout.write(`updated ${arg1}/${arg2} at ${base}\n`);
      break;
    }

    case 'update-global': {
      if (!arg1) die(2, 'update-global needs a global slug.');
      const data = readBody(opts);
      const current = await request(ctx, { method: 'GET', path: `${ctx.api}/globals/${arg1}`, query: '?depth=0&locale=all' });
      const { lines, warnings } = summarizeDiff(current, data);
      process.stdout.write(`${opts['dry-run'] ? 'DRY RUN — ' : ''}POST ${base}${ctx.api}/globals/${arg1}${query}\n${lines.join('\n')}\n`);
      if (warnings.length) process.stderr.write(`\nWARNING\n${warnings.join('\n')}\n\n`);
      if (opts['dry-run']) break;

      if (!opts['no-backup']) process.stdout.write(`backup: ${saveBackup(opts, `global-${arg1}`, 'current', current)}\n`);
      const res = await request(ctx, { method: 'POST', path: `${ctx.api}/globals/${arg1}`, query, body: data });
      out(res);
      process.stdout.write(`updated global ${arg1} at ${base}\n`);
      break;
    }

    case 'delete': {
      if (!arg1 || !arg2) die(2, 'delete needs a collection slug and a document id.');
      const current = await request(ctx, { method: 'GET', path: `${ctx.api}/${arg1}/${arg2}`, query: '?depth=0&locale=all' });
      if (opts['dry-run']) {
        process.stdout.write(`DRY RUN — DELETE ${base}${ctx.api}/${arg1}/${arg2}\nwould delete: ${JSON.stringify(current).length} bytes of document\n`);
        break;
      }
      if (!opts['no-backup']) process.stdout.write(`backup: ${saveBackup(opts, arg1, arg2, current)}\n`);
      const res = await request(ctx, { method: 'DELETE', path: `${ctx.api}/${arg1}/${arg2}`, query });
      out(res);
      process.stdout.write(`deleted ${arg1}/${arg2} at ${base}\n`);
      break;
    }

    case 'upload': {
      if (!arg1) die(2, 'upload needs a collection slug.');
      if (!opts.file) die(2, 'upload needs --file <path>.');
      const buf = readFileSync(opts.file);
      const name = basename(opts.file);
      const type = MIME[extname(name).toLowerCase()] || 'application/octet-stream';
      // Payload's multipart contract: the binary goes in `file`, everything else
      // in a `_payload` part holding the document JSON as a string.
      const data = opts.data || opts['data-file'] ? readBody(opts) : {};
      if (opts['dry-run']) {
        process.stdout.write(`DRY RUN — POST ${base}${ctx.api}/${arg1}${query}\nfile: ${name} (${type}, ${buf.length} bytes)\n_payload: ${JSON.stringify(data)}\n`);
        break;
      }
      const form = new FormData();
      form.append('file', new Blob([buf], { type }), name);
      form.append('_payload', JSON.stringify(data));
      const res = await request(ctx, { method: 'POST', path: `${ctx.api}/${arg1}`, query, formData: form });
      out(res);
      const doc = res?.doc ?? res;
      process.stdout.write(`uploaded ${arg1}/${doc.id} — ${doc.filename} → ${doc.url}\n`);
      if (doc.filename !== name) {
        process.stdout.write(`note: stored as "${doc.filename}", not "${name}" — Payload de-duplicates filenames. Use the returned url.\n`);
      }
      break;
    }

    default:
      die(2, `Unknown command: ${command}`);
  }
}

main();
