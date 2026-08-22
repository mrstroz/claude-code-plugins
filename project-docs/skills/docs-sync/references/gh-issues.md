# Plan tasks as GitHub issues

The format, the commands, and what to do when GitHub says no. Read this before
the first `gh` call — an issue written the wrong way has to be found and fixed
by hand later, and there is no migration for a hundred of them.

Shared by `docs-sync` and `docs-task`. Reach it as
`${CLAUDE_PLUGIN_ROOT}/skills/docs-sync/references/gh-issues.md`.

## The config

`docs/docs.config.json` is what makes any of this happen. No file means no
mirroring, and that is the normal state for most trees:

```json
{
  "version": 1,
  "language": "pl",
  "taskPrefix": "HUE",
  "github": {
    "enabled": true,
    "repo": "mrstroz/tesoro-huella",
    "labels": {
      "scope": "docs-plan",
      "priority": { "^": "priority:high", "=": "priority:normal", "v": "priority:low" },
      "blocked": "blocked",
      "milestonePrefix": "milestone:"
    }
  }
}
```

`github.enabled` and `github.repo` are the only required keys; everything else
falls back to the values above, so a working config is four lines. A `version`
above `1` was written by a newer plugin — say so and stop rather than guessing
at keys you do not know. Unknown keys are ignored, mentioned once.

Any label may be set to `null` to switch it off. `"=": null` is worth
considering on a plan where most tasks are normal priority: a label carried by
seven issues in ten sorts nothing, which is the same argument this plugin
already makes about the `(^)` token.

`language` and `taskPrefix` repeat what `docs/README.md` and
`docs/plan/README.md` say in prose. **The config is a cache of the prose, not a
second source of truth.** That is what makes the duplication safe: where the
two disagree, follow the documents, and report the config as stale rather than
writing `HUE-12` into a tree whose tasks all say `APP-12`.

The milestone label is not a config key. It comes from the milestone file's own
heading — `# M2. Ingestion` gives `M2`, a Polish tree's `# E2. Zbieranie` gives
`E2` — because the plan already carries it and a third copy is a third thing to
keep in step.

## Title: the recovery key

```
HUE-10 Audit row written in the same commit as the payment row
```

The id, a space, then the task's own title. No brackets, no colon, no priority.
Parse it back with `^([A-Z]{2,4}-[0-9]+)\s+(.*)$`.

The primary link between a task and its issue is the number stored in the
plan's `Issue:` segment. The title prefix is what finds the issue when that
segment is missing — after an interrupted run, or a hand-edited file. It beats
a hidden `<!-- -->` marker in the body on three counts: it survives a body
rewrite, a human who breaks it can see they broke it, and in a repository
carrying two documentation trees it is the only thing that separates `HUE-*`
issues from `APP-*` issues under the same label.

An issue whose title prefix does not match this tree's `taskPrefix` belongs to
somebody else. Ignore it silently.

## Body, written once

```markdown
The endpoint currently writes the payment row and the audit row in two
separate transactions, so a crash between them leaves a payment nobody can
account for. This task moves both writes into one commit, which is what makes
the audit trail trustworthy rather than best-effort.

**Acceptance criteria**
- [ ] the audit row exists whenever the payment row does
- [ ] a failure during the write leaves neither row

**Depends on:** #41

---
`HUE-10` · [M2](https://github.com/mrstroz/tesoro-huella/blob/main/docs/plan/03-ingestion.md) · [Spec 04 §4](https://github.com/mrstroz/tesoro-huella/blob/main/docs/spec/04-ingestion.md#4-the-two-table-write)
```

Four parts, in this order:

- **The description**, two to four sentences, written from the spec section the
  task links to. Say what comes into existence and why the system needs it. A
  summary, not a copy — a pasted section is a second version of the spec that
  starts rotting the moment the real one is corrected, and the footer link is
  there so nobody has to guess where the truth lives.
- **Acceptance criteria**, as a checklist. The task's `Done when` is the first
  item; further items come from checkable conditions in that same spec section.
  Where there is no `Done when` and the section offers no condition, restate the
  title as one observable outcome rather than inventing requirements nobody
  agreed to.
- **Depends on**, as issue numbers, and only for dependencies that already have
  issues. One without an issue yet is left out and appears on a later sync.
- **The footer**: the backticked id, the milestone file, the spec and ADR links.
  Relative links do not resolve inside an issue, so these are absolute
  `blob/<default-branch>` URLs.

**The body is create-time content.** It is written once and never regenerated
by a routine sync. Model-written prose comes out differently every run, so
regenerating it would rewrite every issue on every sync — notification spam for
anyone watching the repository, and `updatedAt` rendered meaningless. Rewrite a
body only when the user asks for it, or when the task's spec link itself
changed, which is a cheap and exact signal.

That is also why `body` is not among the fields the sync fetches. It is never
compared.

**Write the body to a temp file and pass `--body-file`.** Never `--body` with
the text inline: the body carries backticks, quotes and newlines, and shell
quoting is exactly where that goes wrong.

## Labels

| Label | Comes from | Notes |
|---|---|---|
| `docs-plan` | Every mirrored issue | The scoping key. Sync only ever looks at issues carrying it, so anything opened by hand in that repository is invisible to it |
| `priority:high` / `priority:normal` / `priority:low` | The `(^)` `(=)` `(v)` token | A missing token reads as `(=)`, exactly as everywhere else |
| `blocked` | An uncleared `Blocker`, or an unticked `Depends on` | Removed as soon as it clears, so the label answers "can this be picked up" |
| `milestone:M2` | The milestone file's heading | The plan's own letter, so a Polish tree gets `milestone:E2` |

Milestones are labels rather than native GitHub milestones. A native milestone
carries its own dates and closed state — a second plan to keep in step with the
first, and the plan already has a roadmap for that.

Create them once, at the start of the first sync:

```bash
gh label create docs-plan       --repo "$REPO" --color 0E8A16 --description "Task mirrored from docs/plan" --force
gh label create priority:high   --repo "$REPO" --color B60205 --description "Everything else in the milestone waits on it" --force
gh label create priority:normal --repo "$REPO" --color FBCA04 --description "Required, but nothing is held up by it" --force
gh label create priority:low    --repo "$REPO" --color 0E8A16 --description "The milestone closes without it" --force
gh label create blocked         --repo "$REPO" --color D93F0B --description "Waiting on something outside the plan" --force
gh label create "milestone:M1"  --repo "$REPO" --color 1D76DB --description "<the milestone's goal>" --force
```

`--force` updates an existing label instead of failing, so this is safe to
re-run and needs no "does it exist" check first.

**Use these colours, rather than picking your own.** `--force` rewrites the
colour of a label that already exists, so a value invented per run means the
labels change colour every time a different session syncs — churn in the one
part of the repository people navigate by sight. The milestone labels are the
exception that has to be generated, one per milestone file; keep them all the
same blue so they read as one family.

**If `docs-plan` cannot be created, stop.** It is the scoping key: issues
created without it are invisible to every future sync, and the next run will
create them all a second time. The other labels degrade — create the issue
without them and say so.

## The commands

```bash
# Everything the sync knows about, in one call, flattened so it costs little
gh issue list --repo "$REPO" --label docs-plan --state all --limit 500 \
  --json number,title,state,stateReason,labels,updatedAt \
  -q '.[] | [.number, .state, .stateReason, (.labels|map(.name)|join(",")), .title] | @tsv'

# Create
gh issue create --repo "$REPO" --title "HUE-10 Audit row written in the same commit" \
  --body-file /tmp/hue-10-body.md --label docs-plan --label priority:normal --label milestone:M2

# Update — title and labels; the body is left alone
gh issue edit 42 --repo "$REPO" --title "…" --add-label blocked --remove-label priority:low

# A finished task
gh issue close 42 --repo "$REPO" --reason completed

# A rejected task — the note from the plan is the comment, and it is the one
# piece of history GitHub gets that it did not already have
gh issue close 42 --repo "$REPO" --reason "not planned" \
  --comment "Rejected 2026-03-14. Stripe replays from its own dashboard, so this only added a second way to produce duplicates."

# A task whose checkbox went back to open
gh issue reopen 42 --repo "$REPO" --comment "Reopened: the checkbox is open again in docs/plan."
```

`--limit` is not optional: the default is 30, and a plan of sixty tasks would
come back looking half-orphaned. `--state all`, because closed issues are what
drives the reverse direction. `labels` arrives as an array of objects, hence
`map(.name)`.

## Which way each field flows

There is no stored "when we last agreed", and no way to reconstruct one.
`git log -1 --format=%cI -- docs/plan/03-x.md` has file granularity, so editing
one task bumps the timestamp for every task in that file; and every edit the
sync itself makes bumps the issue's `updatedAt`, so after the first run the
remote looks newer forever. A rule built on those two clocks does not arbitrate,
it guesses — and guessing here reopens issues a person closed on purpose.

So direction is a property of the field, not of the clock:

| Disagreement | What happens |
|---|---|
| Issue closed as `COMPLETED`, plan `[ ]` | Tick the checkbox |
| Issue closed as `NOT_PLANNED`, plan `[ ]` | Propose `[-]` and **ask for the reason** — the dated rejection note is mandatory and "not needed" is not a reason |
| Plan `[x]`, issue open | Close it, `--reason completed` |
| Plan `[-]`, issue open | Close it, `--reason "not planned"`, the rejection note as the comment |
| Plan `[x]` or `[-]`, issue `REOPENED` | **Ask.** Somebody reopened it deliberately; never un-tick on your own |
| Priority, blocked, milestone labels | The plan wins, silently. They are projections of plan tokens, and GitHub has no editor for them that means anything |
| Title | **Ask, showing both.** Rare, and the only text both sides can legitimately author |
| Body | Not compared, ever |

What is genuinely bidirectional is therefore exactly two channels: closing
flows GitHub → plan, everything else flows plan → GitHub. That is small enough
to be carried out reliably in prose. General bidirectionality is not.

Timestamps still earn their place — inside the question, never as the answer:
"the plan file was last committed 2026-08-20, the issue was edited 2026-08-21
by @kate" is exactly what a person needs to decide, and useless for deciding
without them.

## Matching, and the four states

Join on the issue number in the plan's `Issue:` segment first, then on the
title prefix for whatever is left over.

```bash
rg -n '^- \[[ x-]\] (\([\^=v]\) )?\*\*`?[A-Z]+-[0-9]+`?\*\*' docs/plan/*.md
rg -o 'Issue: \[#([0-9]+)\]' docs/plan/*.md
```

| State | What it means | What happens |
|---|---|---|
| Task, no issue anywhere | Never mirrored | Create it — open `[ ]` tasks only. Done and rejected work stays file-only; the plan already holds that history and a backlog of closed issues nobody worked in buries the live ones |
| Task with no `Issue:`, but an issue whose title carries its id | A run was interrupted, or the line was hand-edited | Not an orphan and not a second issue. Heal it by writing the segment back |
| Issue, no task | The id appears nowhere in `docs/plan/` | Report and ask. Never auto-create a task: a task with no spec link is a spec section wearing a checkbox |
| Both | The normal case | Compare title, state and labels, and nothing else |

**Before every create, check the title prefix:**

```bash
gh issue list --repo "$REPO" --label docs-plan --state all \
  --search "WH-10 in:title" --json number,title -q '.[] | [.number,.title] | @tsv'
```

A hit means the issue already exists and the plan simply lost its segment —
write the segment, do not create a second issue. This is what makes the whole
thing idempotent, and it is the reason the prefix exists. Where the whole list
from the step above is already in hand, match against it rather than paying for
another call.

**Two tasks citing the same issue number is a data bug.** Stop and report it;
do not pick one.

## Creating is two writes, and they are not atomic

`gh issue create` succeeds, then the `Issue:` segment goes into the file. A
session that dies between them leaves an issue nothing references — and, on the
next run, a second issue for the same task.

Nothing in a prose skill can make those two writes atomic, so make the sequence
recoverable instead:

- **Write the segment immediately after each create**, one task at a time.
  Never batch the file edits to the end of the run.
- **Search the title prefix before creating**, so a create that did land is
  found rather than repeated.

Together those two make every run resumable and every repeat harmless, which is
the only durability story available without a script.

## When it goes wrong

A GitHub failure never fails the documentation work. `docs-task`'s job is the
spec, the ADR and the checkbox; the mirror is a projection of those. Everything
here degrades to "say it once, carry on".

| Mode | How you find out | What to do |
|---|---|---|
| `gh` not installed | `command -v gh` | Say so, name `https://cli.github.com`, continue as if the config were absent |
| Not authenticated | `gh auth status` | Same, naming `gh auth login` |
| No remote, or not GitHub | `gh repo view --json nameWithOwner` fails | Say so once, skip mirroring for the session |
| The remote resolves to an upstream, not the fork | `nameWithOwner` differs from `github.repo` | **Stop.** Never guess which repository gets the issues |
| No push rights, or issues disabled | `gh repo view --json viewerPermission,hasIssuesEnabled` | Stop before the first write. Offer to enable issues; do not enable them unasked |
| Rate limit, or the network dies | The first failed call | Stop the loop there. Report which tasks landed and which did not, and say that re-running is safe |
| An issue the plan references is gone | `gh issue view N` cannot resolve it | Report the dangling segment; offer to recreate the issue or drop the segment. Never point the task at a different number, and check whether it was transferred rather than deleted — a transfer resolves in another repository |
| A title lost its id prefix | Matched by number, prefix absent | Restore the prefix. Do not create a duplicate |

## The first sync of an existing plan

Sixty open tasks means sixty issues, each with a spec section read and a body
composed. That is slow, and sustained creation is what GitHub's abuse detection
watches for.

So the first run asks for scope the way `docs-summary` does — the current
milestone, all open tasks, or one task — and says how many issues it is about
to create before creating any of them.
