#!/usr/bin/env node

// team.test.mjs — `node --test team/scripts/`
//
// Each test drives the real script as separate processes against a throwaway git
// repository, because almost everything worth testing here happens between
// processes: two writers, a wait killed mid-delivery, a close racing a new revision.
// REPEAT raises the number of rounds for the race tests.

import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PLUGIN_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'team.mjs');
const REPEAT = Number(process.env.REPEAT || 3);
const roots = [];
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'team-test-'));
  roots.push(root);
  const g = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g('init', '-q');
  g('config', 'user.name', 'test');
  g('config', 'user.email', 'test@test');
  writeFileSync(join(root, 'app.txt'), 'one\n');
  g('add', '-A');
  g('commit', '-qm', 'init');
  return { root, g };
}

function teamIn(root, script, args, input) {
  const res = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', input });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

// A run with d, a1 and t1 and a plan approved by both reviewers.
function makeRun({ items, approve = true, task = 'demo' } = {}) {
  const { root, g } = makeRepo();
  const started = teamIn(root, PLUGIN_SCRIPT, ['start', task, '--runtime', 'claude']);
  assert.equal(started.code, 0, started.err);
  const run = /run: (.+)/.exec(started.out)[1];
  const script = join(run, 'team.mjs');
  const team = (...args) => teamIn(root, script, args);
  const ok = (...args) => {
    const res = team(...args);
    assert.equal(res.code, 0, `${args.join(' ')}: ${res.err}${res.out}`);
    return res;
  };
  ok('join', '--role', 'architect', '--runtime', 'codex');
  ok('join', '--role', 'tester', '--runtime', 'claude');
  const planItems = items ?? [
    { name: 'step1', author: 'd', required: ['a1', 't1'] },
    { name: 'tests-t1', author: 't1', required: ['a1'] },
    { name: 'final', author: 'd', required: ['a1', 't1'] },
  ];
  const submitPlan = (list, text = '# Plan\n\nDo the thing.\n') => {
    writeFileSync(join(run, 'plan-draft.md'), text);
    const itemsFile = join(run, 'artifacts', `items-${Math.random()}.json`);
    writeFileSync(itemsFile, JSON.stringify({ items: list }));
    return team('plan', 'submit', '--as', 'd', '--items', itemsFile);
  };
  const submitted = submitPlan(planItems);
  assert.equal(submitted.code, 0, submitted.err);
  const review = (item, author = 'd') => {
    ok('snap', '--as', author, '--item', item);
    return ok('post', '--as', author, '--type', 'REVIEW', '--item', item, '--body', `review ${item}`);
  };
  const verdict = (type, from, item, rev) => ok('post', '--as', from, '--type', type, '--item', item, '--rev', String(rev), '--held', 'inspected', '--body', `${type} from ${from} on ${item}@r${rev}, checked app.txt`);
  if (approve) {
    ok('post', '--as', 'd', '--type', 'REVIEW', '--item', 'plan', '--body', 'please review the plan');
    verdict('OK', 'a1', 'plan', 1);
    verdict('OK', 't1', 'plan', 1);
  }
  const events = () => readFileSync(join(run, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  // Reads and acknowledges whatever is waiting, so a test starts from an empty queue.
  const drain = (member) => {
    const batch = batchOf(team('wait', '--as', member, '--timeout', '0').out);
    if (batch) assert.equal(team('wait', '--as', member, '--timeout', '0', '--seen', batch).code, 3);
    return batch;
  };
  return { root, g, run, script, team, ok, submitPlan, review, verdict, events, drain };
}

function approveAll(r) {
  r.review('step1');
  r.verdict('OK', 'a1', 'step1', 1);
  r.verdict('OK', 't1', 'step1', 1);
  r.review('tests-t1', 't1');
  r.verdict('OK', 'a1', 'tests-t1', 1);
  r.review('final');
  r.verdict('OK', 'a1', 'final', 1);
  r.verdict('OK', 't1', 'final', 1);
}

const batchOf = (text) => /batch: (batch-\d+)/.exec(text)?.[1];

test('a run stays out of git: not in status, not in a snapshot', () => {
  const r = makeRun();
  assert.equal(r.g('status', '--short'), '');
  writeFileSync(join(r.root, 'app.txt'), 'two\n');
  r.ok('snap', '--as', 'd', '--item', 'step1');
  const ref = r.events().filter((e) => e.type === 'SNAP' && e.item === 'step1').pop().ref;
  const files = r.g('ls-tree', '-r', '--name-only', ref);
  assert.ok(files.includes('app.txt'));
  assert.ok(!files.includes('.team'), files);
  assert.equal(r.g('show', `${ref}:app.txt`), 'two');
  assert.equal(r.g('status', '--short'), 'M app.txt', 'the real index stays untouched');
});

test('start refuses while any run is active in the repository, and --parallel overrides', () => {
  const r = makeRun({ task: 'part-one' });
  const second = teamIn(r.root, PLUGIN_SCRIPT, ['start', 'other-name']);
  assert.equal(second.code, 5);
  assert.match(second.err, /active run/);
  assert.equal(teamIn(r.root, PLUGIN_SCRIPT, ['start', 'other-name', '--parallel']).code, 0);
});

test('an interrupted delivery comes back; FIX forces a revision; the old OK opens nothing', () => {
  const r = makeRun();
  r.review('step1');
  r.verdict('OK', 't1', 'step1', 1);

  // The architect receives the review and is interrupted before acknowledging.
  const first = r.ok('wait', '--as', 'a1', '--timeout', '0');
  assert.match(first.out, /REVIEW step1@r1/);
  const batch = batchOf(first.out);
  const again = r.ok('wait', '--as', 'a1', '--timeout', '0');
  assert.match(again.out, /REVIEW step1@r1/, 'nothing was acknowledged, so it is delivered again');
  assert.equal(/\((.+?)\)\n/.exec(again.out)[1], /\((.+?)\)\n/.exec(first.out)[1], 'the same event id, so the repeat is visible');

  // Back at work, it answers and acknowledges in the same call.
  r.ok('post', '--as', 'a1', '--type', 'FIX', '--item', 'step1', '--rev', '1', '--held', 'inspected', '--seen', batch, '--body', 'the handler is wrong at app.txt:1');
  let gates = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'step1');
  assert.equal(gates.open, true);
  assert.equal(gates.reviewers.a1, 'fix');
  assert.equal(gates.reviewers.t1, 'ok');

  writeFileSync(join(r.root, 'app.txt'), 'fixed\n');
  r.review('step1');
  gates = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'step1');
  assert.equal(gates.rev, 2);
  assert.equal(gates.reviewers.t1, 'late', 'the OK on r1 approves nothing newer');
  assert.equal(gates.reviewers.a1, 'late');

  const late = r.verdict('OK', 'a1', 'step1', 1);
  assert.match(late.out, /late/);
  gates = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'step1');
  assert.equal(gates.open, true, 'a late OK still opens nothing');

  r.verdict('OK', 'a1', 'step1', 2);
  r.verdict('OK', 't1', 'step1', 2);
  gates = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'step1');
  assert.equal(gates.open, false);
});

test('an OK for a revision that was never sent for review is refused', () => {
  const r = makeRun();
  r.ok('snap', '--as', 'd', '--item', 'step1');
  const res = r.team('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'inspected', '--body', 'looks fine');
  assert.equal(res.code, 5);
  assert.match(res.err, /never sent for review/);
});

test('close refuses complete when a tester forgot to send its tests for review; partial passes', () => {
  const r = makeRun();
  r.review('step1');
  r.verdict('OK', 'a1', 'step1', 1);
  r.verdict('OK', 't1', 'step1', 1);
  r.review('final');
  r.verdict('OK', 'a1', 'final', 1);
  r.verdict('OK', 't1', 'final', 1);

  // Every request that was sent has its OK. The tests were simply never sent.
  const refused = r.team('close', '--as', 'd', '--status', 'complete');
  assert.equal(refused.code, 5);
  assert.match(refused.err, /tests-t1/);
  assert.equal(r.events().filter((e) => e.type === 'CLOSE').length, 0);

  assert.equal(r.team('close', '--as', 'd', '--status', 'partial').code, 2, 'partial needs a reason');
  const partial = r.ok('close', '--as', 'd', '--status', 'partial', '--reason', 'user left');
  assert.match(partial.out, /without a full review: tests-t1/);
  assert.equal(r.events().pop().meta.status, 'partial');
});

test('a complete close passes once every obligation is met', () => {
  const r = makeRun();
  approveAll(r);
  assert.match(r.ok('close', '--as', 'd', '--status', 'complete').out, /run closed: complete/);
  assert.equal(r.team('post', '--as', 'd', '--type', 'NOTE', '--to', 'a1', '--body', 'late').code, 4);
  assert.equal(r.team('snap', '--as', 'd', '--item', 'step1').code, 4);
});

test('an OK lapses when a dependency moves, also through an intermediate item', () => {
  const r = makeRun({
    items: [
      { name: 'schema', author: 'd', required: ['a1'] },
      { name: 'api', author: 'd', required: ['a1'], depends: ['schema'] },
      { name: 'ui', author: 'd', required: ['t1'], depends: ['api'] },
      { name: 'final', author: 'd', required: ['a1', 't1'] },
    ],
  });
  for (const [item, reviewer] of [['schema', 'a1'], ['api', 'a1'], ['ui', 't1']]) {
    r.review(item);
    r.verdict('OK', reviewer, item, 1);
  }
  r.review('final');
  r.verdict('OK', 'a1', 'final', 1);
  r.verdict('OK', 't1', 'final', 1);

  writeFileSync(join(r.root, 'app.txt'), 'schema changed\n');
  r.review('schema');
  r.verdict('OK', 'a1', 'schema', 2);

  const gates = JSON.parse(r.ok('gates', '--json').out);
  const ui = gates.find((g) => g.item === 'ui');
  assert.equal(ui.reviewers.t1, 'stale', 'ui rests on api, which rests on schema');
  assert.match(ui.problems.join(), /schema/);
  assert.equal(gates.find((g) => g.item === 'api').reviewers.a1, 'stale');
  assert.equal(gates.find((g) => g.item === 'final').reviewers.a1, 'stale', 'final rests on every item');

  const refused = r.team('close', '--as', 'd', '--status', 'complete');
  assert.equal(refused.code, 5);
  assert.match(refused.err, /lapsed/);
});

test('an OK sent after a dependency moved does not count for the older snapshot', () => {
  const r = makeRun();
  approveAll(r);
  writeFileSync(join(r.root, 'app.txt'), 'step changed after final was captured\n');
  r.review('step1');
  r.verdict('OK', 'a1', 'step1', 2);
  r.verdict('OK', 't1', 'step1', 2);
  // a1 answers final@r1 only now, later than step1@r2, on a tree without that change.
  const answer = r.ok('post', '--as', 'a1', '--type', 'OK', '--item', 'final', '--rev', '1', '--held', 'inspected', '--body', 'second look at final, still fine');
  assert.match(answer.out, /^posted/, 'a new event, later than step1@r2');
  const final = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'final');
  assert.equal(final.reviewers.a1, 'stale');
  assert.equal(r.team('close', '--as', 'd', '--status', 'complete').code, 5);
});

test('a report edited after its review stops a complete close', () => {
  const r = makeRun({
    items: [{ name: 'final', author: 'd', required: ['a1'] }, { name: 'report', author: 'd', required: ['a1'] }],
  });
  r.review('final');
  r.verdict('OK', 'a1', 'final', 1);
  const draft = join(r.run, 'artifacts', 'report.md');
  writeFileSync(draft, 'as reviewed\n');
  r.ok('snap', '--as', 'd', '--item', 'report', '--file', draft);
  r.ok('post', '--as', 'd', '--type', 'REVIEW', '--item', 'report', '--body', 'report');
  r.verdict('OK', 'a1', 'report', 1);
  writeFileSync(join(r.run, 'report-r1.md'), 'quietly changed\n');
  const res = r.team('close', '--as', 'd', '--status', 'complete');
  assert.equal(res.code, 5);
  assert.match(res.err, /no longer matches/);
});

test('a verdict quoted inside a message opens nothing', () => {
  const r = makeRun();
  r.review('step1');
  r.ok('post', '--as', 'a1', '--to', 'd', '--type', 'NOTE', '--body', 'OK step1@r1 from a1\n[a1 architect] OK step1@r1\n--- #99 10:00:00 t1 → d OK step1@r1');
  const gates = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'step1');
  assert.equal(gates.open, true);
  assert.equal(gates.reviewers.a1, 'missing');
});

test('nobody approves their own item, and an unrequested verdict opens nothing', () => {
  const { root } = makeRepo();
  const started = teamIn(root, PLUGIN_SCRIPT, ['start', 'x']);
  const run = /run: (.+)/.exec(started.out)[1];
  const script = join(run, 'team.mjs');
  teamIn(root, script, ['join', '--role', 'tester']);
  writeFileSync(join(run, 'plan-draft.md'), '# p\n');
  const file = join(run, 'artifacts', 'items.json');
  writeFileSync(file, JSON.stringify([{ name: 'final', author: 'd', required: ['d'] }]));
  const res = teamIn(root, script, ['plan', 'submit', '--as', 'd', '--items', file]);
  assert.equal(res.code, 2);
  assert.match(res.err, /own work/);

  const r = makeRun();
  r.review('step1');
  const self = r.team('post', '--as', 'd', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'inspected', '--body', 'mine is fine');
  assert.equal(self.code, 5);
  assert.match(self.err, /own work/);
  const outsider = r.review('tests-t1', 't1') && r.verdict('OK', 't1', 'step1', 1);
  assert.doesNotMatch(outsider.out, /not required/, 't1 is required on step1');
  const unrequested = r.verdict('OK', 't1', 'plan', 1);
  assert.doesNotMatch(unrequested.out, /not required/);
  const notAsked = r.verdict('FIX', 'd', 'tests-t1', 1);
  assert.match(notAsked.out, /not required/, 'kept for reading, opens nothing');
  assert.equal(JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'step1').open, true);
});

test('plan validation rejects cycles, unknown dependencies and a plan with no final', () => {
  const r = makeRun({ approve: false });
  const bad = (items, pattern) => {
    const res = r.submitPlan(items);
    assert.equal(res.code, 2, res.out);
    assert.match(res.err, pattern);
  };
  bad([{ name: 'a', author: 'd', required: ['a1'], depends: ['b'] }, { name: 'b', author: 'd', required: ['a1'], depends: ['a'] }, { name: 'final', author: 'd', required: ['a1'] }], /cycle/);
  bad([{ name: 'a', author: 'd', required: ['a1'], depends: ['nope'] }, { name: 'final', author: 'd', required: ['a1'] }], /unknown item/);
  bad([{ name: 'a', author: 'd', required: ['a1'] }], /named final/);
  bad([{ name: 'a', author: 'd', required: ['a1'], depends: ['final'] }, { name: 'final', author: 'd', required: ['a1'] }], /comes last/);
});

test('a plan revision asks only those it affects, and the approved text is fixed', () => {
  const r = makeRun();
  const planFile = join(r.run, 'plans', 'plan-r1.md');
  const items = [
    { name: 'step1', author: 'd', required: ['a1', 't1'] },
    { name: 'tests-t1', author: 't1', required: ['a1'] },
    { name: 'docs', author: 'd', required: ['a1'] },
    { name: 'final', author: 'd', required: ['a1', 't1'] },
  ];
  const res = r.submitPlan(items, '# Plan\n\nDo the thing, with docs.\n');
  assert.equal(res.code, 0, res.err);
  assert.match(res.out, /asked of: a1\b/);
  r.ok('post', '--as', 'd', '--type', 'REVIEW', '--item', 'plan', '--body', 'added docs');
  let plan = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'plan');
  assert.equal(plan.reviewers.t1, 'ok', 't1 is not touched by docs, its OK on r1 stands');
  assert.notEqual(plan.reviewers.a1, 'ok');
  r.verdict('OK', 'a1', 'plan', 2);
  plan = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'plan');
  assert.equal(plan.open, false);

  assert.match(readFileSync(planFile, 'utf8'), /Do the thing\.\n/);
  assert.match(readFileSync(join(r.run, 'plan.md'), 'utf8'), /with docs/);
  assert.equal(statSync(join(r.run, 'plans', 'plan-r2.md')).mode & 0o222, 0, 'read-only');

  // A text-only revision cannot be read by the script, so it asks everybody.
  const prose = r.submitPlan(items, '# Plan\n\nDifferent scope in prose.\n');
  assert.match(prose.out, /asked of: a1, t1|asked of: t1, a1/);
});

test('an edited plan file stops a complete close', () => {
  const r = makeRun();
  approveAll(r);
  const file = join(r.run, 'plans', 'plan-r1.md');
  execFileSync('chmod', ['u+w', file]);
  writeFileSync(file, '# Plan\n\nQuietly wider scope.\n');
  const res = r.team('close', '--as', 'd', '--status', 'complete');
  assert.equal(res.code, 5);
  assert.match(res.err, /no longer matches/);
});

test('the report has its own revisions: a correction asks one member and leaves the code alone', () => {
  const r = makeRun({
    items: [
      { name: 'final', author: 'd', required: ['a1', 't1'] },
      { name: 'report', author: 'd', required: ['a1', 't1'] },
    ],
  });
  r.review('final');
  r.verdict('OK', 'a1', 'final', 1);
  r.verdict('OK', 't1', 'final', 1);
  const report = join(r.run, 'artifacts', 'report.md');
  writeFileSync(report, 'first version\n');
  r.ok('snap', '--as', 'd', '--item', 'report', '--file', report);
  r.ok('post', '--as', 'd', '--type', 'REVIEW', '--item', 'report', '--body', 'report r1');
  r.verdict('OK', 'a1', 'report', 1);
  r.verdict('FIX', 't1', 'report', 1);

  writeFileSync(report, 'corrected line of t1\n');
  r.ok('snap', '--as', 'd', '--item', 'report', '--file', report, '--correction-of', 't1');
  const sent = r.ok('post', '--as', 'd', '--type', 'REVIEW', '--item', 'report', '--body', 'report r2, your line');
  assert.match(sent.out, /posted/);
  assert.deepEqual(r.events().filter((e) => e.type === 'REVIEW' && e.item === 'report').pop().to, ['t1']);
  r.verdict('OK', 't1', 'report', 2);

  const gates = JSON.parse(r.ok('gates', '--json').out);
  assert.equal(gates.find((g) => g.item === 'report').open, false, "a1's OK on r1 stands");
  assert.equal(gates.find((g) => g.item === 'final').open, false, 'the code OKs are untouched');
  assert.ok(existsSync(join(r.run, 'report-r1.md')));
  assert.equal(readFileSync(join(r.run, 'report-r2.md'), 'utf8'), 'corrected line of t1\n');
  r.ok('close', '--as', 'd', '--status', 'complete');
});

test('a snapshot taken for another member keeps the authorship with that member', () => {
  const r = makeRun();
  const self = r.team('snap', '--as', 'a1', '--item', 'tests-t1');
  assert.equal(self.code, 5);
  r.ok('snap', '--as', 'd', '--item', 'tests-t1', '--for', 't1');
  const snap = r.events().filter((e) => e.type === 'SNAP' && e.item === 'tests-t1').pop();
  assert.equal(snap.meta.author, 't1');
  assert.equal(snap.meta.snapshot_by, 'd');
  assert.equal(r.team('post', '--as', 'd', '--type', 'REVIEW', '--item', 'tests-t1', '--body', 'x').code, 5, 'the author asks for the review');
  r.ok('post', '--as', 't1', '--type', 'REVIEW', '--item', 'tests-t1', '--body', 'my tests');
  const self2 = r.verdict('OK', 'd', 'tests-t1', 1);
  assert.match(self2.out, /not required/, 'taking the snapshot does not make d a reviewer');
});

test('status while a wait runs in the background confirms nothing', async () => {
  const r = makeRun();
  r.drain('a1');
  r.drain('t1');
  r.review('step1');
  r.ok('post', '--as', 'd', '--type', 'NOTE', '--to', 'a1', '--body', 'one more');
  r.drain('t1');

  const delivered = r.ok('wait', '--as', 'a1', '--timeout', '0');
  assert.ok(batchOf(delivered.out));
  // A second wait stays in the background waiting for something new after a1's reply.
  const background = spawn(process.execPath, [r.script, 'wait', '--as', 't1', '--timeout', '5', '--poll', '50'], { cwd: r.root, stdio: 'pipe' });
  await new Promise((done) => setTimeout(done, 200));
  assert.ok(JSON.parse(r.ok('status', '--json').out).members.find((m) => m.id === 't1').waitStartedAt, 'the wait shows up as a fact');

  const status = JSON.parse(r.ok('status', '--json', '--as', 'a1', '--doing', 'reading the diff').out);
  const a1 = status.members.find((m) => m.id === 'a1');
  const delivered2 = Number(batchOf(delivered.out).slice(6));
  assert.ok(a1.seen < delivered2, 'nothing acknowledged');
  assert.equal(a1.delivered, delivered2);
  assert.equal(a1.doing, 'reading the diff');
  assert.equal(a1.unread, 2);
  assert.equal(status.requests.find((x) => x.item === 'step1' && x.reviewer === 'a1').state, 'delivered');

  r.ok('log');
  r.ok('gates');
  assert.match(r.ok('wait', '--as', 'a1', '--timeout', '0').out, /REVIEW step1@r1/, 'log, gates and status moved nothing');
  background.kill();
  await new Promise((done) => background.on('close', done));
});

test('delivery states go written, delivered, acknowledged, resolved', () => {
  const r = makeRun();
  r.drain('a1');
  r.review('step1');
  const stateOf = () => JSON.parse(r.ok('status', '--json').out).requests.find((x) => x.item === 'step1' && x.reviewer === 'a1').state;
  assert.equal(stateOf(), 'written');
  const batch = batchOf(r.ok('wait', '--as', 'a1', '--timeout', '0').out);
  assert.equal(stateOf(), 'delivered');
  r.ok('post', '--as', 'a1', '--to', 'd', '--type', 'NOTE', '--seen', batch, '--body', 'reading');
  assert.equal(stateOf(), 'acknowledged');
  r.verdict('OK', 'a1', 'step1', 1);
  assert.equal(stateOf(), 'resolved');
});

test('--seen is exact and idempotent; a batch never delivered is refused', () => {
  const r = makeRun();
  r.drain('a1');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'first');
  const bad = r.team('post', '--as', 'a1', '--to', 'd', '--type', 'NOTE', '--seen', 'batch-9999', '--body', 'x');
  assert.equal(bad.code, 2);
  const batch = batchOf(r.ok('wait', '--as', 'a1', '--timeout', '0').out);
  assert.equal(r.team('wait', '--as', 'a1', '--timeout', '0', '--seen', batch).code, 3, 'acknowledged, nothing left');
  assert.equal(r.team('wait', '--as', 'a1', '--timeout', '0', '--seen', batch).code, 3, 'repeating it changes nothing');
  assert.equal(r.team('wait', '--as', 'a1', '--timeout', '0', '--seen', 'nonsense').code, 2);
});

test('repeating the same post writes one event; --op makes a deliberate repeat distinct', () => {
  const r = makeRun();
  const once = r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'same text');
  const twice = r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'same text');
  assert.match(twice.out, /already posted/);
  assert.equal(/ (\S+-\S+)\n/.exec(once.out)[1], / (\S+-\S+)\n/.exec(twice.out)[1]);
  assert.equal(r.events().filter((e) => e.body === 'same text').length, 1);
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'same text', '--op', 'second');
  assert.equal(r.events().filter((e) => e.body === 'same text').length, 2);
});

test('retrying a snapshot of an unchanged tree does not invent a revision', () => {
  const r = makeRun();
  r.ok('snap', '--as', 'd', '--item', 'step1');
  r.ok('snap', '--as', 'd', '--item', 'step1');
  assert.equal(r.events().filter((e) => e.type === 'SNAP' && e.item === 'step1').length, 1);
});

test('parallel posts from many processes: every line valid, nothing lost', async () => {
  for (let round = 0; round < REPEAT; round++) {
    const r = makeRun();
    const before = r.events().length;
    const senders = ['d', 'a1', 't1'];
    const total = 24;
    await Promise.all(Array.from({ length: total }, (_, i) => new Promise((done, reject) => {
      const child = spawn(process.execPath, [r.script, 'post', '--as', senders[i % 3], '--to', 'all', '--type', 'NOTE', '--body', `message ${i} ${'x'.repeat(20000)}`], { cwd: r.root, stdio: 'ignore' });
      child.on('close', (code) => (code === 0 ? done() : reject(new Error(`post ${i} exited ${code}`))));
    })));
    const events = r.events();
    assert.equal(events.length, before + total);
    const bodies = new Set(events.filter((e) => e.type === 'NOTE').map((e) => e.body));
    assert.equal(bodies.size, total);
    assert.equal(new Set(events.map((e) => e.id)).size, events.length);
    assert.equal(readdirSync(join(r.run, '.state')).filter((f) => f.startsWith('lock')).length, 0);
    const chat = readFileSync(join(r.run, 'chat.md'), 'utf8');
    for (let i = 0; i < total; i++) assert.ok(chat.includes(`message ${i} `), `chat.md misses message ${i}`);
  }
});

test('a new revision racing a close has one clear order, and stale approvals never close it', async () => {
  for (let round = 0; round < REPEAT * 4; round++) {
    const r = makeRun();
    approveAll(r);
    writeFileSync(join(r.root, 'app.txt'), `changed ${round}\n`);
    const run = (args) => new Promise((done) => {
      const child = spawn(process.execPath, [r.script, ...args], { cwd: r.root, stdio: 'ignore' });
      child.on('close', done);
    });
    const [snapCode, closeCode] = await Promise.all([
      run(['snap', '--as', 'd', '--item', 'step1']),
      run(['close', '--as', 'd', '--status', 'complete']),
    ]);
    const events = r.events();
    const close = events.findIndex((e) => e.type === 'CLOSE');
    const lastSnap = events.findLastIndex((e) => e.type === 'SNAP');
    if (closeCode === 0) {
      assert.ok(lastSnap < close, 'a run closed complete has no revision after its last approval');
      assert.equal(snapCode, 4, 'a snapshot after the close is refused');
    } else {
      assert.equal(closeCode, 5);
      assert.equal(snapCode, 0);
      assert.equal(close, -1);
    }
  }
});

test('an interrupted write is detected and repaired, and a retry yields one event', () => {
  const r = makeRun();
  const log = join(r.run, 'events.jsonl');
  const before = r.events().length;
  appendFileSync(log, '{"id":"half-written","type":"NOTE","body":"cut off he');

  // A reader skips the torn tail and is not confused by it.
  assert.equal(JSON.parse(r.ok('status', '--json').out).entries, before);

  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'after the crash');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'after the crash');
  const events = r.events();
  assert.equal(events.length, before + 2, 'one REPAIR and one NOTE');
  assert.equal(events[before].type, 'REPAIR');
  assert.equal(events.filter((e) => e.body === 'after the crash').length, 1);
  const kept = readdirSync(join(r.run, '.state')).find((f) => f.startsWith('torn-'));
  assert.match(readFileSync(join(r.run, '.state', kept), 'utf8'), /cut off he/);
});

test('a broken line inside the log stops writing with a clear error', () => {
  const r = makeRun();
  const log = join(r.run, 'events.jsonl');
  const lines = readFileSync(log, 'utf8').split('\n');
  lines[1] = 'not json at all';
  writeFileSync(log, lines.join('\n'));
  const res = r.team('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'x');
  assert.equal(res.code, 7);
  assert.match(res.err, /line 2/);
  assert.equal(readFileSync(log, 'utf8'), lines.join('\n'), 'nothing was changed');
});

test('a lock left by a dead process is taken over; a live one is waited for', async () => {
  const r = makeRun();
  const lock = join(r.run, '.state', 'lock');
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner'), 'dead process');
  const old = new Date(Date.now() - 60_000);
  utimesSync(lock, old, old);
  const started = Date.now();
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'after a dead lock');
  assert.ok(Date.now() - started < 5000);
  assert.ok(!existsSync(lock));

  mkdirSync(lock);
  writeFileSync(join(lock, 'owner'), 'alive');
  const child = spawn(process.execPath, [r.script, 'post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'behind a live lock'], { cwd: r.root, stdio: 'ignore' });
  const exited = new Promise((done) => child.on('close', done));
  await new Promise((done) => setTimeout(done, 400));
  assert.equal(r.events().filter((e) => e.body === 'behind a live lock').length, 0, 'it waits for the holder');
  rmSync(lock, { recursive: true });
  assert.equal(await exited, 0);
  assert.equal(r.events().filter((e) => e.body === 'behind a live lock').length, 1);
});

test('wait holds no lock: a post goes through while somebody waits', async () => {
  const r = makeRun();
  r.drain('a1');
  const waiter = spawn(process.execPath, [r.script, 'wait', '--as', 'a1', '--timeout', '20', '--poll', '50'], { cwd: r.root, stdio: 'pipe' });
  let output = '';
  waiter.stdout.on('data', (d) => { output += d; });
  const code = new Promise((done) => waiter.on('close', done));
  await new Promise((done) => setTimeout(done, 300));
  assert.ok(!existsSync(join(r.run, '.state', 'lock')));
  const started = Date.now();
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'wake up');
  assert.equal(await code, 0);
  assert.match(output, /wake up/);
  assert.match(output, /batch-\d+/);
  assert.ok(Date.now() - started < 5000);
});

test('wait wakes only its addressee', async () => {
  const r = makeRun();
  r.drain('t1');
  const t1 = spawn(process.execPath, [r.script, 'wait', '--as', 't1', '--timeout', '2', '--poll', '50'], { cwd: r.root, stdio: 'pipe' });
  const code = new Promise((done) => t1.on('close', done));
  await new Promise((done) => setTimeout(done, 200));
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'only for a1');
  assert.equal(await code, 3, 't1 stayed asleep until its timeout');
});

test('a wait killed mid-delivery loses nothing; a restarted wait gets it again', async () => {
  const r = makeRun();
  r.drain('a1');
  const waiter = spawn(process.execPath, [r.script, 'wait', '--as', 'a1', '--timeout', '20', '--poll', '50'], { cwd: r.root, stdio: 'pipe' });
  const closed = new Promise((done) => waiter.on('close', done));
  await new Promise((done) => setTimeout(done, 200));
  waiter.kill('SIGKILL');
  await closed;
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'while nobody listens');
  assert.match(r.ok('wait', '--as', 'a1', '--timeout', '0').out, /while nobody listens/);
});

test('closing the run ends a running wait with code 4 and releases the member', async () => {
  const r = makeRun();
  r.drain('t1');
  const waiter = spawn(process.execPath, [r.script, 'wait', '--as', 't1', '--timeout', '20', '--poll', '50'], { cwd: r.root, stdio: 'pipe' });
  let output = '';
  waiter.stdout.on('data', (d) => { output += d; });
  const code = new Promise((done) => waiter.on('close', done));
  await new Promise((done) => setTimeout(done, 200));
  r.ok('close', '--as', 'd', '--status', 'abandoned', '--reason', 'wrong task');
  assert.equal(await code, 4);
  assert.match(output, /run closed: abandoned/);
  assert.equal(r.team('wait', '--as', 't1', '--timeout', '0').code, 4);
  assert.equal(teamIn(r.root, PLUGIN_SCRIPT, ['start', 'next']).code, 0, 'the repository is free again');
});

test('anybody may abandon on the user\'s word; only the driver finishes', () => {
  const r = makeRun();
  assert.equal(r.team('close', '--as', 't1', '--status', 'partial', '--reason', 'x').code, 5);
  assert.equal(r.team('close', '--as', 'user', '--status', 'complete').code, 5);
  r.ok('close', '--as', 'user', '--status', 'abandoned', '--reason', 'started by mistake');
  assert.equal(r.events().pop().from, 'user');
});

test('only the driver records what the user authorised', () => {
  const r = makeRun();
  const res = r.team('post', '--as', 't1', '--to', 'd', '--type', 'DECISION', '--tag', 'authorised', '--body', 'you may push');
  assert.equal(res.code, 5);
  r.ok('post', '--as', 'd', '--to', 'all', '--type', 'DECISION', '--tag', 'authorised', '--body', 'push to the feature branch');
  r.ok('post', '--as', 'd', '--to', 'all', '--type', 'DECISION', '--tag', 'declined', '--body', 'a1 suggested X; not now because Y');
  const plan = readFileSync(join(r.run, 'plan.md'), 'utf8');
  assert.match(plan, /Authorised by the user[\s\S]*push to the feature branch/);
  assert.match(plan, /Declined[\s\S]*not now because Y/);
  assert.match(r.ok('log', '--tag', 'declined').out, /not now because Y/);
});

test('the views can be rebuilt from the log alone', () => {
  const r = makeRun();
  r.review('step1');
  const views = ['chat.md', 'team.md', 'plan.md'];
  const original = views.map((v) => readFileSync(join(r.run, v), 'utf8'));
  for (const v of views) rmSync(join(r.run, v));
  r.ok('rebuild');
  assert.deepEqual(views.map((v) => readFileSync(join(r.run, v), 'utf8')), original);
  assert.match(original[1], /\| a1 \| architect \| codex/);
  assert.match(original[0], /REVIEW step1@r1/);
});

test('a session in a worktree uses the same run and snapshots its own tree', () => {
  const r = makeRun();
  const wt = join(r.root, '..', `wt-${Math.random().toString(36).slice(2)}`);
  roots.push(wt);
  r.g('worktree', 'add', '-q', '--detach', wt);
  writeFileSync(join(wt, 'tester.txt'), 'from the worktree\n');
  const res = teamIn(wt, r.script, ['snap', '--as', 't1', '--item', 'tests-t1']);
  assert.equal(res.code, 0, res.err);
  const ref = r.events().filter((e) => e.item === 'tests-t1').pop().ref;
  assert.ok(r.g('ls-tree', '-r', '--name-only', ref).includes('tester.txt'));
  assert.ok(!existsSync(join(wt, '.team')), 'no second run directory appears');
});

test('rejoin keeps the id after a lost session; a role cannot be taken over', () => {
  const r = makeRun();
  const again = r.ok('join', '--role', 'architect', '--runtime', 'codex', '--rejoin', 'a1');
  assert.match(again.out, /you are: a1/);
  assert.equal(r.team('join', '--role', 'tester', '--rejoin', 'a1').code, 2);
  assert.match(r.ok('join', '--role', 'architect').out, /you are: a2/);
});

test('gc removes refs of closed runs only and keeps the logs', () => {
  const r = makeRun();
  r.review('step1');
  const refs = () => r.g('for-each-ref', 'refs/team/').split('\n').filter(Boolean).length;
  const before = refs();
  assert.ok(before >= 2);
  teamIn(r.root, PLUGIN_SCRIPT, ['gc']);
  assert.equal(refs(), before, 'an active run keeps its refs');
  r.ok('close', '--as', 'd', '--status', 'abandoned', '--reason', 'done testing');
  assert.match(teamIn(r.root, PLUGIN_SCRIPT, ['gc', '--dry-run']).out, /would remove/);
  assert.equal(refs(), before);
  teamIn(r.root, PLUGIN_SCRIPT, ['gc']);
  assert.equal(refs(), 0);
  assert.ok(existsSync(join(r.run, 'events.jsonl')));
});

test('doctor reports what this session can write', () => {
  const { root } = makeRepo();
  const report = JSON.parse(teamIn(root, PLUGIN_SCRIPT, ['doctor', '--json']).out);
  assert.equal(report.write, true);
  assert.equal(report.snap, true);
  assert.equal(execFileSync('git', ['for-each-ref', 'refs/team/'], { cwd: root, encoding: 'utf8' }).trim(), '', 'the probe leaves no ref');
});

test('--seen names the last delivered batch when it is wrong, and nothing is posted', () => {
  const r = makeRun();
  const before = r.events().length;
  const res = r.team('post', '--as', 'a1', '--to', 'd', '--type', 'NOTE', '--seen', 'batch-9999', '--body', 'x');
  assert.equal(res.code, 2);
  assert.match(res.err, /last one delivered is batch-\d+/);
  assert.equal(r.events().length, before);
});

test('--soft-timeout turns an idle timeout into exit 0 with a plain state line', () => {
  const r = makeRun();
  r.drain('a1');
  const soft = r.team('wait', '--as', 'a1', '--timeout', '0', '--soft-timeout');
  assert.equal(soft.code, 0);
  assert.match(soft.out, /state: idle/);
  assert.equal(r.team('wait', '--as', 'a1', '--timeout', '0').code, 3, 'scripts still get 3 by default');
});

test('a verdict states how it is held, and executed needs a recorded run of that revision', () => {
  const r = makeRun();
  r.review('step1');
  assert.equal(r.team('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--body', 'x').code, 2, 'held is required');
  assert.equal(r.team('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'executed', '--body', 'x').code, 2, 'executed needs evidence');
  assert.equal(r.team('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'executed', '--evidence', 'xnope', '--body', 'x').code, 5, 'an unknown run is refused');

  const ran = r.ok('exec', '--as', 'a1', '--item', 'step1', '--rev', '1', '--', 'cat app.txt');
  const id = /exec: (\S+)/.exec(ran.out)[1];
  assert.match(ran.out, /exit=0/);
  assert.match(ran.out, /one/);
  assert.equal(r.team('post', '--as', 't1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'executed', '--evidence', id, '--body', 'x').code, 5, "somebody else's run is refused");

  r.ok('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'executed', '--evidence', id, '--body', 'cat app.txt shows one');
  const row = JSON.parse(r.ok('gates', '--json').out).find((g) => g.item === 'step1');
  assert.equal(row.reviewers.a1, 'ok');
  assert.equal(row.held.a1, 'executed');
  const record = r.events().find((e) => e.type === 'EXEC');
  assert.equal(record.meta.exit, 0);
  assert.equal(record.sha, r.events().filter((e) => e.type === 'SNAP' && e.item === 'step1').pop().sha);
  assert.equal(readFileSync(join(r.run, record.meta.output, 'stdout.txt'), 'utf8'), 'one\n');
});

test("a tester's own new file is reported and is not a contradiction", () => {
  const r = makeRun();
  r.review('step1');
  writeFileSync(join(r.root, 'mine.test.js'), 'a test\n');
  const ran = r.ok('exec', '--as', 'a1', '--item', 'step1', '--rev', '1', '--', 'true');
  assert.match(ran.out, /holds step1@r1, plus files it does not have: mine\.test\.js/);
  const id = /exec: (\S+)/.exec(ran.out)[1];
  assert.equal(r.events().find((e) => e.meta?.exec === id).meta.tree, 'extra');
  const res = r.ok('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'executed', '--evidence', id, '--body', 'ran it');
  assert.doesNotMatch(res.out, /contradiction/);
});

test('an OK citing a failed run is recorded as a contradiction; a run for another revision is refused', () => {
  const r = makeRun();
  r.review('step1');
  const failed = /exec: (\S+)/.exec(r.ok('exec', '--as', 'a1', '--item', 'step1', '--rev', '1', '--', 'exit 3').out)[1];
  const res = r.ok('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'executed', '--evidence', failed, '--body', 'all passed');
  assert.match(res.out, /contradiction/);
  r.verdict('OK', 't1', 'step1', 1);
  assert.match(r.ok('gates').out, /WARNING a1: OK #\d+ cites a run with exit=3/);

  writeFileSync(join(r.root, 'app.txt'), 'two\n');
  r.review('step1');
  const stale = r.team('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '2', '--held', 'executed', '--evidence', failed, '--body', 'x');
  assert.equal(stale.code, 5);
  assert.match(stale.err, /recorded for step1@r1, not step1@r2/);
});

test('exec records a spawn that could not start, with every field', () => {
  const r = makeRun();
  const res = r.ok('exec', '--as', 'a1', '--in', join(r.root, 'no-such-dir'), '--', 'true');
  assert.match(res.out, /error=ENOENT/);
  const record = r.events().filter((e) => e.type === 'EXEC').pop();
  assert.equal(record.meta.exit, null);
  assert.equal(record.meta.errorCode, 'ENOENT');
});

// A stand-in for `codex queue`: records its arguments, and acts per the mode file.
function fakeWake(r) {
  const dir = mkdtempSync(join(tmpdir(), 'team-wake-'));
  roots.push(dir);
  const calls = join(dir, 'calls.txt');
  const script = join(dir, 'fake.sh');
  writeFileSync(script, `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(calls)}\ncat ${JSON.stringify(join(dir, 'err'))} >&2 2>/dev/null\nexit $(cat ${JSON.stringify(join(dir, 'code'))} 2>/dev/null || echo 0)\n`);
  execFileSync('chmod', ['+x', script]);
  const count = () => (existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).length : 0);
  const watch = (...args) => {
    const child = spawn(process.execPath, [r.script, 'watch', '--poll', '40', ...args], { cwd: r.root, stdio: 'pipe', env: { ...process.env, TEAM_WAKE_CMD: script } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    return { child, closed: new Promise((done) => child.on('close', done)), out: () => out };
  };
  return { dir, calls, count, watch };
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

async function until(check, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await pause(30);
  }
  return false;
}

function codexMember(r) {
  r.ok('join', '--role', 'architect', '--runtime', 'codex', '--rejoin', 'a1', '--wake', 'codex-queue', '--thread', 'thread-a1');
  r.drain('a1');
}

test('join binds the session from the environment; --wake none opts out', () => {
  const r = makeRun();
  const res = spawnSync(process.execPath, [r.script, 'join', '--role', 'tester', '--runtime', 'codex'], { cwd: r.root, encoding: 'utf8', env: { ...process.env, CODEX_THREAD_ID: 'from-env' } });
  assert.match(res.stdout, /woken by: codex-queue, session from-env/);
  assert.match(res.stdout, /end your turn/);
  const none = spawnSync(process.execPath, [r.script, 'join', '--role', 'tester', '--wake', 'none'], { cwd: r.root, encoding: 'utf8', env: { ...process.env, CODEX_THREAD_ID: 'from-env' } });
  assert.doesNotMatch(none.stdout, /woken by/);
  assert.equal(r.team('join', '--role', 'tester', '--wake', 'codex-queue').code, 2, 'needs a session id');
});

test('a rejoin from a new session moves the signal there', async () => {
  const r = makeRun();
  codexMember(r);
  const w = fakeWake(r);
  const watcher = w.watch('--quiet', '100', '--progress', '60000');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'first');
  assert.ok(await until(() => w.count() === 1), 'the first signal');
  r.ok('join', '--role', 'architect', '--runtime', 'codex', '--rejoin', 'a1', '--wake', 'codex-queue', '--thread', 'thread-new');
  r.drain('a1');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'second');
  assert.ok(await until(() => w.count() === 2), 'the second signal');
  watcher.child.kill();
  await watcher.closed;
  const [before, after] = readFileSync(w.calls, 'utf8').trim().split('\n');
  assert.match(before, /--thread thread-a1 /);
  assert.match(after, /--thread thread-new /);
});

test('watch: a burst gives one signal, it carries no message text, and read state causes none', async () => {
  const r = makeRun();
  codexMember(r);
  const w = fakeWake(r);
  const watcher = w.watch('--quiet', '300', '--progress', '60000');
  await pause(200);
  assert.equal(w.count(), 0, 'silence costs nothing');

  for (let i = 0; i < 5; i++) r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', `secret body ${i}`);
  assert.ok(await until(() => w.count() === 1), 'one signal for the burst');
  await pause(400);
  assert.equal(w.count(), 1);
  const call = readFileSync(w.calls, 'utf8');
  assert.match(call, /queue --thread thread-a1 --message/);
  assert.match(call, /--resume/);
  assert.doesNotMatch(call, /secret body/, 'content stays in the log');

  // The member reads: the cursor, the delivery file and the views all change, and nothing is sent.
  const batch = batchOf(r.ok('wait', '--as', 'a1', '--timeout', '0').out);
  r.team('wait', '--as', 'a1', '--timeout', '0', '--seen', batch);
  r.ok('rebuild');
  await pause(400);
  assert.equal(w.count(), 1);

  // A message for somebody else does not wake it either.
  r.ok('post', '--as', 'd', '--to', 't1', '--type', 'NOTE', '--body', 'for t1');
  await pause(400);
  assert.equal(w.count(), 1);
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'next one');
  assert.ok(await until(() => w.count() === 2), 'a new message after a read gets a new signal');
  watcher.child.kill();
  await watcher.closed;
});

test('watch: no response gets limited retries, then one wake_failed to the driver and silence', async () => {
  const r = makeRun();
  codexMember(r);
  r.drain('d');
  const w = fakeWake(r);
  const watcher = w.watch('--quiet', '0', '--progress', '150', '--attempts', '3');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'are you reading this');
  assert.ok(await until(() => r.events().some((e) => e.type === 'WAKE_FAILED')), 'failure becomes visible');
  assert.equal(w.count(), 3);
  await pause(500);
  assert.equal(w.count(), 3, 'nothing more is sent');
  assert.equal(r.events().filter((e) => e.type === 'WAKE_FAILED').length, 1);
  assert.match(r.ok('wait', '--as', 'd', '--timeout', '0').out, /did not respond to 3 signals/);
  const status = JSON.parse(r.ok('status', '--json').out).members.find((m) => m.id === 'a1');
  assert.equal(status.wake.state, 'wake_failed');

  // The user tells that session by hand; once it reads, signals work again.
  const batch = batchOf(r.ok('wait', '--as', 'a1', '--timeout', '0').out);
  r.team('wait', '--as', 'a1', '--timeout', '0', '--seen', batch);
  assert.ok(await until(() => JSON.parse(r.ok('status', '--json').out).members.find((m) => m.id === 'a1').wake.state === 'idle'));
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'after recovery');
  assert.ok(await until(() => w.count() === 4));
  watcher.child.kill();
  await watcher.closed;
});

test('watch: a failing queue command retries quickly and the failure names what it said', async () => {
  const r = makeRun();
  codexMember(r);
  r.drain('d');
  const w = fakeWake(r);
  writeFileSync(join(w.dir, 'code'), '1');
  writeFileSync(join(w.dir, 'err'), 'thread not found');
  const watcher = w.watch('--quiet', '0', '--progress', '600000', '--retry', '60', '--attempts', '2');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'first');
  assert.ok(await until(() => r.events().some((e) => e.type === 'WAKE_FAILED')));
  assert.equal(w.count(), 2);
  assert.match(r.events().find((e) => e.type === 'WAKE_FAILED').body, /status=1 .*thread not found/);
  watcher.child.kill();
  await watcher.closed;
});

test('post warns when a recipient depends on a watcher and none is running', async () => {
  const r = makeRun();
  codexMember(r);
  const res = r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'x');
  assert.match(res.out, /none is running/);
  assert.doesNotMatch(r.ok('post', '--as', 'd', '--to', 't1', '--type', 'NOTE', '--body', 'x').out, /none is running/);
  const w = fakeWake(r);
  const watcher = w.watch('--quiet', '100000');
  assert.ok(await until(() => watcher.out().includes('watching')));
  assert.doesNotMatch(r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'y').out, /none is running/);
  watcher.child.kill();
  await watcher.closed;
});

test('watch: contact from a busy member restarts the clock, and silence after it still fails', async () => {
  const r = makeRun();
  codexMember(r);
  r.drain('d');
  const w = fakeWake(r);
  const watcher = w.watch('--quiet', '0', '--progress', '400', '--attempts', '2');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'first');
  assert.ok(await until(() => w.count() === 1));
  // Busy, not gone: it posts about something else without having read this yet.
  await pause(150);
  r.ok('post', '--as', 'a1', '--to', 'd', '--type', 'NOTE', '--body', 'still on the previous thing');
  await pause(350);
  assert.equal(w.count(), 1, 'contact pushed the retry back');
  assert.ok(await until(() => r.events().some((e) => e.type === 'WAKE_FAILED')));
  assert.equal(w.count(), 2);
  watcher.child.kill();
  await watcher.closed;
});

test('watch: a restarted watcher picks up pending messages, does not repeat a fresh signal, and only one runs', async () => {
  const r = makeRun();
  codexMember(r);
  const w = fakeWake(r);
  const first = w.watch('--quiet', '0', '--progress', '60000');
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'before the restart');
  assert.ok(await until(() => w.count() === 1));

  const second = w.watch('--quiet', '0');
  assert.equal(await second.closed, 0);
  assert.match(second.out(), /already running/);

  first.child.kill('SIGKILL');
  await first.closed;
  const after = w.watch('--quiet', '0', '--progress', '60000', '--stale', '200');
  assert.ok(await until(() => after.out().includes('watching')), 'a dead heartbeat is taken over');
  await pause(300);
  assert.equal(w.count(), 1, 'the signal already sent is remembered');
  after.child.kill('SIGKILL');
  await after.closed;

  // Messages written while nobody watched are signalled by the next watcher.
  const batch = batchOf(r.ok('wait', '--as', 'a1', '--timeout', '0').out);
  r.team('wait', '--as', 'a1', '--timeout', '0', '--seen', batch);
  r.ok('post', '--as', 'd', '--to', 'a1', '--type', 'NOTE', '--body', 'while nobody watched');
  const third = w.watch('--quiet', '0', '--progress', '60000', '--stale', '200');
  assert.ok(await until(() => w.count() === 2));
  assert.ok(JSON.parse(r.ok('status', '--json').out).members.find((m) => m.id === 'a1').wake);
  assert.match(r.ok('status').out, /watcher: alive/);
  third.child.kill();
  await third.closed;
});

test('watch ends by itself when the run closes', async () => {
  const r = makeRun();
  codexMember(r);
  const w = fakeWake(r);
  const watcher = w.watch();
  await pause(150);
  r.ok('close', '--as', 'd', '--status', 'abandoned', '--reason', 'done');
  assert.equal(await watcher.closed, 0);
  assert.match(watcher.out(), /run closed: abandoned/);
  assert.ok(!existsSync(join(r.run, '.state', 'watch.json')));
});

test('exec says whether the directory holds the revision, including untracked files, and a verdict on another tree is flagged', () => {
  const r = makeRun();
  writeFileSync(join(r.root, 'new.txt'), 'untracked in the snapshot\n');
  r.review('step1');
  const same = r.ok('exec', '--as', 'a1', '--item', 'step1', '--rev', '1', '--', 'true');
  assert.match(same.out, /this directory holds step1@r1\n/);

  rmSync(join(r.root, 'new.txt'));
  assert.match(r.ok('exec', '--as', 'a1', '--item', 'step1', '--rev', '1', '--', 'true').out, /does NOT hold step1@r1; changed or missing: new\.txt/);
  writeFileSync(join(r.root, 'new.txt'), 'untracked in the snapshot\n');
  writeFileSync(join(r.root, 'app.txt'), 'moved on\n');
  const moved = r.ok('exec', '--as', 'a1', '--item', 'step1', '--rev', '1', '--', 'true');
  assert.match(moved.out, /does NOT hold step1@r1/);
  const id = /exec: (\S+)/.exec(moved.out)[1];
  const res = r.ok('post', '--as', 'a1', '--type', 'OK', '--item', 'step1', '--rev', '1', '--held', 'executed', '--evidence', id, '--body', 'ran it');
  assert.match(res.out, /did not hold step1@r1/);
  assert.ok(!r.events().some((e) => e.type === 'EXEC' && e.meta.tree === 'unknown'));
  assert.deepEqual(r.events().filter((e) => e.type === 'EXEC').pop().meta.treeFiles, ['app.txt']);
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', '.team'], { cwd: r.root, encoding: 'utf8' }), '');
});

test('exec keeps the words of a command that the caller already split', () => {
  const r = makeRun();
  const res = r.ok('exec', '--as', 'a1', '--', 'printf', '%s', 'a b; echo no');
  assert.match(res.out, /a b; echo no/);
  assert.equal(r.events().filter((e) => e.type === 'EXEC').pop().meta.exit, 0);
});

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the protocol stays under its 15 KB ceiling', { skip: !existsSync(join(PLUGIN, 'references', 'protocol.md')) }, () => {
  assert.ok(statSync(join(PLUGIN, 'references', 'protocol.md')).size <= 15 * 1024);
});

test('every command and flag the role files cite exists', { skip: !existsSync(join(PLUGIN, 'references', 'protocol.md')) }, () => {
  const help = execFileSync(process.execPath, [join(PLUGIN, 'scripts', 'team.mjs'), 'help'], { encoding: 'utf8' });
  const files = [join(PLUGIN, 'references', 'protocol.md'), ...['driver', 'architect', 'tester'].flatMap((n) => [join(PLUGIN, 'references', 'roles', `${n}.md`), join(PLUGIN, 'skills', n, 'SKILL.md')])];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/team\.mjs (?!<)([a-z]+)/g)) assert.match(help, new RegExp(`^  ${m[1]}\\b`, 'm'), `${file}: ${m[0]}`);
    for (const m of text.matchAll(/`[^`\n]*`|^(?:node |```).*$/gm)) {
      for (const flag of m[0].matchAll(/(?<![\w-])--([a-z][a-z-]+)/g)) assert.ok(help.includes(`--${flag[1]}`), `${file}: --${flag[1]}`);
    }
  }
});

test('a run carries its own protocol, roles and profiles, and join refuses a profile that does not exist', { skip: !existsSync(join(PLUGIN, 'references', 'protocol.md')) }, () => {
  const r = makeRun();
  for (const f of ['PROTOCOL.md', 'roles/driver.md', 'roles/architect.md', 'roles/tester.md', 'profiles/project.md']) {
    assert.ok(existsSync(join(r.run, f)), f);
  }
  const bad = r.team('join', '--role', 'architect', '--profile', 'code-qualty');
  assert.equal(bad.code, 2);
  assert.match(bad.err, /available: .*code-quality/);
  r.ok('join', '--role', 'architect', '--profile', 'code-quality,project');
});
