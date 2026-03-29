#!/usr/bin/env node

// fetch-issues.mjs — Fetch JIRA issues via REST API v3
// Zero dependencies — requires Node 18+ (built-in fetch)
//
// Usage:
//   node fetch-issues.mjs --domain <domain> --jql <jql> --output <path>
//
// Env vars:
//   JIRA_EMAIL     — Atlassian account email
//   JIRA_API_TOKEN — API token from https://id.atlassian.com/manage/api-tokens

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CONCURRENCY = 5;
const MAX_COMMENTS = 50;
const ISSUE_FIELDS = [
  'summary', 'status', 'assignee', 'priority',
  'issuetype', 'labels', 'fixVersions', 'description',
  'created', 'updated',
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[++i];
    }
  }

  if (!parsed.domain || !parsed.jql || !parsed.output) {
    console.error('Usage: node fetch-issues.mjs --domain <domain> --jql <jql> --output <path>');
    process.exit(1);
  }

  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables are required.');
    console.error('Get your API token at: https://id.atlassian.com/manage/api-tokens');
    process.exit(1);
  }

  return { ...parsed, email, token };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function makeAuth(email, token) {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

async function jiraRequest(baseUrl, method, path, auth, body = null) {
  const opts = {
    method,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${baseUrl}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Search — collect issue keys only
// ---------------------------------------------------------------------------

async function searchIssueKeys(baseUrl, jql, auth) {
  const keys = [];

  // Try the new /search/jql endpoint first (cursor-based pagination)
  try {
    let nextPageToken = null;
    do {
      const body = { jql, maxResults: 1000, fields: ['key'] };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const data = await jiraRequest(baseUrl, 'POST', '/rest/api/3/search/jql', auth, body);
      for (const issue of data.issues || []) keys.push(issue.key);
      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    return keys;
  } catch (err) {
    // Fall back to legacy endpoint only on 404/405 (endpoint doesn't exist)
    if (!err.message.includes('404') && !err.message.includes('405')) throw err;
    console.error('New search endpoint unavailable, falling back to legacy /rest/api/3/search');
  }

  // Legacy endpoint — offset-based pagination
  let startAt = 0;
  let total = Infinity;
  while (startAt < total) {
    const data = await jiraRequest(baseUrl, 'POST', '/rest/api/3/search', auth, {
      jql,
      maxResults: 1000,
      startAt,
      fields: ['summary'],
    });
    total = data.total || 0;
    for (const issue of data.issues || []) keys.push(issue.key);
    startAt += (data.issues?.length) || 1000;
  }
  return keys;
}

// ---------------------------------------------------------------------------
// HTML -> plaintext
// ---------------------------------------------------------------------------

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Fetch single issue + comments
// ---------------------------------------------------------------------------

async function fetchIssue(baseUrl, key, auth) {
  const fieldsParam = ISSUE_FIELDS.join(',');

  // Issue fields + initial comments batch — in parallel
  const [issue, commentsPage] = await Promise.all([
    jiraRequest(
      baseUrl, 'GET',
      `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fieldsParam}&expand=renderedFields`,
      auth,
    ),
    jiraRequest(
      baseUrl, 'GET',
      `/rest/api/3/issue/${encodeURIComponent(key)}/comment?startAt=0&maxResults=${MAX_COMMENTS}&expand=renderedBody`,
      auth,
    ),
  ]);

  // If issue has more comments than we got, fetch the last MAX_COMMENTS
  let comments = commentsPage.comments || [];
  const total = commentsPage.total || 0;
  if (total > MAX_COMMENTS) {
    const tail = await jiraRequest(
      baseUrl, 'GET',
      `/rest/api/3/issue/${encodeURIComponent(key)}/comment?startAt=${total - MAX_COMMENTS}&maxResults=${MAX_COMMENTS}&expand=renderedBody`,
      auth,
    );
    comments = tail.comments || [];
  }

  const f = issue.fields || {};
  const rf = issue.renderedFields || {};

  return {
    key: issue.key,
    type: f.issuetype?.name || '',
    status: f.status?.name || '',
    priority: f.priority?.name || '',
    assignee: f.assignee?.displayName || '',
    labels: f.labels || [],
    fixVersions: (f.fixVersions || []).map((v) => v.name),
    summary: f.summary || '',
    created: (f.created || '').substring(0, 16),
    updated: (f.updated || '').substring(0, 16),
    description: stripHtml(rf.description || ''),
    comments: comments.map((c) => ({
      author: c.author?.displayName || '',
      created: (c.created || '').substring(0, 16),
      body: stripHtml(c.renderedBody || ''),
    })),
  };
}

// ---------------------------------------------------------------------------
// Concurrency limiter with fail-fast
// ---------------------------------------------------------------------------

async function withConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  let failed = false;

  async function worker() {
    while (idx < items.length && !failed) {
      const i = idx++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = parseArgs();
  const baseUrl = `https://${config.domain}`;
  const auth = makeAuth(config.email, config.token);

  // Step 1: Search for issue keys
  console.error(`Searching: ${config.jql}`);
  const keys = await searchIssueKeys(baseUrl, config.jql, auth);
  console.error(`Found ${keys.length} issues`);

  if (keys.length === 0) {
    const output = {
      meta: { jql: config.jql, domain: config.domain, fetched: new Date().toISOString(), count: 0 },
      issues: [],
    };
    mkdirSync(dirname(config.output), { recursive: true });
    writeFileSync(config.output, JSON.stringify(output, null, 2));
    console.log(config.output);
    return;
  }

  // Step 2: Fetch each issue (5 concurrent)
  let done = 0;
  const issues = await withConcurrency(keys, CONCURRENCY, async (key) => {
    const result = await fetchIssue(baseUrl, key, auth);
    done++;
    console.error(`[${done}/${keys.length}] ${key}`);
    return result;
  });

  // Step 3: Write output
  const output = {
    meta: {
      jql: config.jql,
      domain: config.domain,
      fetched: new Date().toISOString(),
      count: issues.length,
    },
    issues,
  };

  mkdirSync(dirname(config.output), { recursive: true });
  writeFileSync(config.output, JSON.stringify(output, null, 2));
  console.log(config.output);
  console.error(`Done -> ${config.output}`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
