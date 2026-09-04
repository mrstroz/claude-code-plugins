#!/usr/bin/env node

// jira.mjs — named operations against the issue tracker's REST API.
//
// This is the only place in the plugin allowed to talk to the tracker. Every
// other skill calls an operation by name, so when the tracker changes, or the
// payload shape changes, or a confirmation rule changes, there is one file to
// edit instead of a dozen prompts to re-read.
//
// Zero dependencies, Node 18+ (built-in fetch).
//
// The operations are listed by `jira.mjs help`, and usage() below is the one
// place they are spelled out — a second copy here would be the one that goes
// stale.
//
// Credentials come from the shell environment and nowhere else: JIRA_EMAIL and
// JIRA_API_TOKEN. They never belong in an application's own env file, which is
// usually validated fail-fast — a variable added there becomes a production
// requirement for an application that does not need it.
//
// The site and the project key come from the nearest .ai/jira.config.json above
// the working directory, or — when a project already carries the Tesoro harness
// — from the `tracker` block of its .ai/tesoro.config.json. Both are overridden
// by --site and --project, which is how a one-off call runs from a directory
// that belongs to no project at all.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, dirname, resolve, join } from 'node:path';
import { markdownToAdf, adfToText } from './adf.mjs';

const API = '/rest/api/3';

// In the order they are tried at every directory on the way up. The Tesoro file
// is a fallback rather than a peer: a project that has both wrote the first one
// on purpose, and it wins.
const CONFIG_CANDIDATES = [join('.ai', 'jira.config.json'), join('.ai', 'tesoro.config.json')];

// Bulk export reads whole issues rather than the search row, so it needs a few
// fields the search does not carry — and no attachments or links, which nothing
// downstream reads and which triple the size of a thousand-issue file.
const EXPORT_FIELDS = [
  'summary',
  'issuetype',
  'status',
  'assignee',
  'reporter',
  'priority',
  'labels',
  'fixVersions',
  'components',
  'parent',
  'resolution',
  'description',
  'created',
  'updated',
];

// --summaries-only reads only what a search row carries, one request per page
// of a thousand, which is what makes discovery over a project's whole history
// affordable.
const EXPORT_SUMMARY_FIELDS = EXPORT_FIELDS.filter((f) => f !== 'description');

const EXPORT_CONCURRENCY = 5;
const EXPORT_PAGE = 1000;
const EXPORT_COMMENTS_MAX = 50;

// An attachment carries two identities. The numeric id is what the upload
// returns and what every attachment endpoint takes; the uuid underneath it is
// what a `media` node in a description has to name, and the only place the
// tracker hands it over is the redirect on the attachment's content URL.
const MEDIA_ID = /\/file\/([0-9a-f-]{36})\//i;

// The two shapes an account id comes in. Only used to tell one apart from a display
// name, never to validate it — the tracker is the authority on that.
const ACCOUNT_ID = /^[0-9a-f]{24}$|^\d+:[0-9a-f-]{36}$/i;

// A comment is addressed either by its bare id or by the browse URL that names
// it — the form a person actually has in hand, and the form `add-comment` prints
// on its way out.
const FOCUSED_COMMENT = /[?&]focusedCommentId=(\d+)/;

const ISSUE_FIELDS = [
  'summary',
  'issuetype',
  'status',
  'labels',
  'parent',
  'subtasks',
  'assignee',
  'reporter',
  'description',
  'priority',
  'resolution',
  'resolutiondate',
  'issuelinks',
  'attachment',
  'created',
  'updated',
];

// A search result is read to decide which issue is worth opening, so it carries
// what that decision needs and nothing else. Descriptions come from get-issue,
// on the one or two matches that looked right.
const SEARCH_FIELDS = ['summary', 'issuetype', 'status', 'resolution', 'labels', 'assignee', 'updated'];

const SEARCH_LIMIT_DEFAULT = 20;
const SEARCH_LIMIT_MAX = 50;
const COMMENT_LIMIT_DEFAULT = 10;

// --- failure -----------------------------------------------------------------

// Exit codes are part of the contract with the calling skill: 2 means the call
// was malformed and retrying it unchanged is pointless, 1 means the tracker or
// the input said no.
function fail(message, code = 1) {
  process.stderr.write(`jira: ${message}\n`);
  process.exit(code);
}

function usage(code = 2) {
  process.stderr.write(
    [
      'Usage:',
      '  jira.mjs whoami [--json]',
      '  jira.mjs show-config [--json]',
      '  jira.mjs get-issue <KEY> [--with-comments [N]]',
      '  jira.mjs search-issues [--jql <predicate>] [--limit N] [--dry-run] [--json]',
      '  jira.mjs export-issues --output <path.json> [--jql <predicate>] [--all-projects]',
      '                        [--summaries-only] [--dry-run]',
      '  jira.mjs list-versions [--json]',
      '  jira.mjs list-types [--json]',
      '  jira.mjs find-user <query> [--json]',
      '  jira.mjs create-issue --type <type> --summary <text> --description-file <path>',
      '                        [--labels a,b] [--parent <KEY>] [--assignee <person>]',
      '                        [--attach <path>[,<path>]] [--dry-run] [--json]',
      '  jira.mjs update-issue <KEY> [--summary <text>] [--description-file <path>]',
      '                        [--labels a,b] [--assignee <person>] [--attach <path>[,<path>]]',
      '                        [--dry-run] [--json]',
      '  jira.mjs attach-file <KEY> --file <path>[,<path>] [--dry-run] [--json]',
      '  jira.mjs link-issues <KEY> --to <KEY> [--type Relates] [--dry-run] [--json]',
      '  jira.mjs add-comment <KEY> --body-file <path> [--reply-to <id|url>]',
      '                       [--dry-run] [--json]',
      '',
      'Options:',
      '  --config <path>   configuration file (default: nearest .ai/jira.config.json,',
      '                    else the tracker block of .ai/tesoro.config.json)',
      '  --site <host>     tracker host, e.g. company.atlassian.net; overrides the file',
      '  --project <KEY>   project key; overrides the file',
      '  --all-projects    export-issues: send the predicate as written, without the',
      '                    project scope composed around it',
      '  --summaries-only  export-issues: search rows only, no descriptions or comments',
      '  --output <path>   export-issues: where the JSON goes; directories are created',
      '  --assignee <p>    "me", a display name from people or the issue, or an account id',
      '  --attach <paths>  files to upload; ![alt](name.png) in the description embeds one',
      '  --dry-run         print the request that would be sent, send nothing',
      '  --json            machine-readable output',
      '  --jql <predicate> a JQL predicate; the project scope is composed around it',
      `  --limit N         search results, 1-${SEARCH_LIMIT_MAX} (default ${SEARCH_LIMIT_DEFAULT})`,
      "  --reply-to <c>    answer inside a comment's thread; a comment id or a link to one",
      '',
      'Environment: JIRA_EMAIL, JIRA_API_TOKEN',
      '',
    ].join('\n'),
  );
  process.exit(code);
}

// --- input -------------------------------------------------------------------

const FLAGS = new Set(['--dry-run', '--json', '--help', '--all-projects', '--summaries-only']);

// Every flag that takes a value. A flag outside this set and FLAGS is a typo,
// and a typo that is silently dropped turns `--lmit 5` into the default limit
// with nothing said — the caller reads the output as the answer to the question
// they asked.
const VALUED_FLAGS = new Set([
  '--config',
  '--site',
  '--project',
  '--jql',
  '--limit',
  '--output',
  '--type',
  '--summary',
  '--description-file',
  '--labels',
  '--parent',
  '--assignee',
  '--attach',
  '--file',
  '--to',
  '--body-file',
  '--reply-to',
]);

// Flags whose count is optional: `--with-comments` and `--with-comments 5` both
// have to read naturally, so the number is consumed only when there is one.
const COUNTED_FLAGS = new Set(['--with-comments']);

function camelCase(flag) {
  return flag.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (FLAGS.has(arg)) {
      parsed[camelCase(arg)] = true;
    } else if (COUNTED_FLAGS.has(arg)) {
      parsed[camelCase(arg)] = /^\d+$/.test(argv[i + 1] || '') ? Number(argv[++i]) : true;
    } else if (arg.startsWith('--')) {
      if (!VALUED_FLAGS.has(arg)) fail(`unknown option: ${arg}`, 2);
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value`, 2);
      parsed[arg.slice(2)] = value;
    } else {
      parsed._.push(arg);
    }
  }

  return parsed;
}

// A value that reaches a URL path has to be checked first — it may have come
// from an issue description, and content from the tracker is data, not trust.
function assertKey(value, what) {
  if (!/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(value || '')) {
    fail(`${what} is not an issue key: ${value}`, 2);
  }
  return value;
}

// Same check as an issue key and for the same reason — the value ends up in a
// URL path. The URL form is accepted because it is what somebody copies out of
// the browser; whether the id exists is the tracker's answer, not this one's.
function parseCommentId(value) {
  const raw = String(value || '');
  const id = /^\d+$/.test(raw) ? raw : (raw.match(FOCUSED_COMMENT) || [])[1];
  if (!id) fail(`--reply-to is not a comment id or a link to one: ${value}`, 2);
  return id;
}

// --- jql ---------------------------------------------------------------------

// One pass over the predicate, because both things the composer needs to know
// depend on which characters sit inside a string literal: where a trailing
// ORDER BY starts, and whether the brackets balance.
//
// Balance is the load-bearing part. The project scope holds only because the
// predicate ends up inside brackets, and `project = "X" AND (a) OR (b)` reads as
// `(project = "X" AND a) OR b` — one stray bracket and the search leaves the
// project. This is a sanity check rather than a security boundary: the call is
// read-only, against a tracker whoever runs it can already read. What it buys
// day to day is catching an ordinary typo here, with a better message than the
// tracker's, instead of three requests later.
function scanPredicate(jql) {
  const inString = new Array(jql.length).fill(false);
  let quote = null;
  let depth = 0;

  for (let i = 0; i < jql.length; i++) {
    const char = jql[i];

    if (quote) {
      inString[i] = true;
      if (char === '\\' && i + 1 < jql.length) inString[++i] = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      inString[i] = true;
    } else if (char === '(') {
      depth++;
    } else if (char === ')' && --depth < 0) {
      fail(`--jql has an unmatched ")" at character ${i + 1}`, 2);
    }
  }

  if (quote) fail('--jql has an unterminated quote', 2);
  if (depth > 0) fail(`--jql has ${depth} unclosed "("`, 2);

  return inString;
}

// The project scope is composed here rather than written by the caller, for two
// reasons: the key belongs to the configuration and may never be spelled out in
// a skill, and a search across the whole instance is never what anybody meant.
// ORDER BY has to end the query, so it cannot travel inside the brackets — it is
// cut off first and re-attached after the wrapping.
function composeJql(config, predicate) {
  const raw = (predicate || '').trim();
  const inString = scanPredicate(raw);

  const pattern = /\border\s+by\b/gi;
  let cut = -1;
  for (let match; (match = pattern.exec(raw)); ) {
    if (!inString[match.index]) cut = match.index;
  }

  const where = (cut < 0 ? raw : raw.slice(0, cut)).trim();
  const order = cut < 0 ? '' : raw.slice(cut).replace(/^order\s+by\s*/i, '').trim();
  const scope = `project = "${config.projectKey}"`;

  return `${where ? `${scope} AND (${where})` : scope} ORDER BY ${order || 'updated DESC'}`;
}

// --- configuration -----------------------------------------------------------

// Searching upwards means the script works from anywhere inside a checkout,
// which is where an agent usually is when it calls this.
function findConfig(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) fail(`configuration file not found: ${explicit}`, 2);
    return explicit;
  }

  let dir = process.cwd();
  for (;;) {
    for (const relative of CONFIG_CANDIDATES) {
      const candidate = join(dir, relative);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

// What a missing file has to say: where the values go, in the shape the file
// takes, so the calling skill can offer to write it rather than describe it.
function noConfigMessage() {
  return [
    `no ${CONFIG_CANDIDATES[0]} found in this directory or above it.`,
    'Either run from inside the project, pass --site and --project, or create the file:',
    '',
    '  {',
    '    "tracker": { "site": "company.atlassian.net", "projectKey": "PROJ" },',
    '    "people": {}',
    '  }',
  ].join('\n');
}

// The file is optional once --site and --project are both given, which is what
// lets a daily summary run from a home directory. Everything else the file may
// carry — people, language, taxonomy, risk — travels along for the skills that
// read it through show-config; the script itself uses only tracker and people.
function loadConfig(args) {
  const path = findConfig(args.config);
  let parsed = {};

  if (path) {
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      fail(`${path} is not valid JSON: ${error.message}`, 2);
    }
  }

  const site = args.site || parsed?.tracker?.site;
  const projectKey = args.project || parsed?.tracker?.projectKey;

  if (!site || !projectKey) {
    // One flag without the other is a half-finished override, not a missing
    // file, and the message has to name the half that is missing.
    if (args.site || args.project) {
      fail(`--site and --project go together; missing ${args.site ? '--project' : '--site'}`, 2);
    }
    if (!path) fail(noConfigMessage(), 2);
    if (!site) fail(`${path} has no tracker.site`, 2);
    fail(`${path} has no tracker.projectKey`, 2);
  }

  if (path && basename(path) === 'tesoro.config.json') {
    process.stderr.write(`jira: reading tracker and people from ${path}\n`);
  }

  return {
    path,
    site,
    projectKey,
    people: parsed.people || {},
    language: parsed.language || null,
    taxonomy: parsed.taxonomy || null,
    risk: parsed.risk || null,
  };
}

function credentials() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) {
    fail('JIRA_EMAIL and JIRA_API_TOKEN must be set in the shell environment');
  }
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

// --- transport ---------------------------------------------------------------

// The one caller that has to see a failing status rather than exit on it is
// the search fallback, so the exit lives in request() and the status in here.
async function attempt(config, method, path, body = null) {
  const url = `https://${config.site}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: credentials(),
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

async function request(config, method, path, body = null) {
  const { ok, status, text } = await attempt(config, method, path, body);
  if (!ok) {
    // The tracker's error bodies name the offending field, which is the single
    // most useful thing to put in front of whoever has to fix the call.
    fail(`${method} ${path} returned ${status}\n${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function browseUrl(config, key) {
  return `https://${config.site}/browse/${key}`;
}

// What the converter needs to know about this instance: the site so an issue key
// can become a smart link, the project key so only this project's keys do, and
// the account id behind every `@[Name]` the text holds. Passing the Markdown is
// what makes the name resolution unskippable — the options a write converts with
// cannot be built without it, so no write can reach the API with a name nobody
// checked. Reads pass nothing: there is no name to resolve on the way back. The
// key, when there is one, lets a name resolve against the people on that issue.
async function adfOptions(config, markdown = null, media = null, key = null) {
  const people = markdown === null ? null : await resolveMentioned(config, markdown, key);
  return { site: config.site, projectKey: config.projectKey, media, people };
}

// Reads never resolve anybody, so they need no round trip.
function readOptions(config) {
  return { site: config.site, projectKey: config.projectKey, media: null, people: null };
}

function splitPaths(value) {
  return String(value || '')
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);
}

// Not `request()`: an upload is multipart, so the body must not be JSON and the
// Content-Type has to be left to fetch, which is the only thing that knows the
// boundary it generated. The token header is what the tracker refuses the call
// without, in an error that names neither the header nor the fix.
async function uploadAttachment(config, key, filePath) {
  const path = resolve(filePath);
  if (!existsSync(path)) fail(`attachment not found: ${path}`, 2);

  const form = new FormData();
  form.append('file', new Blob([readFileSync(path)]), basename(path));

  const response = await fetch(`https://${config.site}${API}/issue/${key}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: credentials(),
      Accept: 'application/json',
      'X-Atlassian-Token': 'no-check',
    },
    body: form,
  });

  const text = await response.text();
  if (!response.ok) {
    fail(`POST ${API}/issue/${key}/attachments returned ${response.status}\n${text}`);
  }

  const [attachment] = JSON.parse(text);
  return { id: attachment.id, filename: attachment.filename };
}

// The redirect is the only place the media id is published. Following it would
// download the file; stopping at the 303 costs one request and gives the uuid a
// `media` node has to carry.
async function resolveMediaId(config, attachmentId) {
  const response = await fetch(`https://${config.site}${API}/attachment/content/${attachmentId}`, {
    headers: { Authorization: credentials() },
    redirect: 'manual',
  });

  const match = (response.headers.get('location') || '').match(MEDIA_ID);
  return match ? match[1] : null;
}

// Sequential rather than parallel: uploads are few, and a failure that names the
// file it happened on is worth more here than the second it would save.
async function attachAll(config, key, paths) {
  const media = {};
  const uploaded = [];

  for (const path of paths) {
    const attachment = await uploadAttachment(config, key, path);
    const mediaId = await resolveMediaId(config, attachment.id);

    if (mediaId) media[attachment.filename] = mediaId;
    else {
      process.stderr.write(
        `jira: ${attachment.filename} is attached but its media id could not be resolved — ` +
          'it will not appear inside the description\n',
      );
    }

    uploaded.push({ ...attachment, mediaId });
  }

  return { media, uploaded };
}

const IMAGE_SRC = /!\[[^\]]*\]\(([^)\s]+)\)/g;

// Which files the description asks to show, so an upload that nothing references
// does not trigger a second write, and a reference nothing uploaded gets said
// out loud rather than quietly turning into a line of text.
function imageReferences(markdown) {
  return [...String(markdown).matchAll(IMAGE_SRC)].map((match) => match[1]);
}

function reportMissingImages(markdown, media) {
  const missing = imageReferences(markdown).filter(
    (src) => !/^https?:\/\//.test(src) && !/^media:/.test(src) && !media[src] && !media[basename(src)],
  );

  for (const src of missing) {
    process.stderr.write(`jira: the description shows ${src}, which nothing attached\n`);
  }
}

function referencesUploads(markdown, media) {
  return imageReferences(markdown).some((src) => media[src] || media[basename(src)]);
}

// --- operations --------------------------------------------------------------

async function whoami(config, args) {
  const me = await request(config, 'GET', `${API}/myself`);
  const result = {
    accountId: me.accountId,
    displayName: me.displayName,
    email: me.emailAddress || null,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.displayName} — ${result.accountId}\n`);
  }
}

async function getIssue(config, args) {
  const key = assertKey(args._[1], 'issue key');
  const issue = await request(
    config,
    'GET',
    `${API}/issue/${key}?fields=${ISSUE_FIELDS.join(',')}`,
  );

  const f = issue.fields || {};
  const result = {
    key: issue.key,
    url: browseUrl(config, issue.key),
    type: f.issuetype?.name || null,
    status: f.status?.name || null,
    // The name and the category answer different questions. A board can call a
    // column anything; the category is what says the work is finished.
    statusCategory: f.status?.statusCategory?.name || null,
    resolution: f.resolution?.name || null,
    resolutionDate: f.resolutiondate || null,
    summary: f.summary || null,
    labels: f.labels || [],
    priority: f.priority?.name || null,
    parent: f.parent ? { key: f.parent.key, summary: f.parent.fields?.summary || null } : null,
    subtasks: (f.subtasks || []).map((s) => ({
      key: s.key,
      summary: s.fields?.summary || null,
      status: s.fields?.status?.name || null,
    })),
    assignee: f.assignee ? { accountId: f.assignee.accountId, name: f.assignee.displayName } : null,
    reporter: f.reporter ? { accountId: f.reporter.accountId, name: f.reporter.displayName } : null,
    // The relation is read from the side this issue is on, so it comes out as
    // "duplicates" or "is blocked by" — which is the sentence somebody needs —
    // rather than the symmetric name of the link type.
    links: (f.issuelinks || []).map((link) => {
      const other = link.inwardIssue || link.outwardIssue;
      return {
        relation: (link.inwardIssue ? link.type?.inward : link.type?.outward) || link.type?.name || null,
        key: other?.key || null,
        summary: other?.fields?.summary || null,
        status: other?.fields?.status?.name || null,
      };
    }),
    // Metadata only. A defect report carries screenshots, and knowing they exist
    // is what matters here; fetching them is somebody else's decision.
    attachments: (f.attachment || []).map((a) => ({
      filename: a.filename || null,
      mimeType: a.mimeType || null,
      size: a.size ?? null,
      url: a.content || null,
    })),
    created: f.created || null,
    updated: f.updated || null,
    description: f.description ? adfToText(f.description, readOptions(config)).trim() : '',
  };

  if (args.withComments !== undefined) {
    const limit = typeof args.withComments === 'number' ? args.withComments : COMMENT_LIMIT_DEFAULT;
    Object.assign(result, await readComments(config, key, limit));
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

// Comments are opt-in because a thread can outweigh everything else on the
// issue, and most reads do not need it. The tracker returns newest first, which
// is the right end to keep when truncating and the wrong end to read from, so
// the page is reversed on the way out.
//
// Replies arrive in that same flat page, mixed in by time, and read as somebody's
// standalone position once they are separated from what they answer. So they are
// nested back under their root here. Threads are one level deep, which is what
// makes a single pass enough: a root always precedes its own replies in time, so
// it is already known by the time they arrive.
async function readComments(config, key, limit) {
  const page = await request(
    config,
    'GET',
    `${API}/issue/${key}/comment?maxResults=${limit}&orderBy=-created`,
  );

  const fetched = (page.comments || []).length;
  const roots = new Map();
  const comments = [];

  for (const comment of (page.comments || []).reverse()) {
    const text = adfToText(comment.body, readOptions(config)).trim();
    const entry = {
      id: comment.id,
      author: comment.author?.displayName || null,
      created: comment.created || null,
      text,
    };

    // The tracker sends `id` as a string and `parentId` as a number for the same
    // comment, so the two are compared as text or a reply never finds its root.
    const parentId = comment.parentId === undefined ? null : String(comment.parentId);
    const root = parentId ? roots.get(parentId) : null;
    if (root) {
      (root.replies ||= []).push(entry);
      continue;
    }

    // Either a root, or a reply whose root fell outside the window. The second
    // one keeps `replyTo` and stays at the top level: saying it answers something
    // not shown is honest, and promoting it to a root would not be.
    if (parentId) entry.replyTo = parentId;
    else roots.set(entry.id, entry);
    comments.push(entry);
  }

  return {
    comments,
    // Counted over everything the page held, replies included — which is also why
    // truncation can cut a root away from the replies under it.
    commentsTruncated: (page.total ?? fetched) > fetched,
  };
}

async function searchIssues(config, args) {
  const limit = args.limit === undefined ? SEARCH_LIMIT_DEFAULT : Number(args.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_LIMIT_MAX) {
    fail(`--limit must be a whole number between 1 and ${SEARCH_LIMIT_MAX}`, 2);
  }

  const jql = composeJql(config, args.jql);
  const path =
    `${API}/search/jql?jql=${encodeURIComponent(jql)}` +
    `&maxResults=${limit}&fields=${SEARCH_FIELDS.join(',')}`;

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({ method: 'GET', path, jql }, null, 2)}\n`);
    return;
  }

  const page = await request(config, 'GET', path);
  const issues = (page.issues || []).map((issue) => {
    const f = issue.fields || {};
    return {
      key: issue.key,
      url: browseUrl(config, issue.key),
      type: f.issuetype?.name || null,
      status: f.status?.name || null,
      statusCategory: f.status?.statusCategory?.name || null,
      resolution: f.resolution?.name || null,
      labels: f.labels || [],
      assignee: f.assignee?.displayName || null,
      summary: f.summary || null,
      updated: f.updated || null,
    };
  });

  // `isLast` is how the tracker says there is another page. There is no paging
  // option here on purpose: a question that needs two hundred results is a
  // question that should have been asked more narrowly.
  const result = { jql, count: issues.length, more: page.isLast === false, issues };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${jql}\n\n`);
  if (!issues.length) process.stdout.write('no matches\n');

  for (const issue of issues) {
    process.stdout.write(
      [
        issue.key.padEnd(10),
        (issue.type || '').padEnd(8),
        (issue.status || '').padEnd(16),
        (issue.updated || '').slice(0, 10),
        issue.summary || '',
      ].join(' ') + '\n',
    );
  }

  if (result.more) {
    process.stdout.write(`\nmore than ${limit} match — narrow the predicate\n`);
  }
}

async function createIssue(config, args) {
  if (!args.type) fail('create-issue needs --type', 2);
  if (!args.summary) fail('create-issue needs --summary', 2);
  if (!args['description-file']) fail('create-issue needs --description-file', 2);

  const descriptionPath = resolve(args['description-file']);
  if (!existsSync(descriptionPath)) fail(`description file not found: ${descriptionPath}`, 2);
  const markdown = readFileSync(descriptionPath, 'utf8');

  // Checked before anything is created: a missing file discovered halfway
  // through leaves an issue behind that the retry would create a second time.
  const attachments = splitPaths(args.attach);
  for (const path of attachments) {
    if (!existsSync(resolve(path))) fail(`attachment not found: ${resolve(path)}`, 2);
  }

  const fields = {
    project: { key: config.projectKey },
    issuetype: { name: args.type },
    summary: args.summary,
    description: markdownToAdf(markdown, await adfOptions(config, markdown)),
  };

  if (args.labels) {
    fields.labels = args.labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  if (args.parent) fields.parent = { key: assertKey(args.parent, 'parent') };

  if (args.assignee) fields.assignee = { id: await resolveAssignee(config, args.assignee) };

  if (args.dryRun) {
    const steps = [{ method: 'POST', path: `${API}/issue`, body: { fields } }];
    if (attachments.length) {
      steps.push({ method: 'POST', path: `${API}/issue/<new key>/attachments`, files: attachments });
      steps.push({
        method: 'PUT',
        path: `${API}/issue/<new key>`,
        note: 'the description again, this time with the media ids the upload produced',
      });
    }
    process.stdout.write(`${JSON.stringify(attachments.length ? { steps } : steps[0], null, 2)}\n`);
    return;
  }

  const created = await request(config, 'POST', `${API}/issue`, { fields });
  const result = { key: created.key, url: browseUrl(config, created.key) };

  // An attachment cannot exist before the issue does, so a description that
  // shows one is necessarily written twice. Only the second write knows the
  // media ids, and it is skipped when nothing in the description needs them.
  if (attachments.length) {
    const { media, uploaded } = await attachAll(config, created.key, attachments);
    result.attachments = uploaded;

    if (referencesUploads(markdown, media)) {
      await request(config, 'PUT', `${API}/issue/${created.key}`, {
        fields: { description: markdownToAdf(markdown, await adfOptions(config, markdown, media)) },
      });
    }
    reportMissingImages(markdown, media);
  } else {
    reportMissingImages(markdown, {});
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.key} — ${result.url}\n`);
  }
}

// --- bulk reads ----------------------------------------------------------------

// Where the values came from, for the skill that has to decide whether to ask
// for them. Nothing here touches the tracker.
async function showConfig(config, args) {
  const result = {
    path: config.path,
    site: config.site,
    projectKey: config.projectKey,
    people: Object.keys(config.people),
    language: config.language,
    taxonomy: config.taxonomy,
    risk: config.risk,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${config.site} / ${config.projectKey} — ${config.path || 'from --site and --project'}\n`);
  process.stdout.write(`people: ${result.people.join(', ') || '(none)'}\n`);
  if (config.language) process.stdout.write(`language: ${config.language}\n`);
  if (config.taxonomy) process.stdout.write(`taxonomy: ${JSON.stringify(config.taxonomy)}\n`);
  if (config.risk) process.stdout.write(`risk: ${JSON.stringify(config.risk)}\n`);
}

// Every page of a search, on the endpoint that pages by cursor. The offset-based
// /search is kept only for an instance that has not been migrated, which
// answers 404 or 405 on the new path rather than a partial page.
async function searchAll(config, jql, fields) {
  const issues = [];

  // The first page is attempted rather than requested: a 404 or 405 here means
  // the endpoint does not exist on this instance, and the answer is the legacy
  // path, not an exit. Anything else failing is a real error and exits as one.
  const first = await attempt(config, 'POST', `${API}/search/jql`, { jql, maxResults: EXPORT_PAGE, fields });
  if (first.ok) {
    let page = JSON.parse(first.text || '{}');
    for (;;) {
      issues.push(...(page.issues || []));
      if (!page.nextPageToken) return issues;
      page = await request(config, 'POST', `${API}/search/jql`, {
        jql,
        maxResults: EXPORT_PAGE,
        fields,
        nextPageToken: page.nextPageToken,
      });
    }
  }
  if (first.status !== 404 && first.status !== 405) {
    fail(`POST ${API}/search/jql returned ${first.status}\n${first.text}`);
  }
  process.stderr.write('jira: /search/jql unavailable, falling back to /search\n');

  let startAt = 0;
  let total = Infinity;
  while (startAt < total) {
    const page = await request(config, 'POST', `${API}/search`, {
      jql,
      maxResults: EXPORT_PAGE,
      startAt,
      fields,
    });
    total = page.total || 0;
    issues.push(...(page.issues || []));
    startAt += page.issues?.length || EXPORT_PAGE;
  }
  return issues;
}

// The row every consumer reads. Names are kept from the previous exporter so a
// skill written against it keeps working; what is new is added, never renamed.
function exportRow(config, issue) {
  const f = issue.fields || {};
  return {
    key: issue.key,
    url: browseUrl(config, issue.key),
    type: f.issuetype?.name || '',
    status: f.status?.name || '',
    statusCategory: f.status?.statusCategory?.name || '',
    resolution: f.resolution?.name || '',
    priority: f.priority?.name || '',
    assignee: f.assignee?.displayName || '',
    reporter: f.reporter?.displayName || '',
    labels: f.labels || [],
    fixVersions: (f.fixVersions || []).map((v) => v.name),
    components: (f.components || []).map((c) => c.name),
    parent: f.parent?.key || '',
    summary: f.summary || '',
    created: (f.created || '').slice(0, 16),
    updated: (f.updated || '').slice(0, 16),
  };
}

// The newest fifty, oldest first, as flat Markdown. Threading is left to
// get-issue: an export is read by a skill summarising dozens of issues, and
// `replyTo` is enough for it to see that a comment answers another.
async function exportComments(config, key) {
  const first = await request(
    config,
    'GET',
    `${API}/issue/${key}/comment?maxResults=${EXPORT_COMMENTS_MAX}&orderBy=-created`,
  );
  return (first.comments || []).reverse().map((comment) => ({
    id: comment.id,
    author: comment.author?.displayName || '',
    created: (comment.created || '').slice(0, 16),
    ...(comment.parentId !== undefined ? { replyTo: String(comment.parentId) } : {}),
    body: adfToText(comment.body, readOptions(config)).trim(),
  }));
}

// Bounded parallelism that stops at the first failure: half a file with no
// error is worse than no file, because it gets read as complete.
async function eachLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let failed = null;

  async function worker() {
    while (next < items.length && !failed) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        failed = error;
        throw error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Everything a predicate matches, written to a file rather than printed. This is
// the one read here with no ceiling, because release notes and a daily summary
// genuinely need every issue in a version or a sprint — which is also why the
// output goes to disk, where a skill reads what it needs, instead of into the
// conversation whole. The predicate is scoped to the project like a search;
// --all-projects has to be said, because "my issues everywhere" is a real
// question and a whole-instance query by accident is not.
async function exportIssues(config, args) {
  if (!args.output) fail('export-issues needs --output <path.json>', 2);
  const output = resolve(args.output);
  const jql = args.allProjects
    ? (args.jql || '').trim() || fail('--all-projects needs a --jql predicate', 2)
    : composeJql(config, args.jql);
  const fields = args.summariesOnly ? EXPORT_SUMMARY_FIELDS : EXPORT_FIELDS;

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({ jql, fields, output }, null, 2)}\n`);
    return;
  }

  process.stderr.write(`jira: searching ${jql}\n`);
  const found = await searchAll(config, jql, fields);
  process.stderr.write(`jira: ${found.length} issues\n`);

  let issues;
  if (args.summariesOnly) {
    issues = found.map((issue) => exportRow(config, issue));
  } else {
    let done = 0;
    issues = await eachLimited(found, EXPORT_CONCURRENCY, async (issue) => {
      const row = exportRow(config, issue);
      row.description = issue.fields?.description
        ? adfToText(issue.fields.description, readOptions(config)).trim()
        : '';
      row.comments = await exportComments(config, issue.key);
      done++;
      if (done % 25 === 0 || done === found.length) {
        process.stderr.write(`jira: [${done}/${found.length}]\n`);
      }
      return row;
    });
  }

  const file = {
    meta: {
      jql,
      site: config.site,
      projectKey: args.allProjects ? null : config.projectKey,
      fetched: new Date().toISOString(),
      count: issues.length,
      ...(args.summariesOnly ? { mode: 'summaries-only' } : {}),
    },
    issues,
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(file, null, 2));
  process.stdout.write(`${output}\n`);
}

// The project's versions straight from the tracker, which is cheaper and more
// honest than scanning every issue for the names it carries: a version with no
// issues yet still exists.
async function listVersions(config, args) {
  const versions = await request(config, 'GET', `${API}/project/${config.projectKey}/versions`);
  const result = (versions || [])
    .map((v) => ({
      name: v.name,
      released: Boolean(v.released),
      archived: Boolean(v.archived),
      releaseDate: v.releaseDate || null,
      description: v.description || '',
    }))
    // What is still coming goes first, because that is what a roadmap asks for;
    // then the newest release; archived last, because nobody is asking about
    // those. Within a group, a later date or a higher name wins.
    .sort((a, b) => {
      const rank = (v) => (v.archived ? 2 : v.released ? 1 : 0);
      return (
        rank(a) - rank(b) ||
        (b.releaseDate || '').localeCompare(a.releaseDate || '') ||
        b.name.localeCompare(a.name, undefined, { numeric: true })
      );
    });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (!result.length) process.stdout.write('no versions\n');
  for (const v of result) {
    const state = v.archived ? 'archived' : v.released ? 'released' : 'unreleased';
    process.stdout.write(`${v.name.padEnd(16)} ${state.padEnd(11)} ${v.releaseDate || ''}\n`);
  }
}

// The issue types this project accepts, by name. create-issue sends the name
// verbatim, and whether "HOTFIX" or "Sub-task" exists is decided per instance,
// so a skill reads this before it picks one rather than finding out after the
// draft was approved.
async function listTypes(config, args) {
  const project = await request(config, 'GET', `${API}/project/${config.projectKey}`);
  const result = (project.issueTypes || []).map((t) => ({
    name: t.name,
    subtask: Boolean(t.subtask),
    description: t.description || '',
  }));

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  for (const t of result) {
    process.stdout.write(`${t.name.padEnd(12)} ${t.subtask ? 'subtask' : ''}\n`);
  }
}

// The tracker's directory, printed as lines that paste into `people`. The one
// way to get an account id without opening a browser.
async function findUser(config, args) {
  const query = args._[1];
  if (!query) fail('find-user needs a query: part of a name or an email', 2);

  const found = await searchUsers(config, query);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(found, null, 2)}\n`);
    return;
  }

  if (!found.length) process.stdout.write(`nobody under "${query}"\n`);
  for (const user of found) {
    process.stdout.write(`"${user.displayName}": "${user.accountId}"\n`);
  }
}

// --- writes --------------------------------------------------------------------

// Editing is the one write here that destroys something. A description replaced is a
// description gone, including whatever somebody else put in it since — so this reads
// the issue first and prints what each field holds today. "A human confirms every
// write" is an empty rule when the person confirming cannot see what disappears.
//
// Status stays out of reach on purpose: deciding on its own that work has moved is
// the one thing the process definition says a skill may never do.
async function updateIssue(config, args) {
  const key = assertKey(args._[1], 'issue key');

  const fields = {};
  if (args.summary) fields.summary = args.summary;
  if (args.assignee) fields.assignee = { id: await resolveAssignee(config, args.assignee, key) };

  if (args.labels) {
    fields.labels = args.labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  let markdown = null;
  if (args['description-file']) {
    const descriptionPath = resolve(args['description-file']);
    if (!existsSync(descriptionPath)) fail(`description file not found: ${descriptionPath}`, 2);
    markdown = readFileSync(descriptionPath, 'utf8');
  }

  const attachments = splitPaths(args.attach);
  for (const path of attachments) {
    if (!existsSync(resolve(path))) fail(`attachment not found: ${resolve(path)}`, 2);
  }

  if (!Object.keys(fields).length && markdown === null && !attachments.length) {
    fail('update-issue needs one of --summary, --description-file, --labels, --assignee, --attach', 2);
  }

  // Only the fields being overwritten. Listing the rest would bury the ones that
  // matter under the ones nothing is happening to. An attach-only run touches no
  // field and reads nothing.
  const replacing = {};
  let known = config;
  if (Object.keys(fields).length || markdown !== null) {
    const before = await request(
      config,
      'GET',
      `${API}/issue/${key}?fields=summary,labels,assignee,description`,
    );
    if (fields.summary !== undefined) replacing.summary = before.fields.summary;
    if (fields.labels !== undefined) replacing.labels = before.fields.labels;
    if (fields.assignee !== undefined) {
      replacing.assignee = before.fields.assignee?.displayName || null;
    }
    if (markdown !== null) {
      replacing.description = adfToText(before.fields.description, readOptions(config));
      // Whoever the current description already mentions is a resolved person:
      // the node carries the account id. Seeding them is what makes
      // get-issue → edit → update-issue hold for a description written in the
      // editor, where a mention need not be anybody in the file or on the thread.
      known = { ...config, people: { ...mentionsIn(before.fields.description), ...config.people } };
    }
  }

  // Converted once, after the uploads, so the media ids are in it; the dry run
  // converts without them and says so. Every mention is resolved here and
  // nowhere else, before anything is sent.
  const describe = async (media) => {
    if (markdown === null) return;
    fields.description = markdownToAdf(markdown, await adfOptions(known, markdown, media, key));
  };

  if (args.dryRun) {
    await describe(null);
    const put = { method: 'PUT', path: `${API}/issue/${key}`, replacing, body: { fields } };
    const steps = attachments.length
      ? [{ method: 'POST', path: `${API}/issue/${key}/attachments`, files: attachments }, put]
      : null;
    process.stdout.write(`${JSON.stringify(steps ? { steps } : put, null, 2)}\n`);
    return;
  }

  // Uploading first, because the issue already exists: unlike a create, one PUT
  // can carry the description and the media ids together.
  let media = {};
  let uploaded = [];
  if (attachments.length) ({ media, uploaded } = await attachAll(config, key, attachments));

  await describe(media);
  if (markdown !== null) reportMissingImages(markdown, media);

  if (Object.keys(fields).length) {
    process.stderr.write(`replacing:\n${JSON.stringify(replacing, null, 2)}\n`);
    await request(config, 'PUT', `${API}/issue/${key}`, { fields });
  }
  const result = { key, updated: Object.keys(fields), url: browseUrl(config, key) };
  if (uploaded.length) result.attachments = uploaded;

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const changed = [...result.updated, ...uploaded.map((file) => file.filename)];
    process.stdout.write(`${key} — ${changed.join(', ')} — ${result.url}\n`);
  }
}

// Its own operation as well as a flag, because uploading is the half that fails:
// a wrong path, a file the tracker rejects, a media id that will not resolve. One
// command that says what landed and under which id is what somebody debugging an
// image that will not show has to reach for.
async function attachFile(config, args) {
  const key = assertKey(args._[1], 'issue key');
  if (!args.file) fail('attach-file needs --file <path>[,<path>]', 2);

  const paths = splitPaths(args.file);
  if (!paths.length) fail('attach-file needs at least one path in --file', 2);
  for (const path of paths) {
    if (!existsSync(resolve(path))) fail(`attachment not found: ${resolve(path)}`, 2);
  }

  if (args.dryRun) {
    process.stdout.write(
      `${JSON.stringify({ method: 'POST', path: `${API}/issue/${key}/attachments`, files: paths }, null, 2)}\n`,
    );
    return;
  }

  const { uploaded } = await attachAll(config, key, paths);
  const result = { key, url: browseUrl(config, key), attachments: uploaded };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  for (const file of uploaded) {
    process.stdout.write(
      `${file.filename} — attachment ${file.id} — ${file.mediaId ? `![](media:${file.mediaId})` : 'no media id'}\n`,
    );
  }
}

// Its own operation rather than a flag on create-issue: a different endpoint, and a
// different way of failing. A link that fails after the issue was created would exit
// non-zero on a run that did create an issue, which reads as "nothing happened" to
// whoever is watching. One command, one thing, one thing to read in the exit code.
//
// The type name is passed through as written. Instances rename these, so validating
// against a list held here would reject names that are valid on the tracker actually
// being called; a wrong one comes back as the tracker's own error.
async function linkIssues(config, args) {
  const from = assertKey(args._[1], 'issue key');
  if (!args.to) fail('link-issues needs --to <KEY>', 2);
  const to = assertKey(args.to, 'linked issue key');

  const body = {
    type: { name: args.type || 'Relates' },
    outwardIssue: { key: from },
    inwardIssue: { key: to },
  };

  if (args.dryRun) {
    process.stdout.write(
      `${JSON.stringify({ method: 'POST', path: `${API}/issueLink`, body }, null, 2)}\n`,
    );
    return;
  }

  await request(config, 'POST', `${API}/issueLink`, body);
  const result = { from, to, type: body.type.name, url: browseUrl(config, from) };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${from} ${result.type.toLowerCase()} ${to} — ${result.url}\n`);
  }
}

// --- people ------------------------------------------------------------------

// Who a name may resolve to, in order: `people` in the configuration, then the
// people already on the issue — reporter, assignee, everyone who commented. The
// file comes first because it is what a human confirming the command can read;
// the issue comes second so that a first comment in a project with an empty
// `people` still reaches the person who asked the question. A new issue has no
// participants, which is why `--assignee` on create-issue needs the file.
//
// Fetched once per command and only when a name has to be resolved, so a read
// and a mention-free write cost nothing extra.
const PARTICIPANTS = new Map();

async function fetchParticipants(config, key) {
  if (!key) return [];
  if (PARTICIPANTS.has(key)) return PARTICIPANTS.get(key);

  const [issue, page] = await Promise.all([
    request(config, 'GET', `${API}/issue/${key}?fields=reporter,assignee`),
    request(config, 'GET', `${API}/issue/${key}/comment?maxResults=100`),
  ]);

  const people = [];
  const seen = new Set();
  const add = (user) => {
    if (user?.accountId && user.displayName && !seen.has(user.accountId)) {
      seen.add(user.accountId);
      people.push({ accountId: user.accountId, displayName: user.displayName });
    }
  };
  add(issue.fields?.reporter);
  add(issue.fields?.assignee);
  for (const comment of page.comments || []) add(comment.author);

  PARTICIPANTS.set(key, people);
  return people;
}

// Every mention a document already carries, as name → account id. A node the
// tracker rendered is a person it has verified, which is more than the file or
// the thread can say.
function mentionsIn(doc) {
  const people = {};
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'mention' && node.attrs?.id && node.attrs?.text) {
      people[String(node.attrs.text).replace(/^@/, '')] = node.attrs.id;
    }
    for (const child of node.content || []) walk(child);
  };
  walk(doc);
  return people;
}

// The tracker's own directory, consulted only to write a better error: the
// person was not in the file and not on the issue, so the message shows what the
// tracker knows under that name and the line that would put them in `people`.
// It never resolves a mention by itself — a directory match is a guess about
// which colleague to notify, and that guess belongs to the human, in the file.
async function searchUsers(config, query) {
  const found = await request(
    config,
    'GET',
    `${API}/user/search?query=${encodeURIComponent(query)}&maxResults=10`,
  );
  return (found || [])
    .filter((user) => user.accountType === 'atlassian' && user.active !== false)
    .map((user) => ({ accountId: user.accountId, displayName: user.displayName }));
}

function matchName(candidates, name) {
  const wanted = name.toLowerCase();
  const exact = candidates.filter((p) => p.displayName.toLowerCase() === wanted);
  if (exact.length) return exact;
  // A bare first name, only when it names exactly one person on the issue.
  // Anything looser would start guessing between colleagues sharing a surname.
  return candidates.filter((p) => p.displayName.toLowerCase().split(/\s+/)[0] === wanted);
}

async function resolvePerson(config, name, key = null) {
  if (config.people[name]) return { accountId: config.people[name], name };

  // The file first, then the issue: a first name that is unique in the file is
  // the person the file means, whoever else happens to be on the thread.
  const configured = Object.entries(config.people).map(([displayName, accountId]) => ({
    displayName,
    accountId,
  }));
  const hits = matchName(configured, name).length
    ? matchName(configured, name)
    : matchName(await fetchParticipants(config, key), name);

  if (hits.length === 1) return { accountId: hits[0].accountId, name: hits[0].displayName };
  if (hits.length > 1) {
    fail(
      `"${name}" matches more than one person: ${hits.map((p) => p.displayName).join(', ')}` +
        '\nwrite the full name',
      2,
    );
  }

  const known = Object.keys(config.people);
  const directory = await searchUsers(config, name);
  const where = config.path ? `"people" in ${config.path}` : '"people" in .ai/jira.config.json';
  const lines = [
    `no account id for "${name}" — not in people${key ? ` and not on ${key}` : ''}.`,
    `known: ${known.join(', ') || '(none configured)'}`,
  ];
  if (directory.length) {
    lines.push(`the tracker knows:`);
    for (const user of directory) {
      lines.push(`  "${user.displayName}": "${user.accountId}"`);
    }
    lines.push(`add the right line under ${where} and run again`);
  } else {
    lines.push(`the tracker's directory has nobody under that name — check the spelling,`);
    lines.push(`or run find-user with part of it`);
  }
  fail(lines.join('\n'), 2);
}

// Code is stripped before the scan for the same reason the converter skips it:
// `@[Name]` in backticks is somebody documenting the syntax, and a document
// about mentions should not need every name in it to be a real colleague.
const CODE_SPANS = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;
const MENTION = /@\[([^\]]+)\]/g;

// Every name the text mentions, resolved to an account id before the write. A
// name nobody can place stops the command here: the converter would turn it
// into plain text, the request would still succeed, and the person named would
// never learn they were needed — which is the failure this whole syntax exists
// to prevent. Failing costs a second; a dropped mention costs a reply.
async function resolveMentioned(config, markdown, key) {
  const names = new Set(
    Array.from(String(markdown).replace(CODE_SPANS, '').matchAll(MENTION), ([, name]) => name.trim()),
  );

  const people = {};
  for (const name of names) {
    if (name) people[name] = (await resolvePerson(config, name, key)).accountId;
  }
  return people;
}

// `me`, a display name, or an account id passed straight through. The name comes
// first because it is the form a human confirming the command can actually check:
// an account id in that position is a string nobody reads, so nobody catches the
// wrong one. Resolution happens before `--dry-run` prints anything, which is what
// makes a mistyped name fail while there is still something to fix.
async function resolveAssignee(config, value, key = null) {
  if (value === 'me') return (await request(config, 'GET', `${API}/myself`)).accountId;
  if (config.people[value]) return config.people[value];
  if (ACCOUNT_ID.test(value)) return value;
  return (await resolvePerson(config, value, key)).accountId;
}

// A reply attaches to the thread's root, never to another reply — threads are one
// level deep, so the id somebody hands over may be a reply and the write still has
// to name the root above it. The lookup pays for itself twice over: it is also the
// only check that the comment exists and belongs to this issue, since the path is
// scoped by key and anything else comes back 404 before a word is written.
async function resolveThreadRoot(config, key, value) {
  const id = parseCommentId(value);
  const comment = await request(config, 'GET', `${API}/issue/${key}/comment/${id}`);
  // As text, because that is the form the tracker uses for `id` and the form the
  // endpoint has been seen to accept — it answers with a number for `parentId`.
  return String(comment.parentId || comment.id);
}

async function addComment(config, args) {
  const key = assertKey(args._[1], 'issue key');
  if (!args['body-file']) fail('add-comment needs --body-file', 2);

  // Present, not truthy. `--reply-to ""` is a variable that came back empty, and
  // treating it as "no reply wanted" would put the comment somewhere nobody asked
  // for it — the failure a person only notices once it is on the issue.
  const replyTo = args['reply-to'];

  const bodyPath = resolve(args['body-file']);
  if (!existsSync(bodyPath)) fail(`body file not found: ${bodyPath}`, 2);
  const markdown = readFileSync(bodyPath, 'utf8');

  const doc = markdownToAdf(markdown, await adfOptions(config, markdown, null, key));

  const root = replyTo === undefined ? null : await resolveThreadRoot(config, key, replyTo);
  const method = 'POST';
  const path = `${API}/issue/${key}/comment`;
  const body = { body: doc, ...(root ? { parentId: root } : {}) };

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({ method, path, body }, null, 2)}\n`);
    return;
  }

  const saved = await request(config, method, path, body);
  const result = {
    id: saved.id,
    ...(root ? { replyTo: root } : {}),
    url: `${browseUrl(config, key)}?focusedCommentId=${saved.id}`,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const where = root ? ` in thread ${root}` : '';
    process.stdout.write(`commented${where} — ${result.url}\n`);
  }
}

// --- main --------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const operation = args._[0];

// Asking for help is not an error; being given nothing to do is.
if (operation === 'help' || args.help) usage(0);
if (!operation) usage(2);

const config = loadConfig(args);

const operations = {
  whoami,
  'show-config': showConfig,
  'get-issue': getIssue,
  'search-issues': searchIssues,
  'export-issues': exportIssues,
  'list-versions': listVersions,
  'list-types': listTypes,
  'find-user': findUser,
  'create-issue': createIssue,
  'update-issue': updateIssue,
  'link-issues': linkIssues,
  'add-comment': addComment,
  'attach-file': attachFile,
};
const run = operations[operation];
if (!run) fail(`unknown operation: ${operation}`, 2);

await run(config, args);
