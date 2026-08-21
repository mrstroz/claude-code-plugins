---
name: docs-task
description: Run a task from docs/plan/ end to end, and close the documentation loop so docs/spec, docs/adr and docs/plan keep describing what the code actually does. Two entry points. Starting work — "zrób APP-12", "weź następne zadanie", "co teraz", "kontynuuj plan", "zacznij M2", "do HUE-21", "next task", "what should I work on", "continue the plan", or any request to implement something that has an entry in docs/plan, including when no task number is given, in which case pick the first unblocked one and say why. Finishing work — use it just as firmly after any change lands in a project that has docs/spec, docs/adr and docs/plan, whether it was planned or not: a feature, a fix, a refactor, a dependency change, a decision made in conversation. Triggers on "zaktualizuj dokumentację", "odzwierciedl to w docs", "zrobiłem X, popraw docs", "to już nieaktualne", "dopisz to do planu", "sprawdź czy dokumentacja się zgadza", "update the docs", "sync the docs", "the spec is out of date", "reconcile the documentation", and on simply reaching the end of a piece of work before proposing a commit. Reads every linked spec section and ADR in full before writing code, checks dependencies and blockers, then updates spec, ADR, blocker status, checkbox and roadmap in that order and stages a proposed commit without committing. This is what stops the plan and the spec drifting away from the code. Do NOT use to create the documentation tree in the first place — that is project-docs:docs-init.
argument-hint: "[task id, or a description of what was done]"
---

# Running a task, and closing the documentation loop

In a project built this way the documentation governs: `docs/spec/` says **what**, `docs/adr/` says **why**, `docs/plan/` says **when and what now**. Code is the last step of a task, and a task is not finished until the documentation describes what actually got built.

Read `docs/plan/README.md` once per session if you have not already. It carries this project's own task format, its definition of done and where its blockers resolve — all project-specific, and all of them beat anything assumed here.

Two things to settle before writing into the tree, because getting them wrong shows up in every file you touch:

- **The language** is recorded in `docs/README.md` under Conventions.
- **The words** come from the vocabulary table in `${CLAUDE_PLUGIN_ROOT}/skills/docs-init/references/headings.md`. Every literal in this skill — `Done`, `Rejected`, `Blocker`, `Depends on`, "State today", `M1` — is the English column. A Polish tree writes `Zrobione`, `Odrzucone`, `Blokada`, `Zależy od`, „Stan na dziś", and whatever milestone label that project chose. Take them from the table rather than translating as you go, or one file starts reading differently from its neighbours.

## Which mode

**Mode A — a task from the plan.** The user named a task id, asked what to work on, or asked to implement something that has an entry in `docs/plan/`.

**Mode B — work that already happened.** Code changed and the documentation has not caught up yet. Planned or unplanned, yours or someone else's, one commit or two weeks of them.

Both end in the same closing sequence. That sequence is the point of this skill.

---

## Mode A: run a task from the plan

### 1. Find it

Start at `docs/plan/roadmap.md`, section "State today". It names the current milestone and what is next. Then open the milestone file and find the entry.

With no task id given ("next task", "co teraz"), collect the tasks that are **ready** — unticked, every "Depends on" entry ticked, and the "Blocker" row, if there is one, done in the cross-repo status table. Among those take the highest priority: `(^)`, then `(=)`, then `(v)`, with a missing token counting as `(=)`. Ties break on plan order.

Two guards, because priority must not quietly rewrite a dependency-ordered plan. Never reach into a later milestone while the current one still has ready work — priority sorts within the milestone, it does not skip it. And never offer a `- [-]` task: that work was rejected on purpose, and picking it up is a decision the user makes explicitly, not something a selection rule does for them.

Say which task you are taking and why before you start — if the choice is wrong, that sentence is where the user catches it, and it costs nothing.

For an overview of everything left rather than the next thing to do, that is `project-docs:docs-summary`.

### 2. Four checks before a line of code

The plan entry is a pointer, not a specification. All four checks are cheap; skipping them is not.

- **Read every linked spec section and every linked ADR in full.** That is where the contract is. Implementing from the task title alone is the easiest way to build the wrong thing with complete confidence.
- **Dependencies.** If a task in "Depends on" is not ticked, stop and say what goes first. Work done out of order usually gets rewritten.
- **Blockers.** A blocker is something outside the plan that has to land first, and `docs/plan/README.md` says where its status lives: the cross-repo dependencies table when other repositories are involved, the open-questions table in `spec/00` when the project is waiting on a person instead. Read the status there. A single-repo project has no dependencies document and its blockers still resolve, so do not go looking for a file the tree never had. If the blocker is not cleared, the task cannot be finished today — say so before starting, not halfway through.
- **Gaps.** When the spec does not answer a question you have to resolve, do not invent behaviour and do not quietly pick something reasonable. Extend the spec first, confirm with the user if the decision is theirs, then implement.

### 3. While you work

**The spec beats instinct.** If instinct is clearly better than the spec, that is a signal to change the spec, discuss it, and only then write code. In that order.

**Verify claims about other repositories against their code, not from memory.** Documentation here was true when it was written; sibling repositories move. Finding a mismatch and fixing the document is part of the task, not a detour from it.

**Hold the scope.** Work that surfaces mid-task and does not belong to it becomes a new task with the next free id and a priority token, in whichever milestone fits. Inflating the current task hides the cost and breaks the one-task-one-commit rhythm.

### 4. Close the loop

Run [the closing sequence](#the-closing-sequence) at the end of this file. It is not optional and the order matters.

### 5. Report

Once the sequence is done. Short and concrete: what was built, which documents changed and why, what broke or surprised you, which task is next. No summarising code the user can read. End with the proposed commit message and wait.

---

## Mode B: make the documentation match what happened

Establish what actually changed before writing anything. `git diff`, `git status`, and `git log` since `docs/` was last touched. Read the code, not the user's summary of it — the summary is what they meant to do, the diff is what happened.

Then put every change in exactly one bucket:

| What changed | Where it goes |
|---|---|
| How the system behaves | The spec section that describes it. Correct that section; do not append a new one |
| A choice with a rejected alternative | The ADR that owns that decision, edited so it reads as the decision in force. A new ADR only when the decision is new, or replaced outright |
| Work that was a plan task | Tick its checkbox |
| Work that was never in the plan | Add it to the plan with the next free id and a priority token, already ticked, so the numbering and the history stay honest |
| Work we decided not to do | Its checkbox becomes `- [-]`, its title is struck through, and a `**Rejected YYYY-MM-DD.**` note says why. Never delete the entry and never reuse the number |
| Something a task was blocked on moved | Its status, wherever `plan/README.md` says blockers resolve |
| None of the above | **Nothing.** Say so and move on |

That last row carries weight. Formatting, a typo, a dependency bump that changes no documented behaviour, an internal rename — none of it belongs in the spec. A skill that manufactures a documentation change on every occasion teaches the user to skim past its proposals, and then the real ones get skimmed too.

Then run the closing sequence.

For a project whose documentation has drifted over days or weeks rather than one change, read [references/catch-up.md](references/catch-up.md) first.

---

## The closing sequence

The order follows from the spec being the source and everything else pointing at it. This is the part that rots fastest and hurts most, because a stale plan is worse than no plan.

1. **`docs/spec/`** — if the implemented behaviour differs from what is written. Always first. Correct the section that owns the behaviour; do not add a parallel one.
2. **`docs/adr/`** — only if a decision was involved. Settle first whether this is still the same decision; a changed parameter, name or implementation detail usually is. If it is, edit that ADR so its body states the decision in force, and keep the superseded one only as a short `## Decision History` line where it still explains why the architecture looks the way it does. A decision replaced outright becomes a new ADR, and the old one's status changes. An `## Amendment` section on an older ADR — `## Sprostowanie` in a Polish tree — predates this convention: fold it into the body and delete it, or move one line of it into `## Decision History`. Update the register table in `docs/adr/README.md` and the ADR table in `docs/README.md` when a new one is added or a status changes.
3. **The blocker's status** — if the thing a task was waiting on moved. Whichever table `docs/plan/README.md` points at: the cross-repo status column, or the open question in `spec/00` that the client has now answered. An answered question is resolved into the document that needed it and then leaves the list, which is open work rather than an archive.
4. **The task checkbox** — `- [ ]` to `- [x]`. If the task deserves a note, add `**Done YYYY-MM-DD.**` after it, capped at two sentences: it earns its place when it stops someone "fixing" something deliberate, or records a measurement nobody will repeat. A task that was dropped rather than finished goes `- [ ]` to `- [-]` instead, with its title struck through and a `**Rejected YYYY-MM-DD.**` note — that one is mandatory, and "not needed" is not a reason.
5. **`docs/plan/roadmap.md`** — **replace** the "State today" rows, do not append to them. One task in "Last completed", never a chain of them. "Next" may name more than one when milestones run in parallel and several things are genuinely unblocked at once, but each gets a clause saying why it is next, and that is the cap. The milestone progress counter in the milestones table changes too: rejected tasks leave the denominator and are counted after it, `4/6, 1 rejected`, so the milestone can still reach its own total.

   Then read the rest of the file, because the history you just kept out of the cell has somewhere else to go. Two checks, both of which catch drift that no single edit introduced:

   - **The milestones table carries counters and outcomes, nothing else.** A prose paragraph under it that has grown into "APP-75 arrived after APP-70, APP-73 reopened M1, APP-50 was dropped…" is the banned cell one section lower. Each of those facts belongs on its own task as a `**Done**` annotation, where the person reading that task will find it.
   - **The row labels match the vocabulary table.** A roadmap whose first row says `Faza` where the rest of the tree says `Etap` reads as a different document, and the drift is invisible from inside the file.
6. **Stage and propose, do not commit.** `git add` everything, propose a commit message in English carrying the task id (`feat: WH-09 deduplicate webhook events by event id`), and stop. The user reviews the staged changes and approves the commit themselves. Documentation goes in the same commit as the code — that is what keeps the two from drifting.

**If the task ends unfinished:** say what is done, leave the checkbox unticked, and annotate the task with the reason (`Blocker: …`). A plan ticked optimistically lies, and a lying plan is worse than an empty one.

## Allocating a new task id

Grep the whole of `docs/plan/` for the prefix, take the highest number, add one:

```bash
rg -o '\*\*`?WH-[0-9]+`?\*\*|`WH-[0-9]+`' docs/plan/ | rg -o '[0-9]+' | sort -n | tail -1
```

The backticked forms are there because a roadmap often writes an id inside a link as ``[`WH-68`](…)``, and a grep that only knows `**WH-68**` would miss the newest task in exactly the file that names it first.

Never count tasks and never restart numbering per milestone. Numbers run continuously through the project and are never reused: an abandoned task stays on the list as `- [-]` with a dated reason, a moved task keeps its number. Reusing a number silently breaks every reference to the old one.

A new task carries a priority token from the start. `(^)` only when the rest of the milestone waits on it — what goes first, not what is necessary, since almost everything in a milestone is necessary. No more than a third of the milestone's *open* tasks, or the marker stops meaning anything.

In a plan where no task carries a token at all, a single new one sorts nothing and only makes the plan look half-converted. Either leave it off and match the file, or offer to assign tokens across the milestone in one pass. Both are fine; the mixture is what is not.

## Writing the documents

Before editing anything under `docs/`, invoke `project-docs:docs-style`. It carries the length ceilings and the structural rules, and the roadmap cap in step 5 is one of them.

If for any reason you write without it, the non-negotiables are: every claim about behaviour points at a file you opened; enumerable facts go in tables; section numbers are addresses so you append rather than renumber; the spec states the system as it is now rather than the change that produced it; an ADR stays under 80 lines and a spec document under 280, and neither has a floor to reach; the em dash is punctuation, not glue; and nothing goes in that could be deleted without losing information.
