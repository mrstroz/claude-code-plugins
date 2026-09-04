#!/usr/bin/env node

// adf.mjs — Markdown to Atlassian Document Format, and back to readable text.
//
// The tracker's v3 API refuses plain strings for rich text: a description or a
// comment has to arrive as an ADF document. It lives in its own module because
// the same converter carries `mention` nodes into comments, which is the whole
// reason for choosing v3 over the older string-based API.
//
// Three rules hold this file together.
//
// **Never throw on input we do not recognise.** A description that lost its bold
// is something a human fixes in ten seconds; a request that failed to post is
// work thrown away. Anything unparsed degrades to a plain paragraph.
//
// **The two directions are inverses.** Reading an issue flattens ADF to Markdown
// and `update-issue` converts it back, so whatever the flattener drops is
// destroyed the next time somebody edits a description through this script. That
// is why it writes link targets, table pipes and checkboxes rather than the
// prose a person would read most comfortably — and why the round trip is tested.
//
// **The node shapes are not guessed from the specification.** ADF permits more
// than any one renderer accepts, so every shape below was read off a real issue
// in the instance this talks to. See references/markdown.md for the dialect and
// adf.test.mjs for the samples they came from.
//
// Zero dependencies, Node 18+.

import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';

// --- vocabulary --------------------------------------------------------------

// Aliases exist because the alert syntax people already know comes from
// elsewhere, and being told your CAUTION is not a panel type teaches nothing.
const PANEL_TYPES = {
  info: 'info',
  note: 'note',
  tip: 'tip',
  success: 'success',
  warning: 'warning',
  error: 'error',
  caution: 'warning',
  important: 'note',
};

// Small on purpose. An unknown shortcode stays literal text and round-trips
// unchanged, so the cost of a missing entry is nothing worse than a missing
// picture — while a large table would be a second thing to keep current.
const EMOJI = {
  ':white_check_mark:': '✅',
  ':heavy_check_mark:': '✔️',
  ':warning:': '⚠️',
  ':x:': '❌',
  ':bug:': '🐛',
  ':bulb:': '💡',
  ':rocket:': '🚀',
  ':fire:': '🔥',
  ':lock:': '🔒',
  ':eyes:': '👀',
};

const STATUS_COLORS = new Set(['neutral', 'purple', 'blue', 'red', 'yellow', 'green']);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function localId() {
  return randomUUID();
}

function normaliseOptions(options = {}) {
  return {
    site: options.site || null,
    projectKey: options.projectKey || null,
    media: options.media || null,
    people: options.people || null,
  };
}

// --- inline ------------------------------------------------------------------

const INLINE_CACHE = new Map();

// Ordered by precedence, and the order only settles ties at the same starting
// position — the leftmost match wins first. Code leads because backticks are how
// people escape characters that would otherwise be read as markup, and the two
// bracketed forms come before bare URLs so the target of `[label](url)` is never
// linkified twice. A mention follows code for the same escaping reason: `@[Name]`
// in backticks is somebody writing about the syntax, not using it.
function inlinePattern(projectKey) {
  const cacheKey = projectKey || '';
  const cached = INLINE_CACHE.get(cacheKey);
  if (cached) return cached;

  const alternatives = [
    '(`[^`]+`)', // code
    '(@\\[[^\\]]+\\])', // mention
    '(!\\[[^\\]]*\\]\\([^)\\s]*\\))', // image
    '(\\[[^\\]]*\\]\\([^)\\s]*\\))', // link
    '(<https?://[^\\s>]+>)', // smart link
    '(https?://[^\\s<>]+)', // bare url
    '(\\{status:[a-z]+\\|[^}]*\\})', // status lozenge
    '(\\*\\*[^*]+\\*\\*)', // strong
    '(~~[^~]+~~)', // strike
    '(\\*[^*\\s][^*]*\\*|(?<![\\w])_[^_\\s][^_]*_(?![\\w]))', // emphasis
    '(:[a-z][a-z0-9_+-]*:)', // emoji
  ];

  // Restricted to the configured project rather than a general key shape: the
  // obvious `[A-Z]+-\d+` also matches UTF-8, ISO-8601 and every other standard
  // anybody names in a description.
  if (projectKey) {
    alternatives.push(`((?<![\\w-])${escapeRegExp(projectKey)}-\\d+(?![\\w-]))`);
  }

  const pattern = new RegExp(alternatives.join('|'));
  INLINE_CACHE.set(cacheKey, pattern);
  return pattern;
}

function textNode(text, marks) {
  // ADF rejects empty text nodes, and an empty one carries nothing anyway.
  if (!text) return null;
  const node = { type: 'text', text };
  if (marks && marks.length) node.marks = marks;
  return node;
}

// A sentence ending in a URL is the normal case, so the full stop that closes it
// must not become part of the href. Brackets are counted rather than stripped,
// because a URL may legitimately contain a balanced pair.
function splitTrailingPunctuation(url) {
  let end = url.length;

  for (;;) {
    const last = url[end - 1];
    if (end > 0 && '.,;:!?'.includes(last)) {
      end--;
      continue;
    }
    if (end > 0 && last === ')') {
      const head = url.slice(0, end);
      const opens = (head.match(/\(/g) || []).length;
      const closes = (head.match(/\)/g) || []).length;
      if (closes > opens) {
        end--;
        continue;
      }
    }
    break;
  }

  return [url.slice(0, end), url.slice(end)];
}

function cardNode(url) {
  return { type: 'inlineCard', attrs: { url } };
}

function statusNode(token) {
  const [, colour, text] = token.match(/^\{status:([a-z]+)\|([^}]*)\}$/) || [];
  return {
    type: 'status',
    attrs: {
      text: text || '',
      color: STATUS_COLORS.has(colour) ? colour : 'neutral',
      localId: localId(),
    },
  };
}

function browseUrlFor(key, opts) {
  return opts.site ? `https://${opts.site}/browse/${key}` : null;
}

// A mention is a node, and ADF gives a node nowhere to carry a mark, so one
// inside bold or a link stays text rather than silently losing the formatting
// somebody wrote. An unresolved name stays text too — the converter's rule is
// that nothing here ever fails, and the caller is the one holding the map.
function mentionNode(name, marks, opts) {
  const person = name.trim();
  const accountId = !marks.length && opts.people && opts.people[person];
  if (!accountId) return textNode(`@[${name}]`, marks);
  return { type: 'mention', attrs: { id: accountId, text: `@${person}` } };
}

// inlineNodes(text, marks, opts) — text with markup into ADF inline nodes
function inlineNodes(text, marks = [], opts = normaliseOptions()) {
  const pattern = inlinePattern(opts.projectKey);
  const nodes = [];
  let rest = String(text);

  while (rest) {
    const match = rest.match(pattern);
    if (!match) break;

    const before = rest.slice(0, match.index);
    if (before) nodes.push(textNode(before, marks));

    const token = match[0];
    let tail = '';

    if (token.startsWith('`')) {
      // Code spans are literal by definition, so no recursion inside them.
      nodes.push(textNode(token.slice(1, -1), [...marks, { type: 'code' }]));
    } else if (token.startsWith('@[')) {
      // A `mention` node is the reason this whole module exists. Markdown has no
      // way to express one, so a converter going through Markdown drops it and
      // the people named never find out they were named. The node carries the
      // account id; the text is only what a reader sees.
      //
      // The name is resolved before the write, so an unknown one here means the
      // caller never looked it up — and a mention nobody can be sure of is worse
      // than the text somebody typed, which at least still reads.
      nodes.push(mentionNode(token.slice(2, -1), marks, opts));
    } else if (token.startsWith('![')) {
      // An image is a block node in ADF, so one sitting mid-sentence cannot stay
      // an image. A link to it keeps the reader's way in.
      const [label, href] = splitBracketed(token.slice(1));
      if (/^https?:\/\//.test(href)) {
        nodes.push(...inlineNodes(label || href, [...marks, { type: 'link', attrs: { href } }], labelOptions(opts)));
      } else {
        nodes.push(...inlineNodes(label || basename(href), marks, labelOptions(opts)));
      }
    } else if (token.startsWith('[')) {
      const [label, href] = splitBracketed(token);
      nodes.push(...inlineNodes(label || href, [...marks, { type: 'link', attrs: { href } }], labelOptions(opts)));
    } else if (token.startsWith('<http')) {
      // A card, a lozenge and an emoji are nodes, and ADF gives a node nowhere
      // to carry a mark. Inside bold or a link they would silently drop it, so
      // formatting somebody wrote beats a decoration we would have added.
      if (marks.length) nodes.push(textNode(token, marks));
      else nodes.push(cardNode(token.slice(1, -1)));
    } else if (token.startsWith('http')) {
      const [href, trailing] = splitTrailingPunctuation(token);
      nodes.push(textNode(href, [...marks, { type: 'link', attrs: { href } }]));
      tail = trailing;
    } else if (token.startsWith('{status:')) {
      if (marks.length) nodes.push(textNode(token, marks));
      else nodes.push(statusNode(token));
    } else if (token.startsWith('**')) {
      nodes.push(...inlineNodes(token.slice(2, -2), [...marks, { type: 'strong' }], opts));
    } else if (token.startsWith('~~')) {
      nodes.push(...inlineNodes(token.slice(2, -2), [...marks, { type: 'strike' }], opts));
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(...inlineNodes(token.slice(1, -1), [...marks, { type: 'em' }], opts));
    } else if (token.startsWith(':')) {
      const emoji = !marks.length && EMOJI[token];
      if (emoji) nodes.push({ type: 'emoji', attrs: { shortName: token, text: emoji } });
      else nodes.push(textNode(token, marks));
    } else {
      // The only alternative left is an issue key, and it is only in the pattern
      // when a project key was configured.
      const url = !marks.length && browseUrlFor(token, opts);
      nodes.push(url ? cardNode(url) : textNode(token, marks));
    }

    rest = tail + rest.slice(match.index + token.length);
  }

  if (rest) nodes.push(textNode(rest, marks));
  return nodes.filter(Boolean);
}

// The text of a link is already a reference: reading an issue key inside it as a
// second one replaces the author's target with ours, and the label stops being
// what they wrote. Everything else — bold, code, emphasis — still applies.
function labelOptions(opts) {
  return { ...opts, projectKey: null, inLink: true };
}

// `[label](href)` split on the last `](`, so a label may contain brackets.
function splitBracketed(token) {
  const split = token.lastIndexOf('](');
  if (split < 0) return [token, ''];
  return [token.slice(1, split), token.slice(split + 2, -1)];
}

// Lines in a paragraph are soft-wrapped: Markdown joins them with a space. A line
// ending in two spaces or a backslash is the exception, and it is the only way to
// break a line inside a paragraph — which people do use for steps that are not a
// list. Splitting into segments first keeps inline markup working across a soft
// wrap, which converting line by line would break.
const HARD_BREAK = /(\s{2}|\\)$/;

function paragraphContent(rawLines, opts) {
  const segments = [];
  let current = [];

  for (const raw of rawLines) {
    const broken = HARD_BREAK.test(raw);
    current.push(raw.replace(/\s+$/, '').replace(/\\$/, '').trim());
    if (broken) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);

  const content = [];
  segments.forEach((segment, index) => {
    if (index) content.push({ type: 'hardBreak' });
    content.push(...inlineNodes(segment.join(' '), [], opts));
  });

  return content;
}

function paragraph(text, opts) {
  const content = inlineNodes(text, [], opts);
  return content.length ? { type: 'paragraph', content } : null;
}

const EMPTY_PARAGRAPH = () => ({ type: 'paragraph', content: [] });

// --- blocks ------------------------------------------------------------------

const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TASK_MARK = /^\[([ xX])\]\s*(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const PANEL_MARK = /^\[!(\w+)\]\s*(.*)$/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*```(\w+)?\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|[\s:|-]*-[\s:|-]*\|\s*$/;
const IMAGE_LINE = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const DETAILS_OPEN = /^\s*<details>\s*$/i;
const DETAILS_CLOSE = /^\s*<\/details>\s*$/i;
const SUMMARY = /^\s*<summary>(.*)<\/summary>\s*$/i;

function isBlockStart(line) {
  return (
    HEADING.test(line) ||
    LIST_ITEM.test(line) ||
    QUOTE.test(line) ||
    RULE.test(line) ||
    FENCE.test(line) ||
    TABLE_ROW.test(line) ||
    IMAGE_LINE.test(line) ||
    DETAILS_OPEN.test(line) ||
    DETAILS_CLOSE.test(line)
  );
}

// --- lists -------------------------------------------------------------------

function listItemToken(line) {
  if (line === undefined) return null;
  const match = line.match(LIST_ITEM);
  if (!match) return null;

  const indent = match[1].replace(/\t/g, '    ').length;
  let kind = /\d/.test(match[2]) ? 'ordered' : 'bullet';
  let text = match[3];
  let state = null;

  if (kind === 'bullet') {
    const task = text.match(TASK_MARK);
    if (task) {
      kind = 'task';
      state = task[1].toLowerCase() === 'x' ? 'DONE' : 'TODO';
      text = task[2];
    }
  }

  return { indent, kind, state, lines: [text], blocks: [] };
}

// Everything the list owns, in one pass, before any node is built — the tree
// cannot be shaped until the indents that follow are known.
function collectItems(lines, start) {
  const root = listItemToken(lines[start]);
  const items = [];
  let i = start;
  let afterBlank = false;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      const token = listItemToken(lines[next]);

      // A blank line ends the list unless the same kind of item continues after
      // it. People write loose lists, and cutting one into a list per item reads
      // far worse than joining two that were meant to stand apart.
      if (token && !(token.indent <= root.indent && token.kind !== root.kind)) {
        i = next;
        continue;
      }

      // Indented, and not an item: a second paragraph of the item above.
      if (items.length && next < lines.length && /^\s+\S/.test(lines[next])) {
        afterBlank = true;
        i = next;
        continue;
      }

      break;
    }

    const token = listItemToken(line);
    if (token) {
      if (token.indent <= root.indent && token.kind !== root.kind) break;
      items.push(token);
      afterBlank = false;
      i++;
      continue;
    }

    // An indented line that is not an item of its own belongs to the item above.
    if (items.length && /^\s+\S/.test(line)) {
      const item = items[items.length - 1];

      // A code block under a step, a screenshot under a bullet, a second
      // paragraph — the editor writes all three, and reading them back as
      // siblings would lift them out of the list on the next write.
      if (afterBlank || isBlockStart(line)) {
        const [block, next] = collectBlock(lines, i);
        afterBlank = false;
        if (next > i) {
          if (item.blocks.length) item.blocks.push('');
          item.blocks.push(...block);
          i = next;
          continue;
        }
      }

      item.lines.push(line.replace(/^\s+/, ''));
      i++;
      continue;
    }

    break;
  }

  return [items, i];
}

// One block belonging to a list item, dedented to where it can be parsed on its
// own. A fence runs to its closing partner; anything else runs to the first
// blank line or the next item.
function collectBlock(lines, start) {
  const indent = lines[start].match(/^\s*/)[0];
  const body = [];
  let i = start;

  if (FENCE.test(lines[i])) {
    body.push(lines[i++]);
    while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
    if (i < lines.length) body.push(lines[i++]);
  } else {
    while (i < lines.length && lines[i].trim() && /^\s/.test(lines[i]) && !listItemToken(lines[i])) {
      body.push(lines[i++]);
    }
  }

  return [body.map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line.trimStart())), i];
}

function newList(kind) {
  if (kind === 'ordered') return { type: 'orderedList', attrs: { order: 1 }, content: [] };
  if (kind === 'task') return { type: 'taskList', attrs: { localId: localId() }, content: [] };
  return { type: 'bulletList', content: [] };
}

function appendItem(list, item, opts) {
  const inner = paragraphContent(item.lines, opts);

  if (list.type === 'taskList') {
    list.content.push({
      type: 'taskItem',
      attrs: { localId: localId(), state: item.state || 'TODO' },
      content: inner,
    });
    return;
  }

  // An empty bullet still has to become a list item, or the numbering shifts.
  const content = [inner.length ? { type: 'paragraph', content: inner } : EMPTY_PARAGRAPH()];
  if (item.blocks.length) content.push(...parseBlocks(item.blocks, opts));

  list.content.push({ type: 'listItem', content });
}

// A task list holds task items and task lists, never a list item, so a nested
// list under a checkbox goes beside it rather than inside it.
function attachNested(parent, child) {
  if (parent.type === 'taskList') {
    parent.content.push(child);
    return;
  }
  const last = parent.content[parent.content.length - 1];
  if (last && last.type === 'listItem') last.content.push(child);
  else parent.content.push(child);
}

// A taskItem carries inline content only, so there is nowhere to put a plain
// list underneath one. The words survive as a second line of the same task,
// which loses the nesting but never invents a checkbox nobody wrote.
function appendContinuation(list, item, opts) {
  const last = list.content[list.content.length - 1];
  if (!last || last.type !== 'taskItem') {
    appendItem(list, item, opts);
    return;
  }
  last.content.push({ type: 'hardBreak' }, ...paragraphContent(item.lines, opts));
}

function buildList(items, opts) {
  const root = newList(items[0].kind);
  const stack = [{ indent: items[0].indent, kind: items[0].kind, node: root }];

  for (const item of items) {
    while (stack.length > 1 && item.indent < stack[stack.length - 1].indent) stack.pop();
    let top = stack[stack.length - 1];

    if (item.indent > top.indent) {
      if (top.kind === 'task' && item.kind !== 'task') {
        appendContinuation(top.node, item, opts);
        continue;
      }
      const nested = newList(item.kind);
      attachNested(top.node, nested);
      stack.push({ indent: item.indent, kind: item.kind, node: nested });
      top = stack[stack.length - 1];
    }

    appendItem(top.node, item, opts);
  }

  return root;
}

// --- tables ------------------------------------------------------------------

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function tableCell(text, isHeader, opts) {
  return {
    type: isHeader ? 'tableHeader' : 'tableCell',
    attrs: {},
    content: [paragraph(text, opts) || EMPTY_PARAGRAPH()],
  };
}

function tableBlock(lines, start, opts) {
  const rows = [];
  let header = 0;
  let i = start;

  while (i < lines.length && TABLE_ROW.test(lines[i])) {
    if (TABLE_DIVIDER.test(lines[i])) {
      // The divider says which rows above it were headings. Only the first one
      // counts; a second is somebody's formatting, not a second heading block.
      if (!header) header = rows.length;
      i++;
      continue;
    }
    rows.push(splitRow(lines[i]));
    i++;
  }

  const node = {
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: rows.map((cells, index) => ({
      type: 'tableRow',
      content: cells.map((cell) => tableCell(cell, index < header, opts)),
    })),
  };

  return [node, i];
}

// --- media -------------------------------------------------------------------

// The id is not the attachment id the upload returns — it is the media id behind
// it, which jira.mjs resolves and passes in. `media:<uuid>` is the same thing
// written down, and it is what the flattener emits so a description survives a
// read and a write.
function mediaBlock(alt, src, opts) {
  const direct = src.match(/^media:([0-9a-fA-F-]{36})$/);
  const id = direct ? direct[1] : (opts.media && (opts.media[src] || opts.media[basename(src)])) || null;

  if (id) {
    return {
      type: 'mediaSingle',
      attrs: { layout: 'center' },
      content: [
        {
          type: 'media',
          attrs: { type: 'file', id, collection: '', alt: alt || basename(src) },
        },
      ],
    };
  }

  if (/^https?:\/\//.test(src)) {
    return {
      type: 'paragraph',
      content: inlineNodes(alt || src, [{ type: 'link', attrs: { href: src } }], opts),
    };
  }

  // Nothing to point at. Naming the file beats dropping the line, because the
  // person reading the issue is the one who can still attach it.
  return paragraph(`${alt || 'image'} — not attached: \`${basename(src)}\``, opts);
}

// --- the parser --------------------------------------------------------------

function blocksOrEmpty(lines, opts) {
  const content = parseBlocks(lines, opts);
  return content.length ? content : [EMPTY_PARAGRAPH()];
}

function parseBlocks(lines, opts) {
  const content = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++; // the closing fence, or the end of the input if it was never closed
      const node = { type: 'codeBlock', content: [] };
      if (fence[1]) node.attrs = { language: fence[1] };
      const text = body.join('\n');
      if (text) node.content.push({ type: 'text', text });
      content.push(node);
      continue;
    }

    if (DETAILS_OPEN.test(line)) {
      i++;
      let title = '';
      const summary = i < lines.length ? lines[i].match(SUMMARY) : null;
      if (summary) {
        title = summary[1].trim();
        i++;
      }
      const body = [];
      while (i < lines.length && !DETAILS_CLOSE.test(lines[i])) body.push(lines[i++]);
      i++;
      content.push({ type: 'expand', attrs: { title }, content: blocksOrEmpty(body, opts) });
      continue;
    }

    if (RULE.test(line)) {
      content.push({ type: 'rule' });
      i++;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const inner = inlineNodes(heading[2], [], opts);
      if (inner.length) {
        content.push({ type: 'heading', attrs: { level: heading[1].length }, content: inner });
      }
      i++;
      continue;
    }

    // A row of pipes is only a table when the divider says so; without it the
    // line is far more likely to be prose that happens to contain a pipe.
    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[i + 1] || '')) {
      const [node, next] = tableBlock(lines, i, opts);
      content.push(node);
      i = next;
      continue;
    }

    const image = line.match(IMAGE_LINE);
    if (image) {
      const node = mediaBlock(image[1], image[2], opts);
      if (node) content.push(node);
      i++;
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const [items, next] = collectItems(lines, i);
      if (items.length) content.push(buildList(items, opts));
      i = next > i ? next : i + 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].match(QUOTE)[1]);

      const panel = quoted[0].match(PANEL_MARK);
      if (panel) {
        const panelType = PANEL_TYPES[panel[1].toLowerCase()] || 'info';
        content.push({
          type: 'panel',
          attrs: { panelType },
          content: blocksOrEmpty([panel[2], ...quoted.slice(1)], opts),
        });
      } else {
        content.push({ type: 'blockquote', content: blocksOrEmpty(quoted, opts) });
      }
      continue;
    }

    // Everything else is a paragraph: consume until a blank line or the start of
    // another block, joining soft-wrapped lines the way Markdown does.
    // The first line is taken unconditionally: it may look like the start of a
    // block that no branch above accepted — a pipe row with no divider under
    // it, a stray `</details>` — and a line nothing consumes is a loop that
    // never ends. As a paragraph it posts as the text somebody typed.
    const buffer = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buffer.push(lines[i++]);

    const inner = paragraphContent(buffer, opts);
    if (inner.length) content.push({ type: 'paragraph', content: inner });
  }

  return content;
}

/**
 * Convert Markdown to an ADF document.
 *
 * @param {string} markdown
 * @param {{site?: string, projectKey?: string, media?: Record<string, string>,
 *   people?: Record<string, string>}} [options]
 *   `site` and `projectKey` turn issue keys into smart links; `media` maps a file
 *   name to the media id jira.mjs resolved after uploading it; `people` maps a
 *   display name to the account id that turns `@[Name]` into a real mention.
 */
export function markdownToAdf(markdown, options = {}) {
  const opts = normaliseOptions(options);
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  return { type: 'doc', version: 1, content: parseBlocks(lines, opts) };
}

// --- the other direction -----------------------------------------------------

// Marks are written back out rather than dropped. A link whose text is its own
// target goes back as the bare URL, because that is what somebody typed to get
// it and what reads best in a description.
function wrapMark(mark, inner) {
  switch (mark.type) {
    case 'code':
      return `\`${inner}\``;
    case 'strong':
      return `**${inner}**`;
    case 'em':
      return `*${inner}*`;
    case 'strike':
      return `~~${inner}~~`;
    case 'link': {
      const href = mark.attrs?.href || '';
      return inner === href ? href : `[${inner}](${href})`;
    }
    default:
      return inner;
  }
}

function sameMark(one, other) {
  return (
    one.type === other.type &&
    JSON.stringify(one.attrs || null) === JSON.stringify(other.attrs || null)
  );
}

// The first mark ends up outermost, which is the order the parser puts them back
// in.
function applyMarks(text, marks) {
  return [...marks].reverse().reduce((inner, mark) => wrapMark(mark, inner), text);
}

// A newline inside a text node is a line break somebody typed. It has to become
// its own node before any mark is written around it, or the span opens on one
// line and closes on the next — where nothing will read it back.
function expandBreaks(children) {
  const out = [];

  for (const node of children || []) {
    if (node?.type === 'text' && String(node.text || '').includes('\n')) {
      String(node.text)
        .split('\n')
        .forEach((part, index) => {
          if (index) out.push({ type: 'hardBreak' });
          if (part) out.push({ ...node, text: part });
        });
      continue;
    }
    out.push(node);
  }

  return out;
}

// A mark is written as one span across every neighbour that carries it, rather
// than opened and closed around each. Two adjacent bold nodes written separately
// spell `****`, which reads back as an empty span and a stray pair of asterisks
// — a corruption nobody sees until the description is edited again.
function inlineRun(children, active, opts) {
  let out = '';
  let i = 0;

  while (i < children.length) {
    const node = children[i];

    if (!node || node.type !== 'text') {
      out += flatten(node, opts);
      i++;
      continue;
    }

    const pending = (node.marks || []).filter((mark) => !active.some((seen) => sameMark(seen, mark)));
    if (!pending.length) {
      out += node.text || '';
      i++;
      continue;
    }

    const mark = pending[0];
    let end = i + 1;
    while (
      end < children.length &&
      children[end]?.type === 'text' &&
      (children[end].marks || []).some((other) => sameMark(other, mark))
    ) {
      end++;
    }

    out += wrapMark(mark, inlineRun(children.slice(i, end), [...active, mark], opts));
    i = end;
  }

  return out;
}

function indentBlock(block, pad) {
  return block
    .split('\n')
    .map((line, index) => (index === 0 || !line ? line : `${pad}${line}`))
    .join('\n');
}

function mediaText(node) {
  const attrs = node.attrs || {};
  const alt = attrs.alt || '';
  if (attrs.type === 'external' && attrs.url) return `![${alt}](${attrs.url})`;
  return `![${alt}](media:${attrs.id || ''})`;
}

// A smart link back to an issue in this project reads as the key, which is what
// somebody would type to get one. Anything else keeps its angle brackets, so a
// card stays a card through a read and a write.
function cardText(url, opts) {
  if (opts.site && opts.projectKey) {
    const pattern = new RegExp(`^https?://${escapeRegExp(opts.site)}/browse/(${escapeRegExp(opts.projectKey)}-\\d+)$`);
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return `<${url}>`;
}

function rawText(node) {
  return (node.content || []).map((child) => child.text || '').join('');
}

function inlineOf(node, opts) {
  return inlineRun(expandBreaks(node.content), [], opts)
    .replace(/\\?\s+/g, ' ')
    .trim();
}

function listText(node, opts) {
  const ordered = node.type === 'orderedList';
  let counter = 0;

  return (node.content || [])
    .map((child) => {
      if (child.type === 'taskItem') {
        const box = child.attrs?.state === 'DONE' ? '[x]' : '[ ]';
        return `- ${box} ${inlineOf(child, opts)}`;
      }

      if (child.type === 'taskList' || child.type === 'bulletList' || child.type === 'orderedList') {
        return indentBlock(`  ${listText(child, opts)}`, '  ');
      }

      counter++;
      const marker = ordered ? `${counter}.` : '-';
      const rendered = (child.content || []).map((block) => flatten(block, opts).replace(/\n+$/, ''));

      // A fence or an image has to start its own line, so an item that opens
      // with one leaves the marker line empty rather than swallowing it.
      const opensWithText = (child.content || [])[0]?.type === 'paragraph' && Boolean(rendered[0]);
      const parts = rendered.filter(Boolean);
      const body = (opensWithText ? parts : ['', ...parts]).join('\n\n');

      return indentBlock(`${marker} ${body}`, ' '.repeat(marker.length + 1));
    })
    .filter(Boolean)
    .join('\n');
}

function tableText(node, opts) {
  const rows = (node.content || []).filter((row) => row.type === 'tableRow');
  if (!rows.length) return '';

  const cells = rows.map((row) =>
    (row.content || []).map((cell) =>
      flatten(cell, opts).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'),
    ),
  );

  let header = 0;
  while (
    header < rows.length &&
    (rows[header].content || []).length &&
    (rows[header].content || []).every((cell) => cell.type === 'tableHeader')
  ) {
    header++;
  }

  // Markdown has no table without a heading row, so a table that never had one
  // gives its first row up. Losing the distinction beats losing the table.
  if (!header) header = 1;

  const width = Math.max(...cells.map((row) => row.length));
  const lines = cells.map((row) => `| ${row.join(' | ')} |`);
  lines.splice(header, 0, `| ${new Array(width).fill('---').join(' | ')} |`);

  return lines.join('\n');
}

function quotedBlock(text) {
  return text
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function flatten(node, opts) {
  if (!node || typeof node !== 'object') return '';

  switch (node.type) {
    case 'text':
      // Reached directly only when a text node has no container to run with.
      return applyMarks(String(node.text || ''), node.marks || []);
    case 'hardBreak':
      // A backslash rather than the two trailing spaces that also mean a break:
      // trailing whitespace is invisible, and every tool that touches a file
      // eventually strips it.
      return '\\\n';
    case 'rule':
      return '\n---\n\n';
    case 'mention':
      // Written back in the form that converts to a mention again. A bare
      // `@Name` reads the same but comes back as text, so an edit through this
      // script would quietly cost somebody their notification.
      return `@[${node.attrs?.text?.replace(/^@/, '') || 'unknown'}]`;
    case 'emoji':
      return node.attrs?.shortName || node.attrs?.text || '';
    case 'status':
      return `{status:${node.attrs?.color || 'neutral'}|${node.attrs?.text || ''}}`;
    case 'inlineCard':
    case 'blockCard':
    case 'embedCard':
      return cardText(node.attrs?.url || '', opts);
    case 'media':
      return mediaText(node);
    case 'mediaSingle':
    case 'mediaGroup':
      return `${(node.content || []).map(mediaText).join('\n')}\n\n`;
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return `${listText(node, opts)}\n\n`;
    case 'table':
      return `${tableText(node, opts)}\n\n`;
    case 'codeBlock':
      // Taken verbatim. Every other block runs its text through the inline
      // renderer, which would read a newline as a line break and write the
      // marker for one into somebody's code.
      return `\`\`\`${node.attrs?.language || ''}\n${rawText(node)}\n\`\`\`\n\n`;
    default:
      break;
  }

  const inner = inlineRun(expandBreaks(node.content), [], opts);

  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(node.attrs?.level || 1)} ${inner.trim()}\n\n`;
    case 'paragraph':
      return `${inner}\n\n`;
    case 'panel':
      return `${quotedBlock(`[!${(node.attrs?.panelType || 'info').toUpperCase()}]\n${inner.trim()}`)}\n\n`;
    case 'blockquote':
      return `${quotedBlock(inner.trim())}\n\n`;
    case 'expand':
    case 'nestedExpand':
      return `<details>\n<summary>${node.attrs?.title || ''}</summary>\n\n${inner.trim()}\n\n</details>\n\n`;
    default:
      return inner;
  }
}

/**
 * Flatten an ADF document into Markdown this module can read back.
 *
 * Reading a tracker issue means turning ADF into something a model can work
 * with — but `update-issue` converts the result back, so this is written to be
 * the inverse of `markdownToAdf` rather than the prettiest possible prose.
 * What it cannot express is listed in references/markdown.md.
 *
 * @param {object} node
 * @param {{site?: string, projectKey?: string}} [options]
 */
export function adfToText(node, options = {}) {
  return flatten(node, normaliseOptions(options)).replace(/\n{3,}/g, '\n\n');
}
