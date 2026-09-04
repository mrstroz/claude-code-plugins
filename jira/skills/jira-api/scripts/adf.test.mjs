#!/usr/bin/env node

// adf.test.mjs — the converter's own test. `node --test jira/skills/jira-api/scripts/`
//
// Two kinds of case, and the second is the one that matters.
//
// **Golden**, against node shapes copied out of real issues in the instance this
// talks to. ADF permits far more than any renderer accepts, so a shape taken
// from the specification proves nothing about whether the tracker will draw it.
// Every fixture below names the issue it came from.
//
// **Round trip**, because `get-issue` flattens a description and `update-issue`
// converts it back. Anything the flattener cannot express is destroyed the next
// time somebody edits an issue through this script — a table a human added in
// the editor, a checkbox somebody ticked. The round trip is what keeps that
// from happening quietly.

// lint-skills: allow S011 — the golden fixtures name the issues they were read
// off, and a media id has to be a real one or it is not the shape under test.
// This is test data, never read at run time; the converter itself takes the site
// and the project key from its caller.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { markdownToAdf, adfToText } from './adf.mjs';

const SITE = 'example.atlassian.net';
const PEOPLE = { 'Someone Named': '557058:abc' };
const OPTS = { site: SITE, projectKey: 'TES', people: PEOPLE };

// localId is a fresh uuid on every run, so it can never be compared. Stripping
// it keeps the rest of the shape under assertion instead of giving up on it.
function stripIds(value) {
  if (Array.isArray(value)) return value.map(stripIds);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'localId')
        .map(([key, inner]) => [key, stripIds(inner)]),
    );
  }
  return value;
}

function blocks(markdown, options = OPTS) {
  return stripIds(markdownToAdf(markdown, options).content);
}

function only(markdown, options = OPTS) {
  const content = blocks(markdown, options);
  assert.equal(content.length, 1, `expected one block, got ${content.length}`);
  return content[0];
}

// --- golden: shapes read off real issues -------------------------------------

test('a checkbox list matches the taskList shape from TES-8147', () => {
  const node = only('- [ ] first is not done\n- [x] second is done');

  assert.deepEqual(node, {
    type: 'taskList',
    attrs: {},
    content: [
      { type: 'taskItem', attrs: { state: 'TODO' }, content: [{ type: 'text', text: 'first is not done' }] },
      { type: 'taskItem', attrs: { state: 'DONE' }, content: [{ type: 'text', text: 'second is done' }] },
    ],
  });

  // The real one carries a uuid on the list and on every item.
  const raw = markdownToAdf('- [ ] a', OPTS).content[0];
  assert.match(raw.attrs.localId, /^[0-9a-f-]{36}$/);
  assert.match(raw.content[0].attrs.localId, /^[0-9a-f-]{36}$/);
});

test('a pipe table matches the table shape from TES-8370', () => {
  const node = only('| Task | Scenario |\n| --- | --- |\n| TES-1 | open it |');

  assert.deepEqual(node.type, 'table');
  assert.deepEqual(node.attrs, { isNumberColumnEnabled: false, layout: 'default' });
  assert.deepEqual(node.content[0], {
    type: 'tableRow',
    content: [
      { type: 'tableHeader', attrs: {}, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task' }] }] },
      { type: 'tableHeader', attrs: {}, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Scenario' }] }] },
    ],
  });
  assert.equal(node.content[1].content[0].type, 'tableCell');
});

test('an attached image matches the mediaSingle shape from TES-8353', () => {
  const uuid = '6ebf1cca-3889-41e1-b7de-20c92ce990bc';
  const node = only('![the overview](shot.png)', { ...OPTS, media: { 'shot.png': uuid } });

  assert.deepEqual(node, {
    type: 'mediaSingle',
    attrs: { layout: 'center' },
    content: [
      { type: 'media', attrs: { type: 'file', id: uuid, collection: '', alt: 'the overview' } },
    ],
  });
});

test('an issue key becomes the inlineCard shape from TES-8346', () => {
  const node = only('See TES-8407 for the rest.');

  assert.deepEqual(node.content[1], {
    type: 'inlineCard',
    attrs: { url: `https://${SITE}/browse/TES-8407` },
  });
});

// --- inline ------------------------------------------------------------------

test('a bare url becomes a link instead of dead text', () => {
  const node = only('Recording: https://cap.example.dev/s/abc123');

  assert.deepEqual(node.content[1], {
    type: 'text',
    text: 'https://cap.example.dev/s/abc123',
    marks: [{ type: 'link', attrs: { href: 'https://cap.example.dev/s/abc123' } }],
  });
});

test('the sentence full stop stays out of the href', () => {
  const node = only('Read https://example.com/a, then https://example.com/b.');
  const hrefs = node.content
    .filter((child) => child.marks)
    .map((child) => child.marks[0].attrs.href);

  assert.deepEqual(hrefs, ['https://example.com/a', 'https://example.com/b']);
});

test('a standard with a number is not an issue key', () => {
  const node = only('Encoding is UTF-8 and the date is ISO-8601.');
  assert.deepEqual(node.content, [{ type: 'text', text: 'Encoding is UTF-8 and the date is ISO-8601.' }]);
});

test('an issue key inside a url is left to the url', () => {
  const node = only(`Open https://${SITE}/browse/TES-8407 now`);
  assert.equal(node.content.filter((child) => child.type === 'inlineCard').length, 0);
  assert.equal(node.content[1].marks[0].attrs.href, `https://${SITE}/browse/TES-8407`);
});

test('angle brackets ask for a smart link', () => {
  const node = only('Context: <https://example.com/page>');
  assert.deepEqual(node.content[1], { type: 'inlineCard', attrs: { url: 'https://example.com/page' } });
});

test('strike, emoji and a status lozenge', () => {
  const node = only('~~dropped~~ :warning: {status:red|BLOCKED}');

  assert.deepEqual(node.content[0], { type: 'text', text: 'dropped', marks: [{ type: 'strike' }] });
  assert.deepEqual(node.content[2], { type: 'emoji', attrs: { shortName: ':warning:', text: '⚠️' } });
  assert.deepEqual(node.content[4], { type: 'status', attrs: { text: 'BLOCKED', color: 'red' } });
});

test('an unknown shortcode stays literal', () => {
  const node = only('at 12:30:45 sharp');
  assert.deepEqual(node.content, [{ type: 'text', text: 'at 12:30:45 sharp' }]);
});

test('a code span still wins over everything inside it', () => {
  const node = only('Set `BULK_ACTION_USE_CLOUDFLARE` to `true`');
  assert.deepEqual(node.content[1], { type: 'text', text: 'BULK_ACTION_USE_CLOUDFLARE', marks: [{ type: 'code' }] });
});

test('two trailing spaces break the line inside a paragraph', () => {
  const node = only('first line  \nsecond line');
  assert.deepEqual(node.content, [
    { type: 'text', text: 'first line' },
    { type: 'hardBreak' },
    { type: 'text', text: 'second line' },
  ]);
});

test('a soft wrap does not', () => {
  const node = only('first line\nsecond line');
  assert.deepEqual(node.content, [{ type: 'text', text: 'first line second line' }]);
});

// --- blocks ------------------------------------------------------------------

test('an alert becomes a panel, a plain quote does not', () => {
  const panel = only('> [!WARNING] Not observed in production data.');
  assert.equal(panel.type, 'panel');
  assert.deepEqual(panel.attrs, { panelType: 'warning' });
  assert.equal(panel.content[0].content[0].text, 'Not observed in production data.');

  assert.equal(only('> just a quote').type, 'blockquote');
  assert.equal(only('> [!CAUTION] careful').attrs.panelType, 'warning');
  assert.equal(only('> [!NONSENSE] what').attrs.panelType, 'info');
});

test('indentation nests a list instead of flattening it', () => {
  const node = only('- parent\n  - child\n  - sibling\n- second parent');

  assert.equal(node.content.length, 2);
  const nested = node.content[0].content[1];
  assert.equal(nested.type, 'bulletList');
  assert.equal(nested.content.length, 2);
});

test('a line under an item continues it', () => {
  const node = only('- the item\n  keeps going here');
  assert.equal(node.content[0].content[0].content[0].text, 'the item keeps going here');
});

test('a blank line does not cut a list in two', () => {
  const node = only('- one\n\n- two');
  assert.equal(node.type, 'bulletList');
  assert.equal(node.content.length, 2);
});

test('a checkbox list ends where a plain list begins', () => {
  const content = blocks('- [ ] a criterion\n- an ordinary bullet');
  assert.deepEqual(content.map((node) => node.type), ['taskList', 'bulletList']);
});

test('a collapsible section becomes an expand', () => {
  const node = only('<details>\n<summary>The log</summary>\n\nsome output\n\n</details>');
  assert.equal(node.type, 'expand');
  assert.deepEqual(node.attrs, { title: 'The log' });
  assert.equal(node.content[0].content[0].text, 'some output');
});

test('pipes without a divider stay prose', () => {
  assert.equal(only('the value is | or maybe |').type, 'paragraph');
});

// --- degrading rather than throwing ------------------------------------------

test('an image url that was never attached becomes a link', () => {
  const node = only('![a diagram](https://example.com/d.png)');
  assert.equal(node.type, 'paragraph');
  assert.deepEqual(node.content[0].marks, [{ type: 'link', attrs: { href: 'https://example.com/d.png' } }]);
});

test('an image with no upload behind it names the missing file', () => {
  const node = only('![a shot](local/shot.png)');
  assert.equal(node.type, 'paragraph');
  assert.match(adfToText(node), /not attached: `shot\.png`/);
});

test('an issue key with no site configured stays text', () => {
  const node = only('See TES-8407.', {});
  assert.deepEqual(node.content, [{ type: 'text', text: 'See TES-8407.' }]);
});

test('an unclosed fence still produces a code block', () => {
  const node = only('```php\n$a = 1;');
  assert.equal(node.type, 'codeBlock');
  assert.equal(node.content[0].text, '$a = 1;');
});

test('an empty bullet is still an item, so the numbering holds', () => {
  const node = only('- one\n- \n- three');
  assert.equal(node.content.length, 3);
  assert.deepEqual(node.content[1].content[0], { type: 'paragraph', content: [] });
});

test('nothing in, empty document out', () => {
  assert.deepEqual(markdownToAdf(''), { type: 'doc', version: 1, content: [] });
});

// --- reading, on documents this converter did not write ----------------------

test('a description written in the editor survives being read', () => {
  const fromTheEditor = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'taskList',
        attrs: { localId: 'a' },
        content: [
          { type: 'taskItem', attrs: { localId: 'b', state: 'DONE' }, content: [{ type: 'text', text: 'ticked' }] },
        ],
      },
      {
        type: 'mediaSingle',
        attrs: { width: 703, widthType: 'pixel', localId: 'c', layout: 'center' },
        content: [
          {
            type: 'media',
            attrs: {
              type: 'file',
              id: '6ebf1cca-3889-41e1-b7de-20c92ce990bc',
              alt: 'image-20260809-044343.png',
              collection: '',
              height: 458,
              width: 1623,
            },
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'see ' },
          { type: 'inlineCard', attrs: { url: `https://${SITE}/browse/TES-8279` } },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'the docs', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
        ],
      },
    ],
  };

  const text = adfToText(fromTheEditor, OPTS);

  assert.match(text, /- \[x\] ticked/);
  assert.match(text, /!\[image-20260809-044343\.png\]\(media:6ebf1cca-3889-41e1-b7de-20c92ce990bc\)/);
  assert.match(text, /see TES-8279 and \[the docs\]\(https:\/\/example\.com\)/);
});

test('a table read back keeps its columns apart', () => {
  const table = {
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: [
      {
        type: 'tableRow',
        content: [
          { type: 'tableHeader', attrs: {}, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task' }] }] },
          { type: 'tableHeader', attrs: {}, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Scenario' }] }] },
        ],
      },
      {
        type: 'tableRow',
        content: [
          { type: 'tableCell', attrs: {}, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
          { type: 'tableCell', attrs: {}, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
        ],
      },
    ],
  };

  assert.equal(adfToText(table, OPTS).trim(), '| Task | Scenario |\n| --- | --- |\n| one | two |');
});

// --- what real descriptions turned out to contain ----------------------------
//
// Every case here is a bug the converter had, found by reading sixty issues out
// of the instance and writing them back. None of them were reachable from a
// document this converter wrote itself.

test('a code block under a numbered step stays under it', () => {
  const markdown = '1. set the variables\n\n   ```bash\n   A=1\n   ```\n2. restart';
  const node = only(markdown);

  assert.equal(node.type, 'orderedList');
  assert.deepEqual(node.content[0].content.map((child) => child.type), ['paragraph', 'codeBlock']);
  assert.equal(node.content[0].content[1].content[0].text, 'A=1');
  assert.equal(node.content.length, 2);
});

test('a code block keeps its newlines out of the break marker', () => {
  const doc = markdownToAdf('```js\nconst a = () => {\n  return 1;\n};\n```', OPTS);
  assert.equal(adfToText(doc, OPTS).includes('\\'), false);
});

test('a blank line inside an item starts a second paragraph, not a second list', () => {
  const node = only('- the first point\n\n  and a second paragraph about it\n- the next point');

  assert.equal(node.type, 'bulletList');
  assert.equal(node.content.length, 2);
  assert.deepEqual(node.content[0].content.map((child) => child.type), ['paragraph', 'paragraph']);
});

test('a bold issue key stays bold instead of becoming a card', () => {
  const node = only('It supersedes **TES-8253** entirely.');
  assert.deepEqual(node.content[1], { type: 'text', text: 'TES-8253', marks: [{ type: 'strong' }] });
});

test('two neighbours sharing a mark are written as one span', () => {
  // `**a** **b**` with nothing between them spells `****`, which reads back as
  // an empty span and a stray pair of asterisks.
  const paragraph = {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'in ', marks: [{ type: 'strong' }] },
      { type: 'text', text: 'some/branch', marks: [{ type: 'strong' }, { type: 'code' }] },
    ],
  };

  assert.equal(adfToText(paragraph, OPTS).trim(), '**in `some/branch`**');
});

test('a break inside a list item survives', () => {
  const node = only('- first half\\\n  second half');
  assert.deepEqual(node.content[0].content[0].content.map((child) => child.type), [
    'text', 'hardBreak', 'text',
  ]);
});

// --- the round trip ----------------------------------------------------------

const EVERYTHING = [
  '# A heading',
  '',
  'A paragraph with **bold**, `code`, ~~cut~~, *emphasis*, a [labelled link](https://example.com/a),',
  'a bare https://example.com/b, a card <https://example.com/c>, the key TES-8407, :rocket: and',
  '{status:green|SHIPPED}.',
  '',
  'Hello @[Someone Named], a mention sits in the sentence it belongs to.',
  '',
  'A line that breaks  ',
  'right here.',
  '',
  '## Acceptance criteria',
  '',
  '- [ ] something observably true',
  '- [x] something already true',
  '',
  '## Steps',
  '',
  '1. open it',
  '2. click it',
  '',
  '- parent',
  '  - child',
  '- second parent',
  '',
  '| Field | Value |',
  '| --- | --- |',
  '| account | 123 |',
  '',
  '> [!WARNING]',
  '> Not observed in production data.',
  '',
  '> an ordinary quote',
  '',
  '```php',
  '$a = 1;',
  '```',
  '',
  '---',
  '',
  '![a screenshot](media:6ebf1cca-3889-41e1-b7de-20c92ce990bc)',
  '',
  '<details>',
  '<summary>The log</summary>',
  '',
  'some output',
  '',
  '</details>',
].join('\n');

test('every construct survives markdown to ADF to text and back', () => {
  const first = markdownToAdf(EVERYTHING, OPTS);
  const second = markdownToAdf(adfToText(first, OPTS), OPTS);

  assert.deepEqual(stripIds(second), stripIds(first));
});

test('the round trip covers what it claims to', () => {
  const types = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type) types.add(node.type);
    (node.content || []).forEach(walk);
    (node.marks || []).forEach((mark) => types.add(`mark:${mark.type}`));
  };
  walk(markdownToAdf(EVERYTHING, OPTS));

  for (const expected of [
    'heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'taskItem',
    'table', 'tableHeader', 'tableCell', 'panel', 'blockquote', 'codeBlock',
    'rule', 'mediaSingle', 'media', 'expand', 'inlineCard', 'status', 'emoji',
    'hardBreak', 'mention', 'mark:strong', 'mark:code', 'mark:strike', 'mark:em', 'mark:link',
  ]) {
    assert.ok(types.has(expected), `the round-trip document has no ${expected}`);
  }
});

// --- mentions ----------------------------------------------------------------

// A mention is why this module exists rather than a Markdown library: the node
// carries an account id, and nothing in Markdown has anywhere to put one. The
// name resolves through the map jira.mjs builds from the configuration.
test('a mention carries the account id, not just the name', () => {
  const [paragraph] = markdownToAdf('Hello @[Someone Named], one question.', OPTS).content;

  assert.deepEqual(paragraph.content[1], {
    type: 'mention',
    attrs: { id: '557058:abc', text: '@Someone Named' },
  });
  assert.deepEqual(paragraph.content[0], { type: 'text', text: 'Hello ' });
});

// The write is what fails on an unknown name; here it only has to stay readable.
test('an unresolved name stays the text somebody typed', () => {
  const [paragraph] = markdownToAdf('Hello @[Nobody Here], one question.', OPTS).content;

  assert.ok(paragraph.content.every((node) => node.type === 'text'));
  assert.equal(paragraph.content.map((node) => node.text).join(''), 'Hello @[Nobody Here], one question.');
});

test('a mention in backticks is about the syntax, not a mention', () => {
  const [paragraph] = markdownToAdf('Write `@[Someone Named]` to notify them.', OPTS).content;

  assert.deepEqual(paragraph.content[1], {
    type: 'text',
    text: '@[Someone Named]',
    marks: [{ type: 'code' }],
  });
});

// ADF gives a node nowhere to carry a mark, so bold around a mention would cost
// one of the two. The formatting somebody wrote wins.
test('a mention inside bold keeps the bold', () => {
  const [paragraph] = markdownToAdf('**@[Someone Named]** owns this.', OPTS).content;

  assert.deepEqual(paragraph.content[0], {
    type: 'text',
    text: '@[Someone Named]',
    marks: [{ type: 'strong' }],
  });
});

// Reading an issue flattens the description and update-issue converts it back,
// so a mention that does not survive that trip is a notification destroyed by
// the next edit.
test('a mention survives the round trip', () => {
  const first = markdownToAdf('Hello @[Someone Named], one question.', OPTS);
  const text = adfToText(first, OPTS);

  assert.equal(text.trim(), 'Hello @[Someone Named], one question.');
  assert.deepEqual(stripIds(markdownToAdf(text, OPTS)), stripIds(first));
});

// A line that looks like the start of a block no branch accepts must still be
// consumed, or the parser never advances. Both of these hung the converter.
test('a pipe row with no divider is a paragraph, not a hang', () => {
  const doc = markdownToAdf('| a | b |');
  assert.deepEqual(doc.content.map((n) => n.type), ['paragraph']);
  assert.equal(adfToText(doc).trim(), '| a | b |');
});

test('a stray closing details tag is a paragraph, not a hang', () => {
  const doc = markdownToAdf('text\n\n</details>\n\nmore');
  assert.deepEqual(doc.content.map((n) => n.type), ['paragraph', 'paragraph', 'paragraph']);
});
