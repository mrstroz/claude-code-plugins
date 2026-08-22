# File skeletons

Ten files, in the order they get written. Each skeleton is followed by the rules that apply to it — those rules are the part that decays first, so keep them in view while filling the file in.

Headings are given in English. For a Polish tree, translate them using [headings.md](headings.md) and nothing else, so the terms stay identical across the whole tree.

Placeholders are in `<angle brackets>`. Anything not in brackets is meant to survive into the real file.

## Contents

1. [spec/00-overview.md](#1-spec00-overviewmd)
2. [spec/NN-area.md](#2-specnn-areamd)
3. [spec/NN-dependencies.md](#3-specnn-dependenciesmd)
4. [adr/template.md](#4-adrtemplatemd)
5. [adr/NNNN-decision.md](#5-adrnnnn-decisionmd)
6. [adr/README.md](#6-adrreadmemd)
7. [plan/README.md](#7-planreadmemd)
8. [plan/NN-milestone.md](#8-plannn-milestonemd)
9. [plan/roadmap.md](#9-planroadmapmd)
10. [docs/README.md](#10-docsreadmemd)

---

## 1. `spec/00-overview.md`

```markdown
# 00. Overview and scope

## Document information

| Field | Value |
|---|---|
| **Project** | <name> |
| **Repository** | `<repo>` |
| **Created** | <YYYY-MM-DD> |
| **Status** | Draft |

---

## 1. Purpose

<What problem this solves, and what is true today that makes it worth solving.
Concrete: what nobody can currently see, do or measure. Where the project
answers specific questions, list them numbered — they become the success
criteria.>

## 2. Guiding principle

**<One sentence that every other decision follows from.>**

<Two or three sentences on what that principle rules out. This section is what
makes the rest of the spec derivable rather than arbitrary.>

## 3. Scope of version 1

| Area | In scope |
|---|---|
| <area> | <what specifically> |

## 4. Out of scope in version 1

| Item | Reason |
|---|---|
| <item> | <why it is deferred, and whether adding it later is additive or a rewrite> |

## 5. Users

| Role | Need |
|---|---|
| <role> | <what they need from this> |

## 6. Success criteria

<Numbered, each one checkable against the running system.>

## 7. Environments

| Environment | Where | Notes |
|---|---|---|

## 8. Glossary

| Term | Meaning |
|---|---|

## 9. Open questions

| # | Question | Options | What will settle it |
|---|---|---|---|
```

**Rules.** Under 280 lines; short is fine. The glossary is not decoration: every other document uses these terms and only these. Open questions are for decisions deliberately deferred — with the options written down and a criterion for settling them, so a deferral is visible rather than silently forgotten. Sections 5 to 9 are the ones most often skipped and most often needed six months later.

---

## 2. `spec/NN-area.md`

```markdown
# NN. <Area>

<One or two sentences: what this document covers and why it matters. No
ceremony, no announcement of what is coming.>

## 1. <First thing>

<Behaviour, with a file path behind every claim.>

## 2. <Second thing>

| <enumerable> | <facts> |
|---|---|

## N. Out of scope

<What a reader might reasonably expect here and will not find, with a pointer
to where it lives instead.>
```

**Rules.** Under 280 lines. Section numbers are addresses: append new sections at the end, never renumber existing ones, because every link in the tree points at a number. The document states the system as it is now: when something changes, edit the sentence that carries it and delete what is no longer true, rather than noting anywhere that it changed. Anything enumerable goes in a table. The paragraph under a table says what the table cannot — why the boundary falls there, what happens in the odd case — and never restates its rows.

There is no minimum. A finished area document of 60 lines is finished. The one document that may run past 280 is a catalog with one entry per block, endpoint or screen: splitting it on a line count puts half the entries in a second file, which is worse than the long file. Split it by entry group or leave it long.

---

## 3. `spec/NN-dependencies.md`

Only when other repositories are involved. Skip it entirely for a single-repo project.

```markdown
# NN. Dependencies in other repositories

<Why this project is not self-sufficient, in two sentences.>

The **Blocks release** column says whether the item is a condition of shipping.
The **Status** column is the only place progress in other repositories is
tracked; the plan does not repeat it. Values: `not raised`, `raised`,
`in progress`, `done`.

## 1. <other-repo>

| # | Task | Blocks release | Status | Document |
|---|---|---|---|---|
| <XX-1> | <what they have to do> | <yes/no> | <status> | <link to the spec doc that needs it> |

### <XX-1>: detail

<Only for items where the contract needs spelling out.>
```

**Rules.** Work in other repositories never becomes a plan task, because someone else does it somewhere else. It appears in the plan only as `Blocker: XX-1` on the one task that waits for it. The exception worth carrying: infrastructure this project owns — a database that has to exist, a secret that has to be set — sits on the critical path and *does* get a plan task, whose done-condition includes flipping the status here.

---

## 4. `adr/template.md`

Copied into the project as-is, with only the headings translated. It is the project's own template from then on.

```markdown
# ADR-NNNN: <decision title>

| Field | Value |
|---|---|
| **Status** | Proposed / Accepted / Open / Superseded by ADR-XXXX |
| **Date** | YYYY-MM-DD |
| **Applies to** | <which part of the system> |

## Context

What forces the decision. Facts, constraints, the state of existing systems,
with references to specific files where the decision follows from them.

## Decision

What we choose. One or two sentences, in the indicative.

## Consequences

**Positive:** what we gain.

**Negative:** what we lose and have to live with.

**Requirements:** what has to exist for the decision to work (tasks in other
repositories, configuration changes).

## Options considered

| Option | Why rejected |
|---|---|
| … | … |

## When to revisit

The conditions under which this decision stops being the right one.
```

---

## 5. `adr/NNNN-decision.md`

Follows the template exactly. Named `NNNN-short-description.md`, numbered consecutively from `0001`, with the description in the documentation language.

**Rules.** Under 80 lines, and no floor. One file, one decision — if Context is describing two problems, it is two ADRs. Options considered is a table with a real reason per row; "not a good fit" is not a reason. "When to revisit" states a *condition*, never a date.

A 20-line ADR is not automatically thin, but it is worth two checks: whether Options considered actually lists what was rejected, and whether Context carries a fact — a measurement, a constraint, a file — rather than an assertion. If both hold, leave it short. Padding an honest ADR up to some length adds nothing anyone will read.

An ADR is kept current. When the same decision changes in its details, edit the body so it reads as the decision in force, with no note that something was corrected and no superseded value left beside the new one. Where the earlier decision still explains why the architecture looks the way it does, add a short `## Decision History` at the end — what held before, what replaced it, why if that is not obvious — and nothing more; where it explains nothing, leave the section out. Context describing what the situation was before is not history in this sense — it is what forces the decision, and it stays. A new ADR is for a new decision, or one replaced outright: its status says "Supersedes ADR-XXXX" and the old one's becomes "Superseded by ADR-YYYY". Old ADRs are never deleted.

---

## 6. `adr/README.md`

```markdown
# Architecture decisions (ADR)

Each file records one decision: the context, the choice, the consequences, and
the options that were rejected. The point is that in six months it should be
possible to reconstruct **why** something looks the way it does, without
archaeology in the commit history.

## Rules

- One file, one decision. Named `NNNN-short-description.md`, numbered consecutively.
- An ADR is kept current. When the same decision changes in its details, its
  body is edited to state the decision in force — no "correction" section and
  no old value beside the new one. A new ADR is for a new decision or one
  replaced outright, marked "Supersedes ADR-XXXX"; the old one gets
  "Superseded by ADR-YYYY".
- An earlier decision may be kept in a short "Decision History" section at the
  end, but only where it explains why the architecture looks the way it does.
- Statuses: **Proposed** → **Accepted** → **Superseded** / **Rejected**.
  **Open** means a decision deliberately deferred, with the options written
  down and a criterion for settling it.
- An ADR records the decision and its reasons. How the feature behaves belongs
  in `docs/spec/`.

## Register

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-<name>.md) | <one line> | Accepted | <YYYY-MM-DD> |

Template: [`template.md`](template.md).
```

**Rules.** Under 40 lines plus the register. The register is updated in the same commit as a new ADR or a status change, and the same one-liner appears in `docs/README.md` — those two tables drifting apart is the first sign nobody is maintaining this.

---

## 7. `plan/README.md`

```markdown
# Work plan

`spec/` says **what** we are building, `adr/` says **why**, and this directory
says **when, and what now**.

The plan does not describe how the system behaves. Every task points at the
specification section where that behaviour is written down. A correction to the
specification therefore needs no edit here, and moving a task around does not
touch the specification.

## Files

| File | Contents |
|---|---|
| [`roadmap.md`](roadmap.md) | State today, milestones, ordering, risks |
| [`01-<name>.md`](01-<name>.md) | M0: <goal> |

## Task format

```markdown
- [ ] (^) **<PREFIX>-12** <what comes into existence>
      Spec: [02 §1](../spec/02-<name>.md#1-<anchor>) · Depends on: <PREFIX>-11
      Done when: <one condition, checkable>

- [-] (v) **<PREFIX>-14** ~~<what we decided not to build>~~
      **Rejected YYYY-MM-DD.** <why, in one or two sentences>
```

- **The checkbox** carries the state: `[ ]` open, `[x]` done, `[-]` rejected.
- **The priority** sits between the checkbox and the id. `(^)`: everything else
  in the milestone waits on it. `(=)`: the default — required, but nothing is
  held up by it. `(v)`: the milestone closes without it. A missing token reads
  as `(=)`. `(^)` marks what goes *first*, not what is *necessary*; almost
  every task in a milestone is necessary. At most a third may carry it.
- **The title** says what comes into existence, not how.
- **Spec** and **ADR**: relative links, with the section number in the text.
  When a heading changes and the anchor stops working, `02 §1` still leads to
  the right place. At most two documents per task; more than that means the
  task is too large.
- **Depends on**: only tasks from this plan.
- **Blocker**: something outside the plan that has to land first, tracked in
  <the dependencies document's status column / the open questions in
  `spec/00`>. A blocked task waits until that entry clears.
- **Done when**: only where the condition does not follow directly from the
  title. One condition, checkable in a test or against the running system.
- **One context line** is allowed under an open task: why it exists, or what a
  measurement showed — the review finding or the number that would otherwise be
  lost. Not how the system behaves; that is what the spec link is for.
- **Rejected**: `[-]`, the title struck through, and a dated
  `**Rejected YYYY-MM-DD.**` note saying *why* — not "not needed" — in at most
  two sentences. The id stays: numbers are never reused, and somebody will come
  looking for this one.
- **Issue**: `[#42](https://github.com/<owner>/<repo>/issues/42)`, last on the
  metadata line. Written and maintained by `project-docs:docs-sync`; the
  checkbox stays the state everything here reads, and the issue follows it.

## Identifiers and commits

`<PREFIX>-NN` numbering runs continuously through the whole project,
independent of file and milestone. Numbers are never reused: an abandoned task
becomes `[-]` with a dated reason and stays on the list, a moved task keeps its
number.

One task is one commit with the identifier in the message. Commit messages in
English, for example `feat: <PREFIX>-11 <what was built>`.

## Definition of done

Shared by every task, so it is not repeated on each one:

1. <derived from this project's toolchain: tests, type check, lint>
2. <derived: this repository's own conventions>
3. If a task changed behaviour relative to the specification: **the
   specification is corrected first, then the code.**
4. The checkbox is ticked by whoever finished the task, in the same commit.

## How to assign work

"Do <PREFIX>-12" is enough. The order is: read the task and the linked
specification sections, implement, tick the checkbox and update "State today"
in [`roadmap.md`](roadmap.md), commit.

When a task turns out to depend on something that is not in the plan, we add a
new task rather than inflating the current one.
```

**Rules.** Under 80 lines. Items 3 and 4 of the definition of done are universal and always present. Everything above them comes from the project's real toolchain — read `package.json`, `pubspec.yaml`, the CI config. A list naming a command the project does not have teaches people to skip the list.

The Issue bullet is written **only into a tree that mirrors its plan to GitHub** — one with a `docs/docs.config.json` turning it on. Leave it out everywhere else. A format rule describing something the project does not do invites somebody to start doing it by hand, and a hand-written issue link is exactly what the sync cannot recognise. A project that turns mirroring on later does not have to come back here: `project-docs:docs-sync` adds this bullet, and the matching Conventions line in `docs/README.md`, as part of turning it on.

The Blocker bullet is where this file resolves the placeholder: name **one** place, and the same one every time. Other repositories are involved → the dependencies document's status column. They are not → the open questions in `spec/00`, which is where a project waiting on a client decision or an access credential tracks it. Every skill that reads a blocker reads this bullet to know where to look, so leaving both options in is the same as leaving it blank.

---

## 8. `plan/NN-milestone.md`

```markdown
# M<N>. <Milestone name>

**Goal:** <one sentence>

**End of milestone:** <what works that did not work before, in the user's terms>

**External dependencies:** <what this milestone waits on, or "none">

## Tasks

- [ ] (^) **<PREFIX>-NN** <title>
      Spec: [NN §N](../spec/NN-<name>.md#n-<anchor>) · Depends on: <PREFIX>-NN
      Done when: <one checkable condition>

## Notes

<Optional. Only what a future reader needs and cannot get from the tasks: why a
task moved, what a measurement showed, why something that looks wrong is
deliberate.>
```

**Rules.** Under 150 lines; past that the milestone should have been two. A ticked task may carry a `**Done YYYY-MM-DD.**` annotation of at most two sentences — it earns its place when it stops someone "fixing" something deliberate, or records a measurement nobody will repeat. An open task may carry one context line in the same position: why it exists, or what a measurement showed. Longer than that and it belongs in `## Notes`; most of it belongs nowhere.

A rejected task keeps its place in the list as `- [-]` with its title struck through and a `**Rejected YYYY-MM-DD.**` note. Unlike the completion note, that one is mandatory: a struck-through line with no reason invites somebody to put the task back.

Only the current milestone is written out in full. Later ones get their goal and end-of-milestone line, and their tasks when they are next.

---

## 9. `plan/roadmap.md`

```markdown
# Roadmap

## State today

| Field | Value |
|---|---|
| **Milestone** | <M1. Name — in progress, 2 of 5. M0 closed YYYY-MM-DD> |
| **Last completed** | [<PREFIX>-09](02-<name>.md) <what it was, one line> |
| **Next** | [<PREFIX>-10](02-<name>.md) <what it is, and anything unblocked in parallel> |

This table is replaced by whoever finishes a task. It is the only place anyone
needs to look at the start of a session.

## Milestones

| Milestone | File | Goal | What works at the end | Progress |
|---|---|---|---|---|
| **M0** | [01-<name>](01-<name>.md) | <goal> | <observable outcome> | 0/6 |
| **M1** | [02-<name>](02-<name>.md) | <goal> | <observable outcome> | 4/6, 1 rejected |

<N> tasks in total. One task is one session and one commit.
<Nothing else. This line does not become a changelog.>

## Why this order

<Prose. The real constraints — what would have to be rewritten if the order
were different, what risk is being retired early, what depends on someone else.
If a side effect of the order will make a demo look unfinished, say so here.>

## Risks pulled ahead of the queue

| Risk | What we do | When |
|---|---|---|
| <a risk that could invalidate a decision> | <the probe that settles it> | <the task and milestone that fires it> |

## What is not in the plan

<Point at the out-of-scope section of `spec/00` rather than repeating it. Then
anything absent by decision rather than by scope, with the ADR that decided it.>
```

**Rules.** Under 120 lines. "State today" is **replaced**, never appended to — a cell that accumulates one entry per session becomes the longest thing in the repository inside a week, and then the one place everyone was told to start is the one place nobody reads. Three rows are mandatory; add a fourth only for a fact needed at the start of every session that lives nowhere else.

The line under the milestones table is the other half of that rule, and the easier one to lose. History pushed out of "State today" reappears there as "APP-75 arrived after APP-70, APP-73 reopened M1, APP-50 was dropped…" — the same banned cell one section lower. Each of those facts belongs on its own task as a `**Done**` annotation, where the person reading that task will actually find it.

A rejected task leaves the progress denominator and is counted after it: `4/6, 1 rejected`, never `4/7`. Otherwise the milestone can never reach its own total and the counter stops meaning anything.

Retired risks stay in the table with the outcome struck through, because what a probe found is often more useful than the risk itself.

---

## 10. `docs/README.md`

```markdown
# Documentation: <project>

<One or two sentences on what this project is. Only if the name does not say it.>

## How to use these documents

The specification (`spec/`) describes **what** the system does and how it
connects to the rest of the platform. The ADRs (`adr/`) record **why** a given
solution was chosen and what was rejected. The plan (`plan/`) says **when, and
what now**.

Starting work? [`plan/roadmap.md`](plan/roadmap.md) is the only place to look first.

Changing behaviour? Fix the specification first, then the code, and edit what
is there rather than noting that it changed. Changing an architectural
decision? Update the ADR that owns it; a new ADR is for a new decision or one
replaced outright. Old ADRs are never deleted.

## Specification

| Document | Contents |
|---|---|
| [`spec/00-overview.md`](spec/00-overview.md) | Purpose, scope, out of scope, environments, glossary, open questions |

## Work plan

| Document | Contents |
|---|---|
| [`plan/README.md`](plan/README.md) | Task format, identifiers, definition of done, how to assign work |
| [`plan/roadmap.md`](plan/roadmap.md) | State today, milestones, ordering, risks |

## Architecture decisions

| ADR | Decision | Status |
|---|---|---|
| [0001](adr/0001-<name>.md) | <one line> | Accepted |

Template for a new ADR: [`adr/template.md`](adr/template.md).

## Other directories

<Only if there are any. One row each, so the map covers the whole folder.>

| Directory | What is in it |
|---|---|
| `<name>/` | <what it holds, and whether it concerns this project at all> |

## Conventions

- Documentation is written in <language>. Specification files are numbered
  `NN-name.md`, ADRs `NNNN-name.md`, milestones `<M>0`, `<M>1`.
- References to code are paths relative to the repository root, for example
  `src/handlers/webhook.ts:41`.
- Dates use `YYYY-MM-DD`. No relative expressions such as "next week".
- <Only where the plan is mirrored to GitHub: tasks carry an `Issue:` link,
  `docs.config.json` holds the settings, and `project-docs:docs-sync` keeps the
  two in step.>
- <Anything else this project settles once: brand terms, a typography rule, a
  naming convention.>
```

**Rules.** Under 70 lines, and a map only — no content that has its own document. Two bullets under Conventions are load-bearing, because every other skill reads them from here: the documentation language, and the milestone label.

"Other directories" is what keeps this a map of the whole folder rather than of the three folders this method created. A brandbook, a client's process notes, an archived tracking file — one row each, saying plainly when something is a neighbouring subject rather than part of this project. A reader who finds a folder the map does not mention stops trusting the map.
