---
name: docs-task
description: Run a task from docs/plan/ end to end, and close the documentation loop so docs/spec, docs/adr and docs/plan keep describing what the code actually does. Two entry points. Starting work — "zrób APP-12", "weź następne zadanie", "co teraz", "kontynuuj plan", "zacznij M2", "do HUE-21", "next task", "what should I work on", "continue the plan", or any request to implement something that has an entry in docs/plan, including when no task number is given, in which case pick the first unblocked one and say why. Finishing work — use it just as firmly after any change lands in a project that has docs/spec, docs/adr and docs/plan, whether it was planned or not: a feature, a fix, a refactor, a dependency change, a decision made in conversation. Triggers on "zaktualizuj dokumentację", "odzwierciedl to w docs", "zrobiłem X, popraw docs", "to już nieaktualne", "dopisz to do planu", "sprawdź czy dokumentacja się zgadza", "update the docs", "sync the docs", "the spec is out of date", "reconcile the documentation", and on simply reaching the end of a piece of work before proposing a commit. Reads every linked spec section and ADR in full before writing code, checks dependencies and blockers, then updates spec, ADR, cross-repo status, checkbox and roadmap in that order and stages a proposed commit without committing. This is what stops the plan and the spec drifting away from the code. Do NOT use to create the documentation tree in the first place — that is project-docs:docs-init.
argument-hint: "[task id, or a description of what was done]"
---

# Running a task, and closing the documentation loop

In a project built this way the documentation governs: `docs/spec/` says **what**, `docs/adr/` says **why**, `docs/plan/` says **when and what now**. Code is the last step of a task, and a task is not finished until the documentation describes what actually got built.

Read `docs/plan/README.md` once per session if you have not already. It carries this project's own task format and its definition of done, which are project-specific and beat anything assumed here.

## Which mode

**Mode A — a task from the plan.** The user named a task id, asked what to work on, or asked to implement something that has an entry in `docs/plan/`.

**Mode B — work that already happened.** Code changed and the documentation has not caught up yet. Planned or unplanned, yours or someone else's, one commit or two weeks of them.

Both end in the same closing sequence. That sequence is the point of this skill.

---

## Mode A: run a task from the plan

### 1. Find it

Start at `docs/plan/roadmap.md`, section "State today". It names the current milestone and what is next. Then open the milestone file and find the entry.

With no task id given ("next task", "co teraz"), take the first unticked task whose "Depends on" entries are all ticked and whose "Blocker", if it has one, is done in the cross-repo status table. Say which task you are taking and why before you start — if the choice is wrong, that sentence is where the user catches it, and it costs nothing.

### 2. Four checks before a line of code

The plan entry is a pointer, not a specification. All four checks are cheap; skipping them is not.

- **Read every linked spec section and every linked ADR in full.** That is where the contract is. Implementing from the task title alone is the easiest way to build the wrong thing with complete confidence.
- **Dependencies.** If a task in "Depends on" is not ticked, stop and say what goes first. Work done out of order usually gets rewritten.
- **Blockers.** If the task has "Blocker: FE-2" or similar, check that row's status in the cross-repo spec document. If it is not done, the task cannot be finished today. Say so before starting, not halfway through.
- **Gaps.** When the spec does not answer a question you have to resolve, do not invent behaviour and do not quietly pick something reasonable. Extend the spec first, confirm with the user if the decision is theirs, then implement.

### 3. While you work

**The spec beats instinct.** If instinct is clearly better than the spec, that is a signal to change the spec, discuss it, and only then write code. In that order.

**Verify claims about other repositories against their code, not from memory.** Documentation here was true when it was written; sibling repositories move. Finding a mismatch and fixing the document is part of the task, not a detour from it.

**Hold the scope.** Work that surfaces mid-task and does not belong to it becomes a new task with the next free id, in whichever milestone fits. Inflating the current task hides the cost and breaks the one-task-one-commit rhythm.

### 4. Close the loop

The sequence below. It is not optional and the order matters.

### 5. Report

Short and concrete: what was built, which documents changed and why, what broke or surprised you, which task is next. No summarising code the user can read. End with the proposed commit message and wait.

---

## Mode B: make the documentation match what happened

Establish what actually changed before writing anything. `git diff`, `git status`, and `git log` since `docs/` was last touched. Read the code, not the user's summary of it — the summary is what they meant to do, the diff is what happened.

Then put every change in exactly one bucket:

| What changed | Where it goes |
|---|---|
| How the system behaves | The spec section that describes it. Correct that section; do not append a new one |
| A choice with a rejected alternative | A new ADR, or `## Amendment (YYYY-MM-DD)` on an existing one if it is a factual correction rather than a change of mind |
| Work that was a plan task | Tick its checkbox |
| Work that was never in the plan | Add it to the plan with the next free id, already ticked, so the numbering and the history stay honest |
| A dependency in another repository moved | Its row's status column |
| None of the above | **Nothing.** Say so and move on |

That last row carries weight. Formatting, a typo, a dependency bump that changes no documented behaviour, an internal rename — none of it belongs in the spec. A skill that manufactures a documentation change on every occasion teaches the user to skim past its proposals, and then the real ones get skimmed too.

Then run the closing sequence.

For a project whose documentation has drifted over days or weeks rather than one change, read [references/catch-up.md](references/catch-up.md) first.

---

## The closing sequence

The order follows from the spec being the source and everything else pointing at it. This is the part that rots fastest and hurts most, because a stale plan is worse than no plan.

1. **`docs/spec/`** — if the implemented behaviour differs from what is written. Always first. Correct the section that owns the behaviour; do not add a parallel one.
2. **`docs/adr/`** — only if a decision was involved. An accepted ADR is not rewritten: a factual correction goes in as `## Amendment (YYYY-MM-DD)`, a change of mind becomes a new ADR that supersedes it, and the old one's status changes. Update the register table in `docs/adr/README.md` and the ADR table in `docs/README.md` when a new one is added or a status changes.
3. **Cross-repo status column** — if something moved in another repository.
4. **The task checkbox** — `- [ ]` to `- [x]`. If the task deserves a note, add `**Done YYYY-MM-DD.**` after it, capped at two sentences: it earns its place when it stops someone "fixing" something deliberate, or records a measurement nobody will repeat.
5. **`docs/plan/roadmap.md`** — **replace** the "State today" rows, do not append to them. One task in "Last completed", not a history. The milestone progress counter in the milestones table changes too.
6. **Stage and propose, do not commit.** `git add` everything, propose a commit message in English carrying the task id (`feat: WH-09 deduplicate webhook events by event id`), and stop. The user reviews the staged changes and approves the commit themselves. Documentation goes in the same commit as the code — that is what keeps the two from drifting.

**If the task ends unfinished:** say what is done, leave the checkbox unticked, and annotate the task with the reason (`Blocker: …`). A plan ticked optimistically lies, and a lying plan is worse than an empty one.

## Allocating a new task id

Grep the whole of `docs/plan/` for the prefix, take the highest number, add one:

```bash
rg -o '\*\*WH-[0-9]+\*\*' docs/plan/ | rg -o '[0-9]+' | sort -n | tail -1
```

Never count tasks and never restart numbering per milestone. Numbers run continuously through the project and are never reused: an abandoned task stays on the list with a note, a moved task keeps its number. Reusing a number silently breaks every reference to the old one.

## Writing the documents

Before editing anything under `docs/`, invoke `project-docs:docs-style`. It carries the length budgets and the structural rules, and the roadmap cap in step 5 is one of them.

If for any reason you write without it, the non-negotiables are: every claim about behaviour points at a file you opened; enumerable facts go in tables; section numbers are addresses so you append rather than renumber; an ADR is 40–80 lines and a spec document 120–280; the em dash is punctuation, not glue; and nothing goes in that could be deleted without losing information.
