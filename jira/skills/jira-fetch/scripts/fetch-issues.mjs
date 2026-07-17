#!/usr/bin/env node

// fetch-issues.mjs — Fetch JIRA issues via REST API v3
// Zero dependencies — requires Node 18+ (built-in fetch)
//
// Usage:
//   node fetch-issues.mjs --domain <domain> --jql <jql> --output <path> [--summaries-only]
//
// --summaries-only skips per-issue requests (no descriptions/comments) and
// returns search results directly — one request per 1000 issues. Use for
// discovery-style queries that may match a project's entire history.
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
  'issuetype', 'labels', 'fixVersions', 'components',
  'description', 'created', 'updated', 'reporter',
];

// Fields for --summaries-only mode — all resolvable straight from search
// results, so no per-issue requests are needed.
const SUMMARY_FIELDS = [
  'summary', 'status', 'assignee', 'priority',
  'issuetype', 'labels', 'fixVersions', 'components', 'updated',
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--summaries-only') {
      parsed.summariesOnly = true;
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[++i];
    }
  }

  if (!parsed.domain || !parsed.jql || !parsed.output) {
    console.error('Usage: node fetch-issues.mjs --domain <domain> --jql <jql> --output <path> [--summaries-only]');
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
// Search — collect issues with the requested fields
// ---------------------------------------------------------------------------

async function searchIssues(baseUrl, jql, auth, fields) {
  const issues = [];

  // Try the new /search/jql endpoint first (cursor-based pagination)
  try {
    let nextPageToken = null;
    do {
      const body = { jql, maxResults: 1000, fields };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const data = await jiraRequest(baseUrl, 'POST', '/rest/api/3/search/jql', auth, body);
      issues.push(...(data.issues || []));
      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    return issues;
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
      fields,
    });
    total = data.total || 0;
    issues.push(...(data.issues || []));
    startAt += (data.issues?.length) || 1000;
  }
  return issues;
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
    reporter: f.reporter?.displayName || '',
    labels: f.labels || [],
    fixVersions: (f.fixVersions || []).map((v) => v.name),
    components: (f.components || []).map((c) => c.name),
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
// Summaries-only extraction — from search results, no per-issue requests
// ---------------------------------------------------------------------------

function extractSummary(issue) {
  const f = issue.fields || {};
  return {
    key: issue.key,
    type: f.issuetype?.name || '',
    status: f.status?.name || '',
    priority: f.priority?.name || '',
    assignee: f.assignee?.displayName || '',
    labels: f.labels || [],
    fixVersions: (f.fixVersions || []).map((v) => v.name),
    components: (f.components || []).map((c) => c.name),
    summary: f.summary || '',
    updated: (f.updated || '').substring(0, 16),
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

function writeOutput(config, issues, mode) {
  const output = {
    meta: {
      jql: config.jql,
      domain: config.domain,
      fetched: new Date().toISOString(),
      count: issues.length,
      ...(mode ? { mode } : {}),
    },
    issues,
  };

  mkdirSync(dirname(config.output), { recursive: true });
  writeFileSync(config.output, JSON.stringify(output, null, 2));
  console.log(config.output);
  console.error(`Done -> ${config.output}`);
}

async function main() {
  const config = parseArgs();
  const baseUrl = `https://${config.domain}`;
  const auth = makeAuth(config.email, config.token);

  console.error(`Searching: ${config.jql}`);

  // Summaries-only: search results already carry every needed field — one
  // request per 1000 issues instead of 2+ per issue.
  if (config.summariesOnly) {
    const found = await searchIssues(baseUrl, config.jql, auth, SUMMARY_FIELDS);
    console.error(`Found ${found.length} issues (summaries only)`);
    writeOutput(config, found.map(extractSummary), 'summaries-only');
    return;
  }

  // Step 1: Search for issue keys
  const keys = (await searchIssues(baseUrl, config.jql, auth, ['key'])).map((i) => i.key);
  console.error(`Found ${keys.length} issues`);

  if (keys.length === 0) {
    writeOutput(config, []);
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
  writeOutput(config, issues);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
