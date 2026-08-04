#!/usr/bin/env node

// lexical-md.mjs — convert markdown ↔ Payload Lexical rich text, both directions.
// Zero dependencies of its own — requires Node 18+ and a Payload project on disk.
//
// Rich-text fields hold a full Lexical editor state. Hand-writing that JSON for
// anything longer than a sentence is slow and wrong in ways that only show up on
// the live site, so markdown is the working representation in both directions:
// a ten-paragraph article body is ~2 KB of markdown against ~15 KB of Lexical.
//
// Usage:
//   node lexical-md.mjs --project-dir <path> [--to-markdown] [--in <path>] [--out <path>] [--check]
//
// Options:
//   --project-dir <path>   REQUIRED. The Payload project. @payloadcms/richtext-lexical is resolved
//                          from ITS node_modules, so the output always matches the version that
//                          will validate it. There is no fallback to a global copy — a converter
//                          from a different minor version can emit node shapes the server rejects.
//   (default)              markdown → Lexical JSON
//   --to-markdown          Lexical JSON → markdown
//   --in <path>            Input file. Defaults to stdin.
//   --out <path>           Output file. Defaults to stdout.
//   --headings h2,h3,h4    Restrict the heading sizes the converter may emit. Some blocks narrow
//                          their editor (h1 is often reserved for the hero), and a markdown `#`
//                          would otherwise produce a node that block's editor does not enable.
//   --check                Report the node types present and exit 1 if any lie outside the set that
//                          round-trips losslessly. Refusing loudly beats silently dropping a node
//                          out of an article body.
//
// Exit codes: 0 ok · 1 --check found an unsupported node type · 2 usage or resolution failure.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

// Node types markdown represents faithfully in both directions. Anything else
// survives the trip to markdown as an empty line and is gone on the way back.
const ROUND_TRIPS = new Set([
  'root', 'paragraph', 'heading', 'text', 'linebreak', 'tab',
  'link', 'autolink', 'list', 'listitem', 'quote', 'horizontalrule', 'upload',
]);

function die(code, msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to-markdown' || a === '--check') opts[a.slice(2)] = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else die(2, `Unexpected argument: ${a}`);
  }
  return opts;
}

async function loadLexical(projectDir) {
  const pkg = join(resolve(projectDir), 'package.json');
  if (!existsSync(pkg)) die(2, `--project-dir has no package.json: ${projectDir}`);
  const req = createRequire(pathToFileURL(pkg));
  let entry;
  try {
    entry = req.resolve('@payloadcms/richtext-lexical');
  } catch {
    die(2, [
      `@payloadcms/richtext-lexical is not installed in ${projectDir}.`,
      'Install the project dependencies there first — this script deliberately does not fall back',
      'to another copy, because a version mismatch produces node shapes the server will reject.',
    ].join('\n'));
  }
  return import(pathToFileURL(entry).href);
}

// The converters need a sanitized editor config, which normally comes from a booted
// Payload instance. `fromFeatures` accepts a stub instead: nothing in the default
// feature set reaches into collections, so no database, no Cloudflare context and
// no config boot are required.
const STUB_CONFIG = { collections: [], globals: [], localization: false, editor: {}, i18n: {}, custom: {} };

async function buildEditorConfig(lexical, headings) {
  if (!headings) return lexical.editorConfigFactory.fromFeatures({ config: STUB_CONFIG });
  const sizes = headings.split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  for (const s of sizes) if (!allowed.has(s)) die(2, `--headings: "${s}" is not a heading size (h1…h6).`);
  return lexical.editorConfigFactory.fromFeatures({
    config: STUB_CONFIG,
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter((f) => f.key !== 'heading'),
      lexical.HeadingFeature({ enabledHeadingSizes: sizes }),
    ],
  });
}

function collectNodeTypes(node, found = new Set()) {
  if (Array.isArray(node)) { for (const n of node) collectNodeTypes(n, found); return found; }
  if (node === null || typeof node !== 'object') return found;
  if (typeof node.type === 'string') found.add(node.type);
  for (const value of Object.values(node)) if (value && typeof value === 'object') collectNodeTypes(value, found);
  return found;
}

async function main() {
  const opts = parseArgs();
  if (!opts['project-dir']) die(2, 'Usage: node lexical-md.mjs --project-dir <path> [--to-markdown] [--in <p>] [--out <p>] [--check]');

  const input = opts.in ? readFileSync(opts.in, 'utf8') : readFileSync(0, 'utf8');
  const lexical = await loadLexical(opts['project-dir']);
  const editorConfig = await buildEditorConfig(lexical, opts.headings);

  let result;
  let tree;
  if (opts['to-markdown']) {
    let data;
    try { data = JSON.parse(input); } catch (e) { die(2, `Input is not valid JSON: ${e.message}`); }
    // Accept either a bare editor state or a whole field value wrapping one.
    tree = data.root ? data : data?.value?.root ? data.value : die(2, 'Input JSON has no `root` — this does not look like a Lexical editor state.');
    result = lexical.convertLexicalToMarkdown({ data: tree, editorConfig });
  } else {
    tree = lexical.convertMarkdownToLexical({ editorConfig, markdown: input });
    result = JSON.stringify(tree, null, 2);
  }

  if (opts.check) {
    const types = [...collectNodeTypes(tree)].sort();
    const unsupported = types.filter((t) => !ROUND_TRIPS.has(t));
    process.stderr.write(`node types: ${types.join(', ')}\n`);
    if (unsupported.length) {
      die(1, [
        `Unsupported for a markdown round-trip: ${unsupported.join(', ')}`,
        'These survive the conversion as empty content. Edit this field as Lexical JSON instead,',
        'or drop the unsupported nodes deliberately before converting.',
      ].join('\n'));
    }
  }

  if (opts.out) writeFileSync(opts.out, result.endsWith('\n') ? result : `${result}\n`);
  else process.stdout.write(result.endsWith('\n') ? result : `${result}\n`);
}

main();
