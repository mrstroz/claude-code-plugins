---
name: docs-sync
description: Mirror the tasks in docs/plan/ to GitHub Issues and read the answers back — creates an issue for every open task, keeps titles and labels matching the plan, ticks a checkbox when its issue is closed, and closes an issue when its task is finished or rejected. Works only where docs/docs.config.json turns it on, so a project without that file is untouched. Use when the user says "zsynchronizuj zadania z githubem", "wrzuć plan na githuba", "załóż issues z planu", "podłącz plan pod github", "zsynchronizuj issues", "sprawdź czy issues zgadzają się z planem", "przenieś zadania do issues", "sync the plan with github", "push the tasks to issues", "create issues from the plan", "reconcile the issues with docs/plan", "hook the plan up to github issues", "are the issues in sync" — and after a stretch of work where tasks were ticked locally or issues were closed in the browser and the two sides have drifted. Also use to set the mirroring up in a project that does not have it yet. Do NOT use it to run a task or update the documentation after work landed — that is project-docs:docs-task, which keeps its own task's issue current as it goes. Do NOT use it to create the documentation tree — that is project-docs:docs-init.
argument-hint: "[scope: current milestone, all open, or one task id — add 'dry-run' to change nothing]"
---

# Syncing the plan with GitHub Issues

`docs/plan/` stays where work is planned. GitHub is where it becomes visible to
everyone who does not have the repository open — assignees, comments, a PR that
closes an issue by number. This skill keeps the two saying the same thing
without either becoming a copy of the other.

The config, the issue format, the exact commands and the failure modes are in
[references/gh-issues.md](references/gh-issues.md). Read it before the first
`gh` call.

## 1. Is mirroring on

Read `docs/docs.config.json`. No file, or `github.enabled` is `false`, and
there is nothing to sync.

That is not an error — it is how most trees are. Where the project has a GitHub
remote, offer to set mirroring up (last section) and stop unless the user says
yes. Where it has none, say so in one sentence and stop.

## 2. Check the ground before touching anything

In order, because each answer makes the next question worth asking:

```bash
gh auth status
gh repo view "$REPO" --json nameWithOwner,viewerPermission,hasIssuesEnabled,defaultBranchRef
```

No `gh`, no login, no push rights, or issues disabled — report which one and
stop before the first write. Each is a thirty-second fix the user can make and
re-run, and a half-synced plan is worse than an unsynced one.

Two things come out of the same call. `nameWithOwner` has to match
`github.repo`: on a fork, `gh` resolves to the upstream, and filing a plan's
worth of issues on somebody else's repository is not recoverable by editing a
file. And `defaultBranchRef` gives the branch the footer links point at, so a
repository whose default is `master` gets `master` links rather than a guess.

## 3. Scope

A plan with sixty open tasks means sixty issues, each needing a spec section
read and a body composed. Ask the way `docs-summary` does — the current
milestone, all open tasks, or a single id — and default to the current
milestone. Say how many issues that comes to before creating any of them.

A plan already mirrored skips the question: reconcile everything, since the
expensive part is creation and there is none.

## 4. Read both sides

```bash
gh issue list --repo "$REPO" --label docs-plan --state all --limit 500 \
  --json number,title,state,stateReason,labels,updatedAt \
  -q '.[] | [.number, .state, .stateReason, (.labels|map(.name)|join(",")), .title] | @tsv'
```

Only issues carrying the scope label exist as far as this skill is concerned.
Anything opened by hand in that repository is somebody else's work: not
reported, not counted, not touched. An issue whose title prefix belongs to a
different `taskPrefix` is somebody else's tree in the same repository, and goes
the same way.

Then read `docs/plan/`: the roadmap for the milestone letters, every `NN-*.md`
for its task lines — checkbox, priority token, id, title, then the metadata line
carrying `Spec`, `Depends on`, `Blocker` and, where the task has been mirrored,
`Issue: [#42](…)`.

## 5. Match, and sort into four states

Join on the issue number in the plan first, then on the id in the issue title
for whatever is left. The four states and what each one deserves are in
[references/gh-issues.md](references/gh-issues.md) — the one worth naming here
is the third: **a task whose line has no `Issue:` segment but whose id already
titles an issue is not an orphan.** It is an interrupted run, and it is healed
by writing the segment back, never by creating a second issue.

Direction is a property of the field, not of a timestamp. The plan owns title,
priority, milestone and blocked; closing is the one thing that flows back from
GitHub. The table in the reference settles every case, and two of them end in a
question rather than an action: a title that differs on both sides, and an issue
somebody reopened deliberately.

## 6. Show the changes, ask once

Print what is about to happen, grouped by direction, before any of it happens:

```markdown
**To GitHub** — 4 changes
| Task | Issue | Change |
|---|---|---|
| HUE-12 | new | Create, `priority:high` `milestone:M2` |
| HUE-09 | #38 | Close, completed |
| HUE-21 | #44 | Close, not planned |
| HUE-15 | #41 | Labels: +blocked |

**To the plan** — 1 change
| Task | Issue | Change |
|---|---|---|
| HUE-11 | #40 | Closed as completed — tick the checkbox |

**Needs a decision** — 1
| Task | Issue | Why |
|---|---|---|
| HUE-13 | #42 | Closed as not planned; a rejected task needs a dated reason |
```

One confirmation covers the whole batch. Everything under "Needs a decision" is
asked separately with `AskUserQuestion`, showing both sides — those are the
cases where acting quietly corrupts one side of the pair.

Called with `dry-run`, print these tables and stop. Nothing is created, edited
or written.

## 7. Apply, in an order that survives interruption

Labels first, then creates, then edits, then closes and reopens.

**Write each new issue's `Issue:` segment into the plan immediately after
creating it**, one task at a time, never batched to the end. `gh issue create`
and the file edit cannot be made atomic in a skill, so the sequence is made
recoverable instead: a create that landed without its segment is found again by
its title prefix on the next run, and a run that dies halfway leaves no
duplicates behind.

Report the first failure and stop rather than pushing through. A rate limit does
not clear by continuing, and the run is safe to repeat.

## 8. Write the results back into the plan

- **The `Issue:` segment** goes on the task's metadata line, last, after `Spec`,
  `ADR`, `Depends on` and `Blocker`, joined with ` · `. It rides that line
  rather than starting its own: a task is four lines, five with a context line,
  and mirroring does not buy it a sixth.
- **A checkbox ticked from a closed issue is not a one-character edit.** It
  pulls the rest of the closing sequence behind it — the spec where behaviour
  changed, the roadmap's "State today", the milestone counter. Hand those tasks
  to `project-docs:docs-task` in catch-up mode rather than ticking the box and
  leaving the roadmap claiming the task is still next.
- **Nothing else in the plan is rewritten.** Titles, priorities and `Done when`
  conditions are authored in the files. The sync reads them; it never writes
  them back from a GitHub title somebody adjusted in the browser.

Before editing any file under `docs/`, invoke `project-docs:docs-style`.

## 9. Report

Three lines — what went to GitHub, what came back, what still needs a person —
and then the filtered issue list, because looking at it is the next thing the
user does anyway:

```
https://github.com/<owner>/<repo>/issues?q=is%3Aopen+label%3Adocs-plan
```

A sync where nothing changed says exactly that in one line and prints no tables.

## Setting mirroring up

For a project that has a plan and no `docs.config.json`. Ask two things —
whether to mirror at all, and which repository, proposing what `gh repo view
--json nameWithOwner` reports. Then write the file, create the labels, and run
from step 3.

```json
{
  "version": 1,
  "language": "pl",
  "taskPrefix": "HUE",
  "github": { "enabled": true, "repo": "mrstroz/tesoro-huella" }
}
```

`language` and `taskPrefix` are copied from `docs/README.md` and
`docs/plan/README.md`, which stay authoritative — the config repeats them so a
sync does not have to parse prose first, and reports itself stale if they ever
disagree.

**Turning mirroring on is also a documentation change**, and it is the one step
easy to forget, because the tree already reads correctly without it. Two lines
have to be added in the same breath as the config file:

- `docs/plan/README.md`, in the task format section: the `Issue:` bullet, so
  the file describes the line shape people are about to start seeing.
- `docs/README.md`, under Conventions: one line saying the plan is mirrored,
  that `docs.config.json` holds the settings, and that `docs-sync` keeps the two
  in step.

Both skeletons in `docs-init/references/templates.md` carry these as
opted-in-only content, which is exactly why they are missing here: the tree was
scaffolded before this decision existed. A map that omits a file readers will
find is what stops them trusting the map.

Turning mirroring **off** reverses the same two edits and leaves the issues
alone. Deleting them is somebody's call to make in GitHub, not a side effect of
editing a config file.

The first sync pushes **open tasks only**. Finished and rejected work stays in
the files where its history already lives; importing it as a wall of closed
issues buries the backlog the mirror was supposed to make visible.
