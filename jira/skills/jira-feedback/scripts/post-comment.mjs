#!/usr/bin/env node

// post-comment.mjs — Post a comment to a JIRA issue via REST API v3
// Zero dependencies — requires Node 18+ (built-in fetch)
//
// Usage:
//   node post-comment.mjs --domain <domain> --issue <KEY> --body-file <path> [--dry-run]
//
// The comment text comes from a file, not from an argument. Comments contain
// newlines, quotes and backticks, and shell quoting is exactly where that goes
// wrong.
//
// API v3 takes a comment body as ADF (Atlassian Document Format) — a JSON tree,
// not markdown. mdToAdf below converts the small subset this skill produces.
//
// Env vars:
//   JIRA_EMAIL     — Atlassian account email
//   JIRA_API_TOKEN — API token from https://id.atlassian.com/manage/api-tokens

import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      parsed.dryRun = true;
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[++i];
    }
  }

  if (!parsed.domain || !parsed.issue || !parsed['body-file']) {
    console.error(
      'Usage: node post-comment.mjs --domain <domain> --issue <KEY> --body-file <path> [--dry-run]',
    );
    process.exit(1);
  }

  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables are required.');
    console.error('Get your API token at: https://id.atlassian.com/manage/api-tokens');
    process.exit(1);
  }

  return { ...parsed, bodyFile: parsed['body-file'], email, token };
}

// ---------------------------------------------------------------------------
// HTTP helpers — same shape as jira-fetch/scripts/fetch-issues.mjs
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
// HTML -> plaintext, for showing what JIRA made of the ADF
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
// markdown -> ADF
//
// Deliberately small: the skill writes paragraphs, bullet lists, bold, inline
// code and links, so that is the whole grammar. Anything outside it survives as
// literal text rather than being dropped, because a stray `#` in a comment is a
// far cheaper mistake than a sentence that silently disappears.
// ---------------------------------------------------------------------------

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
const BULLET = /^\s*[-*]\s+/;

function inlineNodes(text) {
  const nodes = [];
  let last = 0;

  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) nodes.push({ type: 'text', text: text.slice(last, m.index) });
    const tok = m[0];

    if (tok.startsWith('`')) {
      nodes.push({ type: 'text', text: tok.slice(1, -1), marks: [{ type: 'code' }] });
    } else if (tok.startsWith('**')) {
      nodes.push({ type: 'text', text: tok.slice(2, -2), marks: [{ type: 'strong' }] });
    } else {
      const cut = tok.indexOf('](');
      nodes.push({
        type: 'text',
        text: tok.slice(1, cut),
        marks: [{ type: 'link', attrs: { href: tok.slice(cut + 2, -1) } }],
      });
    }
    last = m.index + tok.length;
  }

  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes.filter((n) => n.text !== '');
}

function paragraph(text) {
  const content = inlineNodes(text);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function mdToAdf(markdown) {
  const content = [];

  for (const block of markdown.trim().split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trimEnd()).filter((l) => l !== '');
    if (lines.length === 0) continue;

    // A block is a list when its first line carries a marker. Lines after it
    // without their own marker are continuations of the item above, which is
    // how a wrapped bullet arrives once the draft has been hard-wrapped.
    if (BULLET.test(lines[0])) {
      const items = [];
      for (const line of lines) {
        if (BULLET.test(line)) items.push(line.replace(BULLET, ''));
        else items[items.length - 1] += ' ' + line.trim();
      }
      content.push({
        type: 'bulletList',
        content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
      });
    } else {
      content.push(paragraph(lines.join(' ')));
    }
  }

  return { type: 'doc', version: 1, content: content.length ? content : [paragraph('')] };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = parseArgs();

  let body;
  try {
    body = readFileSync(config.bodyFile, 'utf8');
  } catch (err) {
    console.error(`Error: cannot read ${config.bodyFile} (${err.code || err.message})`);
    process.exit(1);
  }

  if (!body.trim()) {
    console.error(`Error: ${config.bodyFile} is empty — nothing to post.`);
    process.exit(1);
  }

  const adf = mdToAdf(body);

  if (config.dryRun) {
    console.log(JSON.stringify({ body: adf }, null, 2));
    console.error('Dry run — nothing was sent.');
    return;
  }

  const baseUrl = `https://${config.domain}`;
  const auth = makeAuth(config.email, config.token);
  const key = encodeURIComponent(config.issue);

  const created = await jiraRequest(
    baseUrl, 'POST',
    `/rest/api/3/issue/${key}/comment?expand=renderedBody`,
    auth,
    { body: adf },
  );

  // Read back what JIRA made of the ADF. A converter bug is otherwise invisible
  // until somebody opens the issue in a browser, which is too late to catch it.
  console.error(`Posted to ${config.issue} (comment ${created.id})`);
  console.error(`${baseUrl}/browse/${config.issue}?focusedCommentId=${created.id}`);
  console.log(stripHtml(created.renderedBody || ''));
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
