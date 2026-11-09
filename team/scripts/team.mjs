#!/usr/bin/env node

// team.mjs — one run of a driver, architects and testers, kept in plain files.
//
// Sessions from any CLI with a shell take part, so nothing here relies on a
// feature of one vendor's tool: the only channel is the run directory, and this
// script is the only writer of its log. It owns what instructions alone failed to
// keep true in the runs this design came from: who is on the team, whether a
// message reached anybody, which verdict belongs to which revision, and whether
// anything obligatory was left unreviewed at the end.
//
// Zero dependencies, Node 18+. `start` copies this file into the run, so a run
// keeps the version it started with and a session needs only an absolute path.
//
// events.jsonl is the single source of truth. chat.md, team.md and plan.md are
// views rebuilt from it, which is why a verdict quoted inside a message can never
// open a gate: gates read typed events, never prose.
//
// The operations are listed by `team.mjs help`; usage() is the one place they are
// spelled out.

import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync, closeSync, copyFileSync, cpSync, existsSync, fsyncSync, ftruncateSync,
  mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

const EXIT = { ok: 0, fail: 1, usage: 2, timeout: 3, closed: 4, refused: 5, corrupt: 7 };

const MESSAGE_TYPES = ['NOTE', 'REVIEW', 'OK', 'FIX', 'DECISION'];
const ROLE_PREFIX = { driver: 'd', architect: 'a', tester: 't' };
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ITEM_NAME = /^[a-z0-9][a-z0-9-]*$/;

// The lock is held for milliseconds, so anything older belongs to a process that
// died holding it. Age rather than a PID check: a sandboxed CLI can run in its own
// PID namespace, where a live holder looks dead and its lock would be stolen.
const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 30_000;

// git commit-tree needs an identity and a sandbox or a fresh machine may have
// none. A snapshot is not authored by anybody in the git sense; the event says who.
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'team', GIT_AUTHOR_EMAIL: 'team@localhost',
  GIT_COMMITTER_NAME: 'team', GIT_COMMITTER_EMAIL: 'team@localhost',
};

class Failure extends Error {
  constructor(message, code = EXIT.fail) { super(message); this.code = code; }
}
const fail = (message, code = EXIT.fail) => { throw new Failure(message, code); };

function usage() {
  return `team.mjs — a run of driver, architects and testers on one event log

Anywhere in a repository:
  start <task> [--mode standard|lite] [--runtime <cli>] [--parallel]   create a run, join as driver d
  runs [--json]                                                        runs of this repository
  doctor [--json]                                                      what this session can write

In a run (call the copy in .team/<run>/team.mjs, or pass --run <dir>):
  join --role architect|tester [--runtime <cli>] [--profile a,b] [--scope "..."] [--rejoin <id>]
       [--wake none|codex-queue] [--thread <session>]
  plan submit --as d --items items.json [--draft plan-draft.md] [--affects a1,t1]
  snap --as <id> --item <name> [--for <author>]                        snapshot the tree, next revision
  snap --as <id> --item report --file <md> [--correction-of <id>]      a new revision of the report
  post --as <id> --type NOTE|REVIEW|OK|FIX|DECISION (--body <t>|--file <p>|--stdin)
       [--to a1,t1|all] [--item <name>] [--rev <n>] [--seen <batch>] [--op <id>] [--tag authorised|declined]
       [--held executed|inspected|not-run] [--evidence <exec ids>]     required on OK and FIX
  exec --as <id> [--item <name> --rev <n>] [--in <dir>] [--timeout <s>] -- <command>   run a check and record it
  wait --as <id> [--timeout <seconds>] [--seen <batch>] [--poll <ms>] [--soft-timeout]
                                                                       exit 0 messages, 3 timeout, 4 closed
  watch [--poll <ms>] [--quiet <ms>] [--max-delay <ms>] [--progress <ms>] [--retry <ms>] [--attempts <n>] [--stale <ms>]
                                                                       wake members who cannot wait cheaply
  log [--since <n>] [--tag <t>]                                        read history; confirms nothing
  gates [--json]                                                       what is approved and what is missing
  status [--as <id> --doing "..."] [--json]                            facts about delivery and contact
  close --as <id> --status complete|partial|abandoned [--reason "..."]
  rebuild                                                              regenerate the views from the log
  gc [--older-than <days>] [--dry-run]                                 remove refs of closed runs, keep the logs

Exit codes: 0 ok, 1 failure, 2 usage, 3 wait timed out, 4 run closed, 5 refused, 7 corrupt log.`;
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { flags.command = shellCommand(argv.slice(i + 1)); break; }
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else { flags[key] = next; i++; }
  }
  return { positional, flags };
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const list = (value) => (typeof value === 'string' ? value.split(',').map((x) => x.trim()).filter(Boolean) : []);
const uniq = (values) => [...new Set(values)];
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const clock = (ts) => new Date(ts).toTimeString().slice(0, 8);

// One argument is a shell command as written; several are words the caller's shell has
// already split, so they are quoted back rather than joined into a different command.
function shellCommand(words) {
  if (words.length < 2) return words[0] ?? '';
  return words.map((w) => (/^[\w@%+=:,./-]+$/.test(w) ? w : `'${w.replaceAll("'", `'\\''`)}'`)).join(' ');
}

function git(args, { cwd, env, allowFail = false } = {}) {
  const res = spawnSync('git', args, {
    cwd, encoding: 'utf8', env: { ...process.env, ...GIT_IDENTITY, ...env }, maxBuffer: 64 * 1024 * 1024,
  });
  const ok = res.status === 0;
  if (!ok && !allowFail) throw new Failure(`git ${args[0]}: ${(res.stderr || '').trim()} [${describeSpawn(res)}]`);
  return { ok, out: (res.stdout || '').trim(), err: (res.stderr || '').trim(), spawn: describeSpawn(res) };
}

// A sandbox can report status 0 with correct output and an EPERM in `error` at once.
// A single field would misread that, so every field is kept and none is interpreted.
function describeSpawn(res) {
  return `status=${res.status} signal=${res.signal ?? 'none'} error=${res.error?.code ?? 'none'}`;
}

function repoTop(cwd = process.cwd()) {
  const res = git(['rev-parse', '--show-toplevel'], { cwd, allowFail: true });
  return res.ok ? res.out : null;
}

function commonDir(cwd) {
  const res = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, allowFail: true });
  return res.ok ? res.out : null;
}

// ---------------------------------------------------------------- the log

const paths = (run) => ({
  run,
  log: join(run, 'events.jsonl'),
  state: join(run, '.state'),
  lock: join(run, '.state', 'lock'),
  plans: join(run, 'plans'),
  chat: join(run, 'chat.md'),
  team: join(run, 'team.md'),
  plan: join(run, 'plan.md'),
});

// Only a line ending in a newline exists. A write interrupted halfway leaves a tail
// that readers skip and the next writer repairs, so a reader never acts on half a
// record and never has to wait for the writer.
function parseLog(raw, file) {
  const end = raw.lastIndexOf('\n');
  const body = end === -1 ? '' : raw.slice(0, end);
  const events = [];
  if (body) {
    body.split('\n').forEach((line, index) => {
      let event;
      try { event = JSON.parse(line); } catch {
        fail(`${file}: line ${index + 1} is not valid JSON; the log needs a person, nothing was written`, EXIT.corrupt);
      }
      event.seq = index + 1;
      events.push(event);
    });
  }
  return { events, tail: end === raw.length - 1 ? '' : raw.slice(end + 1), tailOffset: Buffer.byteLength(raw.slice(0, end + 1)) };
}

function readEvents(run) {
  const { log } = paths(run);
  if (!existsSync(log)) fail(`no run at ${run}`);
  return parseLog(readFileSync(log, 'utf8'), log).events;
}

function writeAll(fd, data) {
  const buffer = Buffer.from(data);
  let offset = 0;
  while (offset < buffer.length) offset += writeSync(fd, buffer, offset);
}

function appendLine(log, event) {
  const { seq, ...stored } = event;
  const fd = openSync(log, 'a');
  try {
    writeAll(fd, `${JSON.stringify(stored)}\n`);
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

// The check and the append have to be one step. O_APPEND alone makes a write land at
// the end of the file, but "read the verdicts, decide, then write complete" is three
// steps, and a new revision between the second and the third would close the run on
// approvals that no longer stand.
function withLock(run, fn) {
  const p = paths(run);
  const token = randomUUID();
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      mkdirSync(p.lock);
      writeFileSync(join(p.lock, 'owner'), token);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(p.lock).mtimeMs > LOCK_STALE_MS) {
          // Rename is atomic, so of several processes seeing the same dead lock one wins.
          const grave = `${p.lock}.stale.${process.pid}.${token}`;
          renameSync(p.lock, grave);
          rmSync(grave, { recursive: true, force: true });
          continue;
        }
      } catch (raced) { if (raced.code !== 'ENOENT') throw raced; }
      if (Date.now() > deadline) fail(`could not take the lock ${p.lock} within ${LOCK_WAIT_MS / 1000} s`);
      sleep(10 + Math.floor(Math.random() * 15));
    }
  }
  try {
    const events = loadForWrite(run);
    const tx = {
      events,
      append(event) {
        // A holder stalled past the age limit has lost the lock to somebody else.
        let holder = null;
        try { holder = readFileSync(join(p.lock, 'owner'), 'utf8'); } catch { /* gone counts as lost */ }
        if (holder !== token) fail('lost the lock while writing; retry the command');
        const complete = { id: randomUUID(), ts: new Date().toISOString(), to: [], ...event };
        appendLine(p.log, complete);
        complete.seq = events.length + 1;
        events.push(complete);
        tx.dirty = true;
        return complete;
      },
      dirty: false,
    };
    const result = fn(tx);
    if (tx.dirty) renderViews(run, events);
    return result;
  } finally {
    try {
      if (readFileSync(join(p.lock, 'owner'), 'utf8') === token) rmSync(p.lock, { recursive: true, force: true });
    } catch { /* already taken over */ }
  }
}

// Repairs a torn tail under the lock, so no two writers can do it at once. The caller
// of the interrupted write never saw a success, and its retry carries the same op.
function loadForWrite(run) {
  const p = paths(run);
  const raw = readFileSync(p.log, 'utf8');
  const parsed = parseLog(raw, p.log);
  if (parsed.tail) {
    const kept = join(p.state, `torn-${Date.now()}.txt`);
    writeFileSync(kept, parsed.tail);
    const fd = openSync(p.log, 'r+');
    try { ftruncateSync(fd, parsed.tailOffset); fsyncSync(fd); } finally { closeSync(fd); }
    const repair = {
      id: randomUUID(), ts: new Date().toISOString(), from: 'system', to: [], type: 'REPAIR',
      body: `Removed an incomplete record of ${Buffer.byteLength(parsed.tail)} bytes, kept in ${basename(kept)}.`,
    };
    appendLine(p.log, repair);
    repair.seq = parsed.events.length + 1;
    parsed.events.push(repair);
  }
  return parsed.events;
}

function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

// ---------------------------------------------------------------- reading the state

function reduce(events) {
  const state = {
    start: null, closed: null, members: new Map(), plans: [], items: [],
    snaps: new Map(), reviews: new Map(), verdicts: [], execs: new Map(),
  };
  for (const e of events) {
    switch (e.type) {
      case 'START': state.start = e; break;
      case 'JOIN': state.members.set(e.from, { id: e.from, seq: e.seq, ts: e.ts, ...e.meta }); break;
      case 'PLAN': state.plans.push(e); state.items = e.meta.items; break;
      case 'SNAP':
        if (!state.snaps.has(e.item)) state.snaps.set(e.item, []);
        state.snaps.get(e.item).push(e);
        break;
      case 'REVIEW': {
        const key = `${e.item}@${e.rev}`;
        if (!state.reviews.has(key)) state.reviews.set(key, e);
        break;
      }
      case 'OK': case 'FIX': state.verdicts.push(e); break;
      case 'EXEC': state.execs.set(e.meta.exec, e); break;
      case 'CLOSE': state.closed = e; break;
      default:
    }
  }
  return state;
}

const lastOf = (values) => values[values.length - 1];
const reviewerIds = (state) => [...state.members.values()].filter((m) => m.role !== 'driver').map((m) => m.id);
const driverId = (state) => [...state.members.values()].find((m) => m.role === 'driver')?.id;

function currentRev(state, name) {
  if (name === 'plan') return lastOf(state.plans)?.rev ?? null;
  return lastOf(state.snaps.get(name) ?? [])?.rev ?? null;
}

function shaOf(state, name, rev) {
  if (name === 'plan') return state.plans.find((p) => p.rev === rev)?.sha ?? null;
  return (state.snaps.get(name) ?? []).find((s) => s.rev === rev)?.sha ?? null;
}

function itemOf(state, name) {
  if (name === 'plan') {
    return { name: 'plan', author: driverId(state), required: uniq(state.plans.flatMap((p) => p.meta.affected)) };
  }
  return state.items.find((i) => i.name === name);
}

// A code snapshot holds the whole tree, so `final` rests on every other item, and
// the report describes `final`. The report rests on the code and not the reverse:
// correcting a sentence must not cost anybody a second look at unchanged code.
function dependencies(items, name) {
  const byName = new Map(items.map((i) => [i.name, i]));
  const direct = (n) => {
    if (n === 'final') return items.map((i) => i.name).filter((x) => x !== 'final' && x !== 'report');
    if (n === 'report') return uniq([...(byName.get(n)?.depends ?? []), ...(byName.has('final') ? ['final'] : [])]);
    return byName.get(n)?.depends ?? [];
  };
  const seen = new Set();
  const walk = (n) => {
    for (const dep of direct(n)) {
      if (!seen.has(dep)) { seen.add(dep); walk(dep); }
    }
  };
  walk(name);
  return { all: [...seen], direct };
}

// The revision a reviewer has to have approved at the least. Usually the current one.
// A plan revision asks only those it affects, and a report correction only the member
// whose line changed, so an older OK from everybody else still stands.
function neededRev(state, name, reviewer) {
  if (name === 'plan') {
    const touching = state.plans.filter((p) => p.meta.affected.includes(reviewer));
    return lastOf(touching)?.rev ?? null;
  }
  const snaps = state.snaps.get(name) ?? [];
  const asked = snaps.filter((s) => !s.meta?.correction_of || s.meta.correction_of === reviewer);
  return lastOf(asked)?.rev ?? lastOf(snaps)?.rev ?? null;
}

function evaluate(state, name) {
  const item = itemOf(state, name);
  const rev = currentRev(state, name);
  const row = { item: name, author: item?.author, rev, sha: rev ? shaOf(state, name, rev) : null, reviewers: {}, held: {}, warnings: [], problems: [] };
  if (rev === null) {
    row.problems.push(name === 'plan' ? 'no plan submitted' : 'no snapshot and no review request yet');
    for (const reviewer of item?.required ?? []) row.reviewers[reviewer] = 'missing';
    row.open = true;
    return row;
  }
  if (!state.reviews.has(`${name}@${rev}`)) row.problems.push(`r${rev} was never sent for review`);
  const deps = dependencies(state.items, name).all;
  for (const reviewer of item.required) {
    const need = neededRev(state, name, reviewer);
    const mine = state.verdicts.filter((v) => v.item === name && v.from === reviewer);
    const standing = mine.filter((v) => v.rev >= need && v.rev <= rev);
    const last = lastOf(standing);
    if (!last) {
      const older = lastOf(mine);
      const reason = older
        ? `${reviewer}: ${older.type} is on r${older.rev}, r${need} is needed`
        : `${reviewer}: no verdict on r${need}`;
      row.reviewers[reviewer] = older ? 'late' : 'missing';
      row.problems.push(reason);
    } else if (last.type === 'FIX') {
      row.reviewers[reviewer] = 'fix';
      row.problems.push(`${reviewer}: FIX #${last.seq} on r${last.rev} is open`);
    } else {
      // Against the snapshot reviewed, not the moment of the verdict: an OK sent after a
      // dependency moved is still an OK on a tree that does not contain that change.
      const reviewed = (state.snaps.get(name) ?? []).find((s) => s.rev === last.rev);
      const moved = deps
        .map((dep) => ({ dep, snap: lastOf(state.snaps.get(dep) ?? []) }))
        .find(({ snap }) => snap && snap.seq > (reviewed?.seq ?? last.seq));
      if (moved) {
        row.reviewers[reviewer] = 'stale';
        row.problems.push(`${reviewer}: OK #${last.seq} lapsed, r${last.rev} was captured before ${moved.dep}@r${moved.snap.rev}`);
      } else {
        row.reviewers[reviewer] = 'ok';
        row.held[reviewer] = last.meta?.held ?? 'unstated';
        if (last.meta?.contradiction) row.warnings.push(`${reviewer}: OK #${last.seq} cites a run with ${last.meta.contradiction}`);
      }
    }
  }
  row.open = row.problems.length > 0;
  return row;
}

function computeGates(state) {
  const names = state.plans.length ? ['plan', ...state.items.map((i) => i.name)] : ['plan'];
  return names.map((name) => evaluate(state, name));
}

function addressedTo(events, member) {
  return events.filter((e) => e.to?.includes(member) && e.from !== member);
}

function memberFiles(run, member) {
  const { state } = paths(run);
  return {
    cursor: join(state, `seen-${member}`),
    delivered: join(state, `delivered-${member}`),
    contact: join(state, `contact-${member}`),
    waiting: join(state, `waiting-${member}`),
    doing: join(state, `doing-${member}`),
  };
}

const readNumber = (file) => (existsSync(file) ? Number(readFileSync(file, 'utf8')) || 0 : 0);

function touchContact(run, member) {
  const { contact } = memberFiles(run, member);
  const now = new Date();
  try { utimesSync(contact, now, now); } catch { writeFileSync(contact, ''); }
}

function unread(run, events, member) {
  const seen = readNumber(memberFiles(run, member).cursor);
  return addressedTo(events, member).filter((e) => e.seq > seen);
}

// A batch names the last entry it carried. Acknowledging moves the cursor to it and
// repeating that changes nothing. Only an explicit acknowledgement moves it, so a wait
// killed after printing, or one left running by a session that has gone, cannot lose
// anything: the next wait delivers the same entries again and the ids show the repeat.
function acknowledge(run, member, batch) {
  if (batch === undefined || batch === true) return;
  const match = /^batch-(\d+)$/.exec(batch);
  if (!match) fail(`--seen expects a batch id such as batch-42, got "${batch}"`, EXIT.usage);
  const last = Number(match[1]);
  const files = memberFiles(run, member);
  const delivered = readNumber(files.delivered);
  if (last > delivered) fail(`${batch} was never delivered to ${member}; the last one delivered is batch-${delivered}. Nothing was posted.`, EXIT.usage);
  if (last > readNumber(files.cursor)) atomicWrite(files.cursor, String(last));
}

// ---------------------------------------------------------------- views

function header(e) {
  const to = e.to?.length ? ` → ${e.to.join(',')}` : '';
  const item = e.item ? ` ${e.item}${e.rev ? `@r${e.rev}` : ''}` : '';
  const sha = e.sha ? ` ${String(e.sha).slice(0, 12)}` : '';
  const tag = e.meta?.tag ? ` [${e.meta.tag}]` : '';
  return `--- #${e.seq} ${clock(e.ts)} ${e.from}${to} ${e.type}${item}${sha}${tag}`;
}

const entry = (e) => `${header(e)} (${e.id})\n${e.body ?? ''}\n`;

function renderChat(events) {
  return events.map((e) => `${header(e)}\n${e.body ?? ''}\n`).join('\n');
}

function renderTeam(run, state) {
  const start = state.start;
  const rows = [...state.members.values()].map((m) => {
    const can = [m.caps ? `snap=${m.caps.snap ? 'yes' : 'no'}` : '', m.wake ? `wake=${m.wake.type}` : ''].filter(Boolean).join(' ');
    return `| ${m.id} | ${m.role} | ${m.runtime ?? ''} | ${[m.profile, m.scope].filter(Boolean).join(' ')} | ${clock(m.ts)} | ${can} |`;
  });
  return [
    `# Team: ${basename(run)}`,
    '',
    `status: ${state.closed ? state.closed.meta.status : 'active'} | mode: ${start?.meta.mode ?? ''} | repo: ${start?.meta.repo ?? ''}`,
    `task: ${start?.meta.task ?? ''}`,
    '',
    '| id | role | runtime | profile / scope | joined | can |',
    '|----|------|---------|-----------------|--------|-----|',
    ...rows,
    '',
    'Generated from events.jsonl. Do not edit.',
    '',
  ].join('\n');
}

function renderPlan(run, state, events) {
  const plan = lastOf(state.plans);
  if (!plan) return `# ${basename(run)}\n\nNo plan submitted yet.\n`;
  const text = readFileSync(join(paths(run).plans, `plan-r${plan.rev}.md`), 'utf8');
  const tagged = (tag) => events.filter((e) => e.type === 'DECISION' && (e.meta?.tag ?? null) === tag);
  const section = (title, entries) => (entries.length
    ? [`## ${title}`, '', ...entries.map((e) => `- #${e.seq} ${e.from}: ${e.body.trim().split('\n').join(' ')}`), '']
    : []);
  return [
    `<!-- plan r${plan.rev}, generated from events.jsonl; edit plan-draft.md and run plan submit -->`,
    text.trimEnd(),
    '',
    `## Items (r${plan.rev})`,
    '',
    '| item | author | required | depends |',
    '|------|--------|----------|---------|',
    ...state.items.map((i) => `| ${i.name} | ${i.author} | ${i.required.join(', ')} | ${(i.depends ?? []).join(', ')} |`),
    '',
    ...section('Authorised by the user', tagged('authorised')),
    ...section('Declined', tagged('declined')),
    ...section('Decisions', tagged(null)),
  ].join('\n');
}

function renderViews(run, events) {
  const p = paths(run);
  const state = reduce(events);
  atomicWrite(p.chat, renderChat(events));
  atomicWrite(p.team, renderTeam(run, state));
  atomicWrite(p.plan, renderPlan(run, state, events));
}

// ---------------------------------------------------------------- git

function probeRefs(top) {
  const tree = git(['hash-object', '-w', '-t', 'tree', '/dev/null'], { cwd: top, allowFail: true });
  if (!tree.ok) return false;
  const commit = git(['commit-tree', tree.out, '-m', 'team probe'], { cwd: top, allowFail: true });
  if (!commit.ok) return false;
  const ref = `refs/team/probe-${process.pid}-${randomUUID().slice(0, 8)}`;
  if (!git(['update-ref', ref, commit.out], { cwd: top, allowFail: true }).ok) return false;
  git(['update-ref', '-d', ref], { cwd: top, allowFail: true });
  return true;
}

function capabilities(top) {
  const major = Number(process.versions.node.split('.')[0]);
  let write = false;
  const dir = join(top, '.team');
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.probe-${process.pid}`);
    writeFileSync(probe, '');
    rmSync(probe);
    write = true;
  } catch { /* reported below */ }
  return { node: major >= 18, nodeVersion: process.versions.node, write, snap: probeRefs(top) };
}

// Keeps the team's files out of `git status` and out of every snapshot without a
// write to .git, which a sandboxed CLI may not be allowed.
function ensureTeamDir(top) {
  const dir = join(top, '.team');
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  return dir;
}

// Same recipe as pair's snap.sh: start the temporary index from HEAD so tracked files
// matching .gitignore are not silently dropped, then add the tree. The real index and
// `git status` are never touched.
function snapshotTree(worktree, run, message) {
  const index = join(paths(run).state, `index-${process.pid}-${randomUUID().slice(0, 8)}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    const head = git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: worktree, allowFail: true });
    if (head.ok) git(['read-tree', head.out], { cwd: worktree, env });
    git(['add', '-A'], { cwd: worktree, env });
    const tree = git(['write-tree'], { cwd: worktree, env }).out;
    const parent = head.ok ? ['-p', head.out] : [];
    const sha = git(['commit-tree', tree, ...parent, '-m', message], { cwd: worktree, env }).out;
    return { sha, tree };
  } finally {
    rmSync(index, { force: true });
    rmSync(`${index}.lock`, { force: true });
  }
}

// A tester in a worktree snapshots its own tree; a session whose directory belongs to
// another repository snapshots the run's repository.
function worktreeFor(state) {
  const repo = state.start.meta.repo;
  const here = repoTop();
  if (here && commonDir(here) === commonDir(repo)) return here;
  return repo;
}

// ---------------------------------------------------------------- locating a run

function isActive(run) {
  try { return !reduce(readEvents(run)).closed; } catch { return false; }
}

function runsIn(top) {
  const dir = join(top, '.team');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => existsSync(join(p, 'events.jsonl')))
    .sort();
}

function resolveRun(flags) {
  if (typeof flags.run === 'string') return resolve(flags.run);
  if (process.env.TEAM_RUN) return resolve(process.env.TEAM_RUN);
  const beside = dirname(SELF);
  if (existsSync(join(beside, 'events.jsonl'))) return beside;
  const top = repoTop();
  const active = top ? runsIn(top).filter(isActive) : [];
  if (active.length === 1) return active[0];
  if (active.length > 1) fail(`several active runs here, pass --run:\n${active.join('\n')}`, EXIT.usage);
  return fail('no active run here; start one, or pass --run <absolute path>', EXIT.usage);
}

function requireMember(state, flags) {
  const id = flags.as;
  if (typeof id !== 'string') fail('--as <member id> is required', EXIT.usage);
  if (!state.members.has(id)) fail(`"${id}" is not a member of this run`, EXIT.usage);
  return state.members.get(id);
}

function requireOpen(state) {
  if (state.closed) fail(`the run is closed: ${state.closed.meta.status}`, EXIT.closed);
}

function bodyFrom(flags) {
  if (typeof flags.body === 'string') return flags.body;
  if (typeof flags.file === 'string') return readFileSync(flags.file, 'utf8');
  if (flags.stdin) return readFileSync(0, 'utf8');
  return fail('give the text with --body, --file or --stdin', EXIT.usage);
}

function unreadLine(run, events, member) {
  const count = unread(run, events, member).length;
  return count ? `unread: ${count}; read them with: wait --as ${member} --timeout 0` : 'unread: 0';
}

// ---------------------------------------------------------------- operations

function cmdStart({ positional, flags }) {
  const task = positional[1];
  if (!task || !NAME.test(task)) fail('start needs a task name (letters, digits, . _ -)', EXIT.usage);
  const mode = typeof flags.mode === 'string' ? flags.mode : 'standard';
  if (!['standard', 'lite'].includes(mode)) fail(`unknown mode "${mode}"`, EXIT.usage);
  const top = repoTop();
  if (!top) fail('start has to run inside a git repository', EXIT.usage);
  const caps = capabilities(top);
  if (!caps.node) fail(`Node ${caps.nodeVersion} is too old, 18 or newer is needed`);
  if (!caps.write) fail(`cannot write to ${join(top, '.team')}`);

  // Two runs on one working tree commit over each other, whatever their tasks are called.
  const active = runsIn(top).filter(isActive);
  if (active.length && !flags.parallel) {
    fail(`an active run already works in this repository:\n${active.join('\n')}\nClose it, or pass --parallel if the two really do not touch one tree.`, EXIT.refused);
  }

  const teamDir = ensureTeamDir(top);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  let name = `${task}-${stamp}`;
  for (let n = 2; existsSync(join(teamDir, name)); n++) name = `${task}-${stamp}-${n}`;
  const run = join(teamDir, name);
  const p = paths(run);
  mkdirSync(p.state, { recursive: true });
  mkdirSync(p.plans);
  mkdirSync(join(run, 'artifacts'));

  const beside = dirname(SELF);
  copyFileSync(SELF, join(run, 'team.mjs'));
  const references = join(beside, '..', 'references');
  if (existsSync(join(references, 'protocol.md'))) copyFileSync(join(references, 'protocol.md'), join(run, 'PROTOCOL.md'));
  for (const dir of ['roles', 'profiles']) {
    if (existsSync(join(references, dir))) cpSync(join(references, dir), join(run, dir), { recursive: true });
  }
  writeFileSync(p.log, '');

  const head = git(['rev-parse', '--short', 'HEAD'], { cwd: top, allowFail: true });
  const dirty = git(['status', '--short'], { cwd: top, allowFail: true });
  let baseline = null;
  if (caps.snap) {
    const snap = snapshotTree(top, run, `team snapshot ${name}/baseline`);
    git(['update-ref', `refs/team/${name}/baseline`, snap.sha], { cwd: top });
    baseline = snap;
  }

  const driver = withLock(run, (tx) => {
    tx.append({
      from: 'system', type: 'START',
      body: `Run ${name} started for ${task}.`,
      meta: { task, mode, repo: top, head: head.ok ? head.out : null, dirty: dirty.out, baseline: baseline?.sha ?? null },
    });
    if (baseline) {
      tx.append({
        from: 'system', type: 'SNAP', item: 'baseline', rev: 0, sha: baseline.sha,
        ref: `refs/team/${name}/baseline`, body: 'Baseline before the first edit.', meta: { tree: baseline.tree },
      });
    }
    return tx.append({
      from: 'd', type: 'JOIN', body: 'd joined as driver.',
      meta: { role: 'driver', runtime: typeof flags.runtime === 'string' ? flags.runtime : null, caps },
    });
  });

  const script = join(run, 'team.mjs');
  console.log(`run: ${run}`);
  console.log(`you are: ${driver.from} (driver)`);
  if (baseline) console.log(`baseline: refs/team/${name}/baseline ${baseline.sha.slice(0, 12)}`);
  else console.log('warning: this session cannot write git refs, so there is no baseline; run doctor');
  if (dirty.out) console.log(`already modified, these belong to the user:\n${dirty.out}`);
  console.log('\nPaste into each other session:\n');
  for (const role of ['architect', 'tester']) {
    console.log(`${role}:\n  You are ${/^a/.test(role) ? 'an' : 'a'} ${role} in this team. Read ${join(run, 'roles', `${role}.md`)} and follow it.`);
    console.log(`  Join with: node ${script} join --role ${role} --runtime <your CLI>\n`);
  }
  console.log(`If a member's row in team.md shows wake=, run this in the background from outside any sandbox: node ${script} watch`);
}

function cmdRuns({ flags }) {
  const top = repoTop();
  if (!top) fail('not inside a git repository', EXIT.usage);
  const rows = runsIn(top).map((run) => {
    const closed = reduce(readEvents(run)).closed;
    return { run, status: closed ? closed.meta.status : 'active' };
  });
  if (flags.json) console.log(JSON.stringify(rows, null, 2));
  else for (const row of rows) console.log(`${row.status}\t${row.run}`);
}

function cmdDoctor({ flags }) {
  const top = repoTop();
  if (!top) fail('not inside a git repository', EXIT.usage);
  const caps = capabilities(top);
  if (flags.json) { console.log(JSON.stringify({ top, ...caps }, null, 2)); return; }
  console.log(`repository: ${top}`);
  console.log(`node ${caps.nodeVersion}: ${caps.node ? 'ok' : 'too old'}`);
  console.log(`write to .team: ${caps.write ? 'yes' : 'NO'}`);
  console.log(`write git refs: ${caps.snap ? 'yes' : 'no, the driver has to take snapshots for this session (snap --for)'}`);
}

function cmdJoin({ flags }) {
  const run = resolveRun(flags);
  const role = flags.role;
  if (!['architect', 'tester'].includes(role)) fail('--role architect|tester; the driver joins through start', EXIT.usage);
  const top = reduce(readEvents(run)).start.meta.repo;
  const caps = capabilities(top);
  const member = withLock(run, (tx) => {
    const state = reduce(tx.events);
    requireOpen(state);
    const meta = {
      role,
      runtime: typeof flags.runtime === 'string' ? flags.runtime : null,
      profile: knownProfiles(run, flags.profile),
      scope: typeof flags.scope === 'string' ? flags.scope : null,
      caps,
      wake: wakeBinding(flags),
    };
    let id = flags.rejoin;
    if (typeof id === 'string') {
      const held = state.members.get(id);
      if (!held || held.role !== role) fail(`${id} is not a ${role} of this run`, EXIT.usage);
      meta.rejoined = true;
    } else {
      let n = 1;
      while (state.members.has(`${ROLE_PREFIX[role]}${n}`)) n++;
      id = `${ROLE_PREFIX[role]}${n}`;
    }
    return tx.append({
      from: id, to: [driverId(state)], type: 'JOIN',
      body: `${id} ${meta.rejoined ? 'rejoined' : 'joined'} as ${role}${meta.runtime ? ` on ${meta.runtime}` : ''}${caps.snap ? '' : ', cannot write git refs'}.`,
      meta,
    });
  });
  touchContact(run, member.from);
  console.log(`you are: ${member.from} (${role})`);
  console.log(`run: ${run}`);
  console.log(`protocol: ${join(run, 'PROTOCOL.md')}`);
  console.log(`role: ${join(run, 'roles', `${role}.md`)}`);
  if (!caps.snap) console.log('this session cannot write git refs: ask the driver for snap --for you');
  if (member.meta.wake) {
    console.log(`woken by: ${member.meta.wake.type}, session ${member.meta.wake.thread}`);
    console.log(`next: read with: node ${join(run, 'team.mjs')} wait --as ${member.from} --timeout 0`);
    console.log('then end your turn. Do not loop on wait: a signal starts your next turn when something arrives.');
  } else {
    console.log(`next: node ${join(run, 'team.mjs')} wait --as ${member.from}`);
  }
}

// A misspelt profile would otherwise join quietly with no priorities at all, and nobody
// would notice that the review weighed nothing it was asked to.
function knownProfiles(run, given) {
  if (typeof given !== 'string') return null;
  const dir = join(run, 'profiles');
  const known = existsSync(dir) ? readdirSync(dir).map((f) => f.replace(/\.md$/, '')) : [];
  for (const name of list(given)) {
    if (!known.includes(name)) fail(`unknown profile "${name}"; available: ${known.join(', ') || 'none'}`, EXIT.usage);
  }
  return given;
}

// The session id comes from the environment, so binding costs the model nothing and
// cannot be mistyped. Nothing about this adapter reaches the protocol: it only decides
// how a session gets told to look at the log.
function wakeBinding(flags) {
  const wanted = typeof flags.wake === 'string' ? flags.wake : null;
  if (wanted === 'none') return null;
  if (wanted && wanted !== 'codex-queue') fail(`unknown --wake "${wanted}"`, EXIT.usage);
  const thread = typeof flags.thread === 'string' ? flags.thread
    : process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID || null;
  if (wanted && !thread) fail('--wake codex-queue needs the session id: pass --thread <uuid>', EXIT.usage);
  return thread ? { type: 'codex-queue', thread } : null;
}

function validateItems(items, state) {
  if (!Array.isArray(items) || !items.length) fail('--items has to hold a non-empty list of items', EXIT.usage);
  const names = new Set();
  for (const item of items) {
    if (!item.name || !ITEM_NAME.test(item.name)) fail(`bad item name "${item.name}" (lower-case letters, digits, -)`, EXIT.usage);
    if (item.name === 'plan' || item.name === 'baseline') fail(`"${item.name}" is reserved`, EXIT.usage);
    if (names.has(item.name)) fail(`item "${item.name}" appears twice`, EXIT.usage);
    names.add(item.name);
    if (!state.members.has(item.author)) fail(`item ${item.name}: author "${item.author}" is not a member`, EXIT.usage);
    if (!Array.isArray(item.required) || !item.required.length) fail(`item ${item.name}: name its required reviewers`, EXIT.usage);
    for (const reviewer of item.required) {
      if (!state.members.has(reviewer)) fail(`item ${item.name}: reviewer "${reviewer}" is not a member`, EXIT.usage);
      if (reviewer === item.author) fail(`item ${item.name}: ${reviewer} cannot review its own work`, EXIT.usage);
    }
  }
  if (!names.has('final')) fail('a plan needs an item named final', EXIT.usage);
  for (const item of items) {
    for (const dep of item.depends ?? []) {
      if (!names.has(dep)) fail(`item ${item.name} depends on unknown item "${dep}"`, EXIT.usage);
      if (dep === 'final' || dep === 'report') fail(`item ${item.name} cannot depend on ${dep}, which comes last`, EXIT.usage);
    }
  }
  const byName = new Map(items.map((i) => [i.name, i]));
  const visiting = new Set();
  const done = new Set();
  const visit = (name, trail) => {
    if (done.has(name)) return;
    if (visiting.has(name)) fail(`dependency cycle: ${[...trail, name].join(' -> ')}`, EXIT.usage);
    visiting.add(name);
    for (const dep of byName.get(name)?.depends ?? []) visit(dep, [...trail, name]);
    visiting.delete(name);
    done.add(name);
  };
  for (const name of names) visit(name, []);
}

const canonicalItems = (items) => items.map((i) => ({
  name: i.name, author: i.author, required: [...i.required].sort(), depends: [...(i.depends ?? [])].sort(),
  ...(i.gated ? { gated: true } : {}), ...(i.scope ? { scope: i.scope } : {}),
}));

function cmdPlan({ positional, flags }) {
  if (positional[1] !== 'submit') fail('plan submit --as d --items items.json [--draft plan-draft.md]', EXIT.usage);
  const run = resolveRun(flags);
  const draftPath = typeof flags.draft === 'string' ? flags.draft : join(run, 'plan-draft.md');
  if (!existsSync(draftPath)) fail(`no plan text at ${draftPath}`, EXIT.usage);
  if (typeof flags.items !== 'string') fail('--items <json file> is required', EXIT.usage);
  const text = readFileSync(draftPath, 'utf8');
  let parsedItems;
  try { parsedItems = JSON.parse(readFileSync(flags.items, 'utf8')); } catch (error) { fail(`--items: ${error.message}`, EXIT.usage); }
  const rawItems = Array.isArray(parsedItems) ? parsedItems : parsedItems.items;
  const p = paths(run);

  const event = withLock(run, (tx) => {
    const state = reduce(tx.events);
    requireOpen(state);
    const member = requireMember(state, flags);
    if (member.role !== 'driver') fail('only the driver submits the plan', EXIT.refused);
    validateItems(rawItems, state);
    const items = canonicalItems(rawItems);
    const sha = sha256(`${text}\0${JSON.stringify(items)}`);
    const previous = lastOf(state.plans);
    if (previous?.sha === sha) return previous;

    // A revision asks those whose items changed. Prose alone can change anybody's
    // scope and the script cannot read it, so a text-only change asks everybody.
    let affected;
    let changed = [];
    const removed = [];
    if (!previous) {
      affected = reviewerIds(state);
    } else {
      const old = new Map(previous.meta.items.map((i) => [i.name, i]));
      const next = new Map(items.map((i) => [i.name, i]));
      const touched = [];
      for (const [name, item] of next) {
        if (JSON.stringify(old.get(name)) !== JSON.stringify(item)) { changed.push(name); touched.push(item); }
        if (old.has(name) && JSON.stringify(old.get(name)) !== JSON.stringify(item)) touched.push(old.get(name));
      }
      for (const [name, item] of old) if (!next.has(name)) { removed.push(name); touched.push(item); }
      affected = touched.length
        ? touched.flatMap((i) => [i.author, ...i.required])
        : reviewerIds(state);
      // Whoever holds an open FIX on the plan has to answer the revision meant to settle it.
      const verdicts = state.verdicts.filter((v) => v.item === 'plan');
      for (const reviewer of reviewerIds(state)) {
        if (lastOf(verdicts.filter((v) => v.from === reviewer))?.type === 'FIX') affected.push(reviewer);
      }
    }
    affected = uniq([...affected, ...list(flags.affects)]).filter((id) => id !== member.id && state.members.has(id));

    const rev = (previous?.rev ?? 0) + 1;
    const file = join(p.plans, `plan-r${rev}.md`);
    writeFileSync(file, text);
    chmodSync(file, 0o444);
    return tx.append({
      from: member.id, type: 'PLAN', item: 'plan', rev, sha,
      body: `Plan r${rev} submitted. Review asked of: ${affected.join(', ') || 'nobody'}.${removed.length ? ` Removed items: ${removed.join(', ')}.` : ''}`,
      meta: { items, affected, changed, removed, file: `plans/plan-r${rev}.md` },
    });
  });
  console.log(`plan@r${event.rev} ${event.sha.slice(0, 12)}; review asked of: ${event.meta.affected.join(', ') || 'nobody'}`);
  console.log(`send it with: post --as d --type REVIEW --item plan --stdin`);
}

function cmdSnap({ flags }) {
  const run = resolveRun(flags);
  const name = flags.item;
  if (typeof name !== 'string') fail('--item <name> is required', EXIT.usage);
  const initial = reduce(readEvents(run));
  requireOpen(initial);
  const by = requireMember(initial, flags);
  const item = initial.items.find((i) => i.name === name);
  if (!item) fail(`item "${name}" is not in the approved plan; add it with a new plan revision`, EXIT.refused);
  const forWhom = typeof flags.for === 'string' ? flags.for : by.id;
  if (forWhom !== item.author) fail(`${name} belongs to ${item.author}; a snapshot for somebody else goes through --for ${item.author}`, EXIT.refused);
  if (by.id !== item.author && by.role !== 'driver') fail('only the driver takes a snapshot for another member', EXIT.refused);

  let content;
  let reportText = null;
  if (name === 'report') {
    if (typeof flags.file !== 'string') fail('the report is a file: snap --item report --file <md>', EXIT.usage);
    reportText = readFileSync(flags.file, 'utf8');
    content = { sha: sha256(reportText), tree: null };
  } else {
    // Outside the lock: `git add -A` can take seconds, and the lock is meant for milliseconds.
    const worktree = worktreeFor(initial);
    try {
      content = snapshotTree(worktree, run, `team snapshot ${basename(run)}/${name}`);
    } catch (error) {
      fail(`cannot snapshot from this session (${error.message}); the driver can take it: snap --as d --item ${name} --for ${item.author}`);
    }
  }
  const correction = typeof flags['correction-of'] === 'string' ? flags['correction-of'] : null;
  if (correction && name !== 'report') fail('--correction-of applies to the report only', EXIT.usage);

  const event = withLock(run, (tx) => {
    const state = reduce(tx.events);
    requireOpen(state);
    if (correction && !state.members.has(correction)) fail(`"${correction}" is not a member`, EXIT.usage);
    const snaps = state.snaps.get(name) ?? [];
    const last = lastOf(snaps);
    // A retry after an uncertain result must not invent a revision nobody has seen.
    if (last && !state.reviews.has(`${name}@${last.rev}`) && (last.meta.tree ?? last.sha) === (content.tree ?? content.sha)) return last;
    const rev = (last?.rev ?? 0) + 1;
    let ref = null;
    if (name === 'report') {
      writeFileSync(join(run, `report-r${rev}.md`), reportText);
    } else {
      ref = `refs/team/${basename(run)}/${name}-r${rev}`;
      const zero = '0000000000000000000000000000000000000000';
      git(['update-ref', ref, content.sha, zero], { cwd: state.start.meta.repo });
    }
    return tx.append({
      from: by.id, type: 'SNAP', item: name, rev, sha: content.sha, ref,
      body: `${name}@r${rev} captured${by.id === item.author ? '' : ` by ${by.id} for ${item.author}`}.`,
      meta: {
        tree: content.tree, author: item.author, snapshot_by: by.id,
        ...(correction ? { correction_of: correction } : {}),
      },
    });
  });
  console.log(`${name}@r${event.rev} ${String(event.sha).slice(0, 12)}${event.ref ? ` ${event.ref}` : ''}`);
}

function cmdPost({ flags }) {
  const run = resolveRun(flags);
  const type = flags.type;
  if (!MESSAGE_TYPES.includes(type)) fail(`--type has to be one of ${MESSAGE_TYPES.join(', ')}`, EXIT.usage);
  const body = bodyFrom(flags);
  if (['REVIEW', 'OK', 'FIX'].includes(type) && !body.trim()) fail(`${type} needs text: what changed, or what was checked and where`, EXIT.usage);
  const tag = typeof flags.tag === 'string' ? flags.tag : null;
  if (tag && !['authorised', 'declined'].includes(tag)) fail(`unknown --tag "${tag}"`, EXIT.usage);
  if (tag && type !== 'DECISION') fail('--tag belongs on a DECISION', EXIT.usage);
  const itemName = typeof flags.item === 'string' ? flags.item : null;
  const seen = typeof flags.seen === 'string' ? flags.seen : null;
  const held = typeof flags.held === 'string' ? flags.held : null;
  const evidence = list(flags.evidence);
  if (['OK', 'FIX'].includes(type)) {
    if (!['executed', 'inspected', 'not-run'].includes(held)) fail(`${type} needs --held executed|inspected|not-run: how this claim is held`, EXIT.usage);
    if (held === 'executed' && !evidence.length) fail('--held executed needs --evidence <exec id>: a run recorded with the exec command', EXIT.usage);
  } else if (held || evidence.length) {
    fail('--held and --evidence belong on OK and FIX', EXIT.usage);
  }

  const result = withLock(run, (tx) => {
    const state = reduce(tx.events);
    requireOpen(state);
    const member = requireMember(state, flags);
    if (tag === 'authorised' && member.role !== 'driver') {
      fail('only the driver records what the user authorised; a message from another session cannot widen it', EXIT.refused);
    }
    if (seen) acknowledge(run, member.id, seen);

    const fields = { rev: null, sha: null, ref: null, meta: {} };
    let defaultTo = [];
    if (['REVIEW', 'OK', 'FIX'].includes(type)) {
      if (!itemName) fail(`${type} needs --item`, EXIT.usage);
      const item = itemOf(state, itemName);
      if (!item) fail(`item "${itemName}" is not in the plan`, EXIT.refused);
      const current = currentRev(state, itemName);
      if (type === 'REVIEW') {
        if (member.id !== item.author) fail(`${itemName} belongs to ${item.author}; only the author asks for its review`, EXIT.refused);
        if (current === null) fail(`${itemName} has no snapshot yet; run snap first`, EXIT.refused);
        fields.rev = current;
        defaultTo = itemName === 'plan' ? lastOf(state.plans).meta.affected : item.required;
        const snap = lastOf(state.snaps.get(itemName) ?? []);
        if (snap?.meta?.correction_of) defaultTo = [snap.meta.correction_of];
      } else {
        if (member.id === item.author) fail(`${itemName} is your own work; somebody else has to review it`, EXIT.refused);
        const rev = Number(flags.rev);
        if (!Number.isInteger(rev) || rev < 1) fail(`${type} needs --rev <n>: the revision actually read`, EXIT.usage);
        if (!state.reviews.has(`${itemName}@${rev}`)) fail(`${itemName}@r${rev} was never sent for review`, EXIT.refused);
        fields.rev = rev;
        // Kept even when it opens nothing: a late or unrequested verdict is often worth reading.
        if (rev < neededRev(state, itemName, member.id)) fields.meta.late = true;
        if (!item.required.includes(member.id)) fields.meta.not_required = true;
        defaultTo = uniq([item.author, driverId(state)]);
        fields.meta.held = held;
        if (evidence.length) fields.meta.evidence = evidence;
        // The script cannot tell whether a run was understood. It can tell whether the
        // run claimed exists, belongs to this revision, and how it actually ended.
        for (const id of evidence) {
          const run_ = state.execs.get(id);
          if (!run_) fail(`no recorded run "${id}"; use the id the exec command printed`, EXIT.refused);
          if (run_.from !== member.id) fail(`run ${id} was recorded by ${run_.from}, not by you`, EXIT.refused);
          if (run_.item !== itemName || run_.rev !== rev) {
            fail(`run ${id} was recorded for ${run_.item ?? 'no item'}@r${run_.rev ?? '-'}, not ${itemName}@r${rev}`, EXIT.refused);
          }
          if (type === 'OK' && !(run_.meta.exit === 0 && !run_.meta.errorCode)) fields.meta.contradiction = describeExec(run_.meta);
          if (run_.meta.tree === 'differs') fields.meta.contradiction = `a directory that did not hold ${itemName}@r${rev}`;
        }
      }
      fields.sha = shaOf(state, itemName, fields.rev);
      fields.ref = (state.snaps.get(itemName) ?? []).find((s) => s.rev === fields.rev)?.ref ?? null;
    }
    if (tag) fields.meta.tag = tag;

    const requested = flags.to === 'all' ? reviewerIds(state).concat(driverId(state)) : list(flags.to);
    const to = uniq(requested.length ? requested : defaultTo).filter((id) => id !== member.id);
    if (!to.length && !['DECISION', 'NOTE'].includes(type)) fail(`nobody to send this ${type} to`, EXIT.refused);
    if ((type === 'NOTE' || type === 'DECISION') && !requested.length) fail(`${type} needs --to <ids> or --to all`, EXIT.usage);
    for (const id of to) if (!state.members.has(id)) fail(`"${id}" is not a member of this run`, EXIT.usage);

    // The default id is derived rather than invented, so a session retrying after an
    // interruption gets the same id without having had to remember anything.
    const op = typeof flags.op === 'string' ? flags.op
      : sha256(JSON.stringify([member.id, type, itemName, fields.rev, to, body, seen]));
    const existing = tx.events.find((e) => e.op === op);
    if (existing) return { event: existing, repeated: true, member };
    const event = tx.append({
      from: member.id, to, type, op,
      ...(itemName ? { item: itemName } : {}),
      ...(fields.rev ? { rev: fields.rev } : {}),
      ...(fields.sha ? { sha: fields.sha } : {}),
      ...(fields.ref ? { ref: fields.ref } : {}),
      body,
      ...(Object.keys(fields.meta).length ? { meta: fields.meta } : {}),
    });
    return { event, repeated: false, member };
  });

  touchContact(run, result.member.id);
  const { event } = result;
  console.log(`${result.repeated ? 'already posted' : 'posted'} #${event.seq} ${event.id}${event.meta?.late ? ' (late: this revision is no longer the one needed, it opens nothing)' : ''}${event.meta?.not_required ? ' (not required of you, it opens nothing)' : ''}`);
  const asleep = (event.to ?? []).filter((id) => currentState(run).members.get(id)?.wake);
  if (asleep.length && !watcherAlive(run)) {
    console.log(`warning: ${asleep.join(', ')} ${asleep.length > 1 ? 'are' : 'is'} woken by a watcher and none is running, so nothing will reach them. Run in the background: node ${join(run, 'team.mjs')} watch`);
  }
  if (event.meta?.contradiction) console.log(`warning: this verdict cites a run with ${event.meta.contradiction}; it is recorded as a contradiction`);
  console.log(unreadLine(run, readEvents(run), result.member.id));
}

function cmdWait({ flags }) {
  const run = resolveRun(flags);
  const initial = reduce(readEvents(run));
  const member = requireMember(initial, flags);
  const timeoutMs = (flags.timeout === undefined ? 540 : Number(flags.timeout)) * 1000;
  const pollMs = flags.poll === undefined ? 500 : Number(flags.poll);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || !Number.isFinite(pollMs) || pollMs < 1) fail('bad --timeout or --poll', EXIT.usage);
  const files = memberFiles(run, member.id);
  if (typeof flags.seen === 'string') withLock(run, () => acknowledge(run, member.id, flags.seen));

  const since = new Date().toISOString();
  const { log } = paths(run);
  const deadline = Date.now() + timeoutMs;
  let lastSize = -1;
  writeFileSync(files.waiting, JSON.stringify({ since, pid: process.pid }));
  try {
    for (;;) {
      touchContact(run, member.id);
      const size = statSync(log).size;
      if (size !== lastSize) {
        lastSize = size;
        const events = readEvents(run);
        const pending = unread(run, events, member.id);
        const closed = reduce(events).closed;
        if (pending.length) {
          const last = pending[pending.length - 1].seq;
          // Recorded before printing: "delivered" means the script handed it over,
          // which is all it can know. Whether anybody read it is what --seen says.
          if (last > readNumber(files.delivered)) atomicWrite(files.delivered, String(last));
          for (const e of pending) console.log(entry(e));
          console.log(`batch: batch-${last}`);
          console.log(`next: acknowledge it by adding --seen batch-${last} to your next post or wait`);
          if (closed) { console.log(`run closed: ${closed.meta.status}`); return EXIT.closed; }
          return EXIT.ok;
        }
        if (closed) { console.log(`run closed: ${closed.meta.status}`); return EXIT.closed; }
      }
      if (Date.now() >= deadline) {
        console.log(`state: idle, no messages; run again: wait --as ${member.id}`);
        // Timing out is the normal case. A tool that shows any non-zero exit as a failure
        // can ask for 0 and read this line instead.
        return flags['soft-timeout'] ? EXIT.ok : EXIT.timeout;
      }
      sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())));
    }
  } finally {
    rmSync(files.waiting, { force: true });
  }
}

const describeExec = (meta) => `exit=${meta.exit} signal=${meta.signal ?? 'none'} error=${meta.errorCode ?? 'none'}`;

// Naming a revision does not make the directory hold it: a check run in a tree that has
// moved on says nothing about the snapshot. The comparison builds a throwaway index and
// object directory under the run, so it needs no write access to .git and sees untracked
// files, which `git diff <ref>` reports as deletions.
//
// A file the snapshot does not have is only reported. A tester's own new test file is
// the normal case, and flagging it would flag nearly every run a tester makes until the
// flag means nothing. A file of the snapshot that changed or went missing is the mismatch.
function treeAgainst(cwd, run, sha) {
  const objects = git(['rev-parse', '--git-path', 'objects'], { cwd, allowFail: true });
  if (!objects.ok) return { state: 'unknown', files: [] };
  const scratch = join(paths(run).state, `tree-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(scratch, 'objects'), { recursive: true });
  const env = {
    GIT_INDEX_FILE: join(scratch, 'index'),
    GIT_OBJECT_DIRECTORY: join(scratch, 'objects'),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: resolve(cwd, objects.out),
  };
  try {
    if (!git(['read-tree', sha], { cwd, env, allowFail: true }).ok) return { state: 'unknown', files: [] };
    if (!git(['add', '-A', ':/'], { cwd, env, allowFail: true }).ok) return { state: 'unknown', files: [] };
    const diff = git(['diff-index', '--cached', '--no-renames', '--name-status', sha], { cwd, env, allowFail: true });
    if (!diff.ok) return { state: 'unknown', files: [] };
    const rows = diff.out.split('\n').filter(Boolean).map((l) => l.split('\t'));
    const changed = rows.filter(([status]) => status !== 'A').map(([, file]) => file);
    const added = rows.filter(([status]) => status === 'A').map(([, file]) => file);
    if (changed.length) return { state: 'differs', files: changed };
    return { state: added.length ? 'extra' : 'matches', files: added };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// A verdict can say anything, and in the first live run one reported the results of a
// command that had never produced any. So a check claimed as executed has to be a
// recorded run: what was run, where, against which revision and how it ended. That does
// not prove the output was read correctly; it makes a mismatch with the claim visible.
function cmdExec({ flags }) {
  const run = resolveRun(flags);
  const command = flags.command;
  if (!command) fail('exec needs the command after --: exec --as t1 --item step1 --rev 2 -- npm test', EXIT.usage);
  const initial = reduce(readEvents(run));
  requireOpen(initial);
  const member = requireMember(initial, flags);
  const item = typeof flags.item === 'string' ? flags.item : null;
  const rev = flags.rev === undefined ? null : Number(flags.rev);
  if ((item === null) !== (rev === null)) fail('--item and --rev go together', EXIT.usage);
  if (item && !shaOf(initial, item, rev)) fail(`${item}@r${rev} does not exist`, EXIT.refused);
  const cwd = typeof flags.in === 'string' ? resolve(flags.in) : process.cwd();
  const timeoutMs = flags.timeout === undefined ? 0 : Number(flags.timeout) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) fail('bad --timeout', EXIT.usage);

  const id = `x${randomUUID().slice(0, 8)}`;
  const against = item ? treeAgainst(cwd, run, shaOf(initial, item, rev)) : null;
  const started = new Date();
  const res = spawnSync('sh', ['-c', command], {
    cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024, env: process.env,
  });
  const durationMs = Date.now() - started.getTime();
  const dir = join(run, 'artifacts', 'exec', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stdout.txt'), res.stdout ?? '');
  writeFileSync(join(dir, 'stderr.txt'), res.stderr ?? '');
  const head = git(['rev-parse', 'HEAD'], { cwd, allowFail: true });
  const meta = {
    exec: id, command, cwd, startedAt: started.toISOString(), durationMs,
    exit: res.status, signal: res.signal ?? null, errorCode: res.error?.code ?? null, errorMessage: res.error?.message ?? null,
    head: head.ok ? head.out : null, tree: against?.state ?? null, treeFiles: against?.files.slice(0, 20) ?? [], output: `artifacts/exec/${id}/`,
  };
  withLock(run, (tx) => {
    const state = reduce(tx.events);
    requireOpen(state);
    tx.append({
      from: member.id, type: 'EXEC',
      ...(item ? { item, rev, sha: shaOf(state, item, rev) } : {}),
      body: `${describeExec(meta)} in ${(durationMs / 1000).toFixed(1)}s: ${command}`,
      meta,
    });
  });
  touchContact(run, member.id);
  const tail = (text) => (text ?? '').trimEnd().split('\n').slice(-40).join('\n');
  console.log(`exec: ${id}`);
  console.log(describeExec(meta));
  if (item) {
    const shown = against.files.slice(0, 8).join(', ');
    console.log({
      matches: `this directory holds ${item}@r${rev}`,
      extra: `this directory holds ${item}@r${rev}, plus files it does not have: ${shown}`,
      differs: `this directory does NOT hold ${item}@r${rev}; changed or missing: ${shown}`,
      unknown: `this directory could not be compared with ${item}@r${rev}`,
    }[against.state]);
  }
  if (res.stdout) console.log(`--- stdout (last 40 lines, all in ${meta.output})\n${tail(res.stdout)}`);
  if (res.stderr) console.log(`--- stderr\n${tail(res.stderr)}`);
  console.log(`read this output first; then cite it in a verdict: --held executed --evidence ${id}`);
}

function wakeFile(run, member) { return join(paths(run).state, `wake-${member}.json`); }

function readWake(run, member) {
  const file = wakeFile(run, member);
  if (!existsSync(file)) return { state: 'idle', attempts: 0, through: 0, lastAt: 0 };
  return JSON.parse(readFileSync(file, 'utf8'));
}

const currentState = (run) => reduce(readEvents(run));

function watcherAlive(run) {
  const age = watcherAge(run);
  return age !== null && age < 30_000;
}

function watcherAge(run) {
  const file = join(paths(run).state, 'watch.json');
  return existsSync(file) ? Date.now() - statSync(file).mtimeMs : null;
}

function sendSignal(run, member, st) {
  const script = join(run, 'team.mjs');
  // Enough to find everything again, since the session may have been compacted or cleared.
  const message = `There are new messages for you in team run ${basename(run)}. You are ${member.id}, the ${member.role}: your brief is ${join(run, 'roles', `${member.role}.md`)} and the contract is ${join(run, 'PROTOCOL.md')}. Read the messages with: node ${script} wait --as ${member.id} --timeout 0`;
  const res = spawnSync(process.env.TEAM_WAKE_CMD || 'codex', ['queue', '--thread', member.wake.thread, '--message', message, '--resume'], {
    encoding: 'utf8', timeout: 60_000, cwd: reduce(readEvents(run)).start.meta.repo,
  });
  const line = `${new Date().toISOString()} signal ${st.attempts} through #${st.through}: ${describeSpawn(res)} ${(res.stdout ?? '').trim()} ${(res.stderr ?? '').trim()}\n`;
  writeFileSync(join(paths(run).state, `wake-${member.id}.log`), line, { flag: 'a' });
  st.lastResult = `${describeSpawn(res)} ${(res.stderr ?? '').trim()}`.trim().slice(0, 500);
  st.sendFailed = res.status !== 0;
}

// An ordinary process, so a quiet hour costs no model turns. It carries a nudge and never
// a message: the content stays in the log, which is why a lost or repeated signal can
// only cost time. Only entries in the log count, so a moved cursor or a regenerated view
// cannot cause a wake-up. A successful `codex queue` does not mean the model started,
// so success is judged by what the member does afterwards.
function cmdWatch({ flags }) {
  const run = resolveRun(flags);
  const option = (name, fallback) => (flags[name] === undefined ? fallback : Number(flags[name]));
  const pollMs = option('poll', 1000);
  const quietMs = option('quiet', 2000);
  const maxDelayMs = option('max-delay', 10_000);
  const progressMs = option('progress', 120_000);
  const retryMs = option('retry', 15_000);
  const maxAttempts = option('attempts', 3);
  const staleMs = option('stale', 10_000);
  const beat = join(paths(run).state, 'watch.json');
  const token = randomUUID();
  // A heartbeat that moves is a live watcher. One that stands still is taken over once it
  // is old enough, so restarting right after a crash starts one instead of exiting with
  // a success while nobody watches.
  if (existsSync(beat)) {
    const seen = statSync(beat).mtimeMs;
    while (existsSync(beat) && Date.now() - statSync(beat).mtimeMs < staleMs) {
      if (statSync(beat).mtimeMs !== seen) {
        console.log('a watcher is already running for this run');
        return EXIT.ok;
      }
      sleep(Math.min(pollMs, 200));
    }
  }
  writeFileSync(beat, JSON.stringify({ token, pid: process.pid }));
  console.log(`watching ${basename(run)}`);

  for (;;) {
    let holder = null;
    try { holder = JSON.parse(readFileSync(beat, 'utf8')).token; } catch { /* treated as replaced */ }
    if (holder !== token) { console.log('replaced by another watcher'); return EXIT.ok; }
    const now = new Date();
    utimesSync(beat, now, now);

    const events = readEvents(run);
    const state = reduce(events);
    if (state.closed) {
      rmSync(beat, { force: true });
      console.log(`run closed: ${state.closed.meta.status}`);
      return EXIT.ok;
    }

    for (const member of state.members.values()) {
      if (!member.wake) continue;
      const files = memberFiles(run, member.id);
      const st = readWake(run, member.id);
      const delivered = readNumber(files.delivered);
      const contact = existsSync(files.contact) ? statSync(files.contact).mtimeMs : 0;
      const before = JSON.stringify(st);

      if (st.state !== 'idle' && delivered >= st.through) {
        Object.assign(st, { state: 'idle', attempts: 0 });
      } else if (st.state !== 'idle' && contact > st.lastAt) {
        // Alive and busy, which is not a failure. The clock restarts and nothing is resent.
        Object.assign(st, { state: 'signaled', attempts: 1, lastAt: contact });
      }

      const pending = unread(run, events, member.id).filter((e) => e.seq > delivered);
      if (pending.length && st.state !== 'wake_failed') {
        const newest = pending[pending.length - 1];
        const clockNow = now.getTime();
        const settled = clockNow - new Date(newest.ts).getTime() >= quietMs
          || clockNow - new Date(pending[0].ts).getTime() >= maxDelayMs;
        const send = (attempt) => {
          Object.assign(st, { state: 'signaled', attempts: attempt, through: newest.seq, lastAt: clockNow });
          sendSignal(run, member, st);
        };
        if (st.state === 'idle') {
          if (settled) send(1);
        } else if (clockNow - st.lastAt >= (st.sendFailed ? retryMs : progressMs * 2 ** (st.attempts - 1))) {
          if (st.attempts < maxAttempts) {
            send(st.attempts + 1);
          } else {
            st.state = 'wake_failed';
            withLock(run, (tx) => tx.append({
              from: 'system', to: [driverId(state)], type: 'WAKE_FAILED',
              body: `${member.id} did not respond to ${st.attempts} signals, the oldest unread is #${pending[0].seq}. Last signal: ${st.lastResult}. Nothing more will be sent until it makes contact. Ask the user to tell that session to read its messages.`,
              meta: { member: member.id, attempts: st.attempts, through: st.through, lastResult: st.lastResult },
            }));
          }
        }
      }
      if (JSON.stringify(st) !== before) atomicWrite(wakeFile(run, member.id), JSON.stringify(st));
    }
    sleep(pollMs);
  }
}

function cmdLog({ flags }) {
  const run = resolveRun(flags);
  const since = Number(flags.since ?? 0);
  const tag = typeof flags.tag === 'string' ? flags.tag : null;
  for (const e of readEvents(run)) {
    if (e.seq <= since) continue;
    if (tag && e.meta?.tag !== tag) continue;
    console.log(entry(e));
  }
}

function formatGate(row) {
  const rev = row.rev ? `r${row.rev}` : '-';
  if (!row.open) {
    const who = Object.keys(row.reviewers).map((id) => `${id}:${row.held[id]}`).join(', ');
    return `ok    ${row.item}@${rev} (${who})${row.warnings.length ? ` WARNING ${row.warnings.join('; ')}` : ''}`;
  }
  return `OPEN  ${row.item}@${rev}: ${row.problems.join('; ')}`;
}

function cmdGates({ flags }) {
  const run = resolveRun(flags);
  const state = reduce(readEvents(run));
  const rows = computeGates(state);
  if (flags.json) { console.log(JSON.stringify(rows, null, 2)); return; }
  for (const row of rows) console.log(formatGate(row));
  const removed = state.plans.flatMap((p) => p.meta.removed.map((name) => `${name} (plan r${p.rev})`));
  if (removed.length) console.log(`removed from the plan: ${removed.join(', ')}`);
}

function deliveryOf(run, event, member, state) {
  const files = memberFiles(run, member);
  if (state.verdicts.some((v) => v.from === member && v.item === event.item && v.rev === event.rev && v.seq > event.seq)) return 'resolved';
  if (readNumber(files.cursor) >= event.seq) return 'acknowledged';
  if (readNumber(files.delivered) >= event.seq) return 'delivered';
  return 'written';
}

function cmdStatus({ flags }) {
  const run = resolveRun(flags);
  const events = readEvents(run);
  const state = reduce(events);
  if (typeof flags.doing === 'string') {
    const member = requireMember(state, flags);
    atomicWrite(memberFiles(run, member.id).doing, flags.doing);
    touchContact(run, member.id);
  }
  const now = Date.now();
  const members = [...state.members.values()].map((m) => {
    const files = memberFiles(run, m.id);
    const contact = existsSync(files.contact) ? statSync(files.contact).mtimeMs : null;
    const waiting = existsSync(files.waiting) ? JSON.parse(readFileSync(files.waiting, 'utf8')).since : null;
    return {
      id: m.id,
      role: m.role,
      runtime: m.runtime,
      seen: readNumber(files.cursor),
      delivered: readNumber(files.delivered),
      unread: unread(run, events, m.id).length,
      lastContactSeconds: contact === null ? null : Math.round((now - contact) / 1000),
      waitStartedAt: waiting,
      doing: existsSync(files.doing) ? readFileSync(files.doing, 'utf8') : null,
      wake: m.wake ? { ...m.wake, ...readWake(run, m.id) } : null,
    };
  });
  const requests = [];
  for (const row of computeGates(state)) {
    if (!row.rev) continue;
    const review = state.reviews.get(`${row.item}@${row.rev}`);
    if (!review) continue;
    for (const reviewer of review.to) {
      requests.push({ item: row.item, rev: row.rev, reviewer, seq: review.seq, state: deliveryOf(run, review, reviewer, state) });
    }
  }
  const status = state.closed ? state.closed.meta.status : 'active';
  if (flags.json) {
    console.log(JSON.stringify({ run, status, entries: events.length, members, requests }, null, 2));
    return;
  }
  console.log(`${basename(run)}: ${status}, ${events.length} entries`);
  for (const m of members) {
    const contact = m.lastContactSeconds === null ? 'no contact yet' : `last contact ${m.lastContactSeconds}s ago`;
    const waiting = m.waitStartedAt ? `, wait started ${clock(m.waitStartedAt)}` : '';
    const doing = m.doing ? `, says: ${m.doing}` : '';
    const wake = m.wake ? `, wake ${m.wake.state} (signals ${m.wake.attempts})` : '';
    console.log(`  ${m.id} ${m.role} ${m.runtime ?? ''}: ${contact}${waiting}; seen #${m.seen}, delivered #${m.delivered}, unread ${m.unread}${doing}${wake}`);
  }
  if (members.some((m) => m.wake)) {
    const beat = watcherAge(run);
    console.log(`  watcher: ${beat === null ? 'not running; start it with: watch' : `${beat < 30_000 ? 'alive' : 'NOT RESPONDING, restart it with: watch'}, last beat ${Math.round(beat / 1000)}s ago`}`);
  }
  for (const r of requests) console.log(`  ${r.item}@r${r.rev} -> ${r.reviewer}: ${r.state}`);
}

function cmdClose({ flags }) {
  const run = resolveRun(flags);
  const status = flags.status;
  if (!['complete', 'partial', 'abandoned'].includes(status)) fail('--status complete|partial|abandoned', EXIT.usage);
  const reason = typeof flags.reason === 'string' ? flags.reason : null;
  if (status !== 'complete' && !reason) fail(`--reason is required for ${status}`, EXIT.usage);

  const result = withLock(run, (tx) => {
    const state = reduce(tx.events);
    if (state.closed) {
      if (state.closed.meta.status === status) return { event: state.closed, again: true };
      fail(`the run is already closed: ${state.closed.meta.status}`, EXIT.closed);
    }
    // A driver can be gone for good, and a closing word that never comes must not hold
    // the other tabs. So anybody may abandon, on the user's word; finishing is the driver's.
    let from = 'user';
    if (flags.as !== 'user') {
      const member = requireMember(state, flags);
      if (status !== 'abandoned' && member.role !== 'driver') fail('only the driver closes a run as complete or partial', EXIT.refused);
      from = member.id;
    } else if (status !== 'abandoned') {
      fail('--as user can only abandon a run', EXIT.refused);
    }
    const rows = computeGates(state);
    const open = rows.filter((r) => r.open);
    const tampered = state.plans.length && (() => {
      const plan = lastOf(state.plans);
      const text = readFileSync(join(run, plan.meta.file), 'utf8');
      return sha256(`${text}\0${JSON.stringify(plan.meta.items)}`) !== plan.sha;
    })();
    if (status === 'complete') {
      const problems = open.map(formatGate);
      if (tampered) problems.unshift(`plan file ${lastOf(state.plans).meta.file} no longer matches the approved revision`);
      const report = lastOf(state.snaps.get('report') ?? []);
      if (report && sha256(readFileSync(join(run, `report-r${report.rev}.md`), 'utf8')) !== report.sha) {
        problems.unshift(`report-r${report.rev}.md no longer matches what was reviewed`);
      }
      if (problems.length) {
        fail(`cannot close as complete:\n${problems.join('\n')}\nGet the verdicts, or close as partial with a reason.`, EXIT.refused);
      }
    }
    const unreviewed = open.map((r) => r.item);
    const everyone = [...state.members.keys()].filter((id) => id !== from);
    const event = tx.append({
      from, to: everyone, type: 'CLOSE',
      body: [
        `Run closed: ${status}.`,
        reason ? `Reason: ${reason}` : null,
        unreviewed.length ? `Without a full review: ${unreviewed.join(', ')}.` : null,
      ].filter(Boolean).join('\n'),
      meta: { status, reason, unreviewed },
    });
    return { event, again: false };
  });
  console.log(`run closed: ${result.event.meta.status}`);
  if (result.event.meta.unreviewed.length) console.log(`without a full review: ${result.event.meta.unreviewed.join(', ')}`);
  console.log(`refs stay until: gc`);
}

function cmdRebuild({ flags }) {
  const run = resolveRun(flags);
  withLock(run, (tx) => renderViews(run, tx.events));
  console.log('views rebuilt from events.jsonl');
}

function cmdGc({ flags }) {
  const top = repoTop();
  if (!top) fail('not inside a git repository', EXIT.usage);
  const days = flags['older-than'] === undefined ? 0 : Number(flags['older-than']);
  if (!Number.isFinite(days) || days < 0) fail('bad --older-than', EXIT.usage);
  let removed = 0;
  for (const run of runsIn(top)) {
    const closed = reduce(readEvents(run)).closed;
    if (!closed) continue;
    if (Date.now() - new Date(closed.ts).getTime() < days * 86_400_000) continue;
    const name = basename(run);
    const refs = git(['for-each-ref', `refs/team/${name}/`, '--format=%(refname)'], { cwd: top }).out.split('\n').filter(Boolean);
    for (const ref of refs) {
      if (!flags['dry-run']) git(['update-ref', '-d', ref], { cwd: top });
      removed++;
    }
    if (refs.length) console.log(`${flags['dry-run'] ? 'would remove' : 'removed'} ${refs.length} refs of ${name}`);
  }
  console.log(`${removed} refs; the run directories stay`);
}

function main(argv) {
  const args = parseArgs(argv);
  const command = args.positional[0];
  switch (command) {
    case 'start': return cmdStart(args);
    case 'runs': return cmdRuns(args);
    case 'doctor': return cmdDoctor(args);
    case 'join': return cmdJoin(args);
    case 'plan': return cmdPlan(args);
    case 'snap': return cmdSnap(args);
    case 'post': return cmdPost(args);
    case 'exec': return cmdExec(args);
    case 'wait': return cmdWait(args);
    case 'watch': return cmdWatch(args);
    case 'log': return cmdLog(args);
    case 'gates': return cmdGates(args);
    case 'status': return cmdStatus(args);
    case 'close': return cmdClose(args);
    case 'rebuild': return cmdRebuild(args);
    case 'gc': return cmdGc(args);
    case 'help': case undefined:
      console.log(usage());
      return command === 'help' ? EXIT.ok : EXIT.usage;
    default:
      console.error(`unknown command "${command}"\n`);
      console.error(usage());
      return EXIT.usage;
  }
}

try {
  process.exitCode = main(process.argv.slice(2)) ?? EXIT.ok;
} catch (error) {
  if (error instanceof Failure) {
    console.error(`team: ${error.message}`);
    process.exitCode = error.code;
  } else {
    throw error;
  }
}
