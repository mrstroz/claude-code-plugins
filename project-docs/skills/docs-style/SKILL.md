---
name: docs-style
description: Writing rules for spec, ADR and plan documents — short, checkable, scannable, plain language, with hard length budgets and every claim about system behaviour pointing at code someone actually opened. Read this before writing the first paragraph, not after; fixing a finished draft costs more than drafting it right. Use when adding or rewriting a spec section, opening an ADR or updating an accepted one, writing a plan task or a milestone file, editing docs/README.md or a roadmap, or reviewing documentation someone else wrote. Triggers on "dopisz do spec", "zrób ADR", "opisz to w dokumentacji", "napisz specyfikację", "dodaj zadanie do planu", "popraw ten dokument w docs", "uporządkuj dokumentację projektu", "ta specyfikacja jest za długa", "add this to the spec", "write an ADR for this", "document this decision", "clean up the project docs", "the spec is too long". Works in Polish and English; CLAUDE.md stays English either way. Do NOT use for blog posts, landing copy, release notes or user-facing READMEs (that is utils:humanize-content), or for trimming a document that is not part of a spec/ADR/plan tree (utils:declutter).
---

# Writing docs/ so people actually read it

Two readers open these documents: a person who needs an answer in thirty seconds, and an agent that will implement exactly what is written. Both trip over the same three things — padding, generalities, and claims nobody checked. Everything below follows from that.

## Three properties

**Checkable.** Every sentence about how the system behaves points at the code that proves it: a path, and a line number where that helps. A claim you have not verified does not go in. When something cannot be verified, write down plainly what is unknown and how to settle it — an honest gap is useful, a confident guess is a trap that costs someone a day.

**Scannable.** Facts that can be enumerated go in tables. Decisions go in short numbered sections. Everything else goes in paragraphs of two or three sentences. A reader hunting one detail should find it without reading its neighbours.

**No padding.** If cutting a sentence loses nothing, that sentence carried nothing. This is not the same as being terse: the reason behind a decision earns its space, an announcement that a reason is coming does not.

## Length ceilings

Rules without numbers do not hold. A document drifts one paragraph at a time, and nobody ever notices the paragraph that broke it — so the limits are explicit:

| File | Ceiling | Past it means |
|---|---|---|
| `adr/NNNN-*.md` | 80 lines | The decision is really two decisions, or Context has become a history lesson |
| `spec/NN-*.md` | 280 lines | The area should be split into two numbered documents |
| `plan/NN-*.md` (milestone) | 150 lines | The milestone should have been two milestones |
| `plan/roadmap.md` | 120 lines | See the roadmap rule below |
| `plan/README.md` | 80 lines | Project-specific rules are leaking in from the spec |
| `docs/README.md` | 70 lines | It stopped being a map and started holding content |
| `adr/README.md` | 40 lines plus the register | |
| One plan task | 4 lines, 5 with a context line | The task is too large; split it |

**Short is not a defect.** These are ceilings, not ranges. A floor would only invite padding into files whose own rule is that nothing goes in that could be deleted, and well-kept trees are full of honest 50-line spec sections and 20-line ADRs. Read brevity as a prompt to check two things rather than to write: an ADR under 40 lines usually means the Options table is missing or Context carries no measurement, and a spec section under 100 usually means the tables are there and the paragraph saying where the boundary falls is not. Check those, then leave it short if it is honest.

**One exception to the ceiling.** A catalog — one entry per block, per endpoint, per screen — legitimately runs long, and splitting it at a line count puts half the entries in one file and half in another, which is worse than a long file. Split it by entry group or leave it long and keep the entries uniform so it stays navigable. An area document at 400 lines is still two areas.

**The roadmap rule.** Whoever finishes a task **replaces** the "State today" cell — never appends to it. History belongs in git and in the per-task annotations. A cell that accumulates one entry per session becomes the longest thing in the repository inside a week, and then nobody reads the one place everyone was supposed to start.

Three rows are mandatory in "State today": the current milestone, the last completed task, and what is next. Add a fourth row only for a fact somebody needs at the start of *every* session and that lives nowhere else — a deployed URL, a standing blocker, something you are waiting on from the user.

## Shape by document type

| Type | Shape |
|---|---|
| `spec/NN-*.md` | Numbered sections `## N. Title`. A short opening with no ceremony, tables for anything enumerable, "Out of scope" at the end. The section number is an address: never renumber, append |
| `adr/NNNN-*.md` | The template in `adr/template.md`: status table, Context, Decision, Consequences split into positive / negative / requirements, Options considered with the reason each was rejected, When to revisit, and `Decision History` at the end only where an earlier decision still explains the architecture |
| `plan/NN-*.md` | Goal, end of milestone, external dependencies, the task list, optional Notes |
| One task | Checkbox, priority token, id, title, a link to the spec section carrying its number, "Depends on", "Blocker" where something outside the plan has to land first, "Done when" where the condition is not obvious from the title, and `Issue` last where the tree mirrors its plan to GitHub. State lives in the checkbox — `[ ]` open, `[x]` done, `[-]` rejected — and the checkbox is what every document reads. A mirrored issue's open or closed state follows it; it never leads |
| `README.md` anywhere | A map and nothing else: what lives where, and where to start. No content that has its own document |

**Blocker** points at something outside the plan that has to land before the task can finish, and its status is tracked in exactly one place: the cross-repo dependencies table where other repositories are involved, the open-questions table in `spec/00` where the project is waiting on a person rather than a repository. `plan/README.md` records which, because a project with no sibling repositories still has blockers and needs somewhere to resolve them.

An optional `**Done YYYY-MM-DD.**` annotation may follow a ticked task, capped at two sentences. It earns its place when it stops someone "fixing" something that was deliberate, or records a measurement nobody will repeat.

An open task may carry **one context line** in the same position: why this task exists at all, or what a measurement showed. It is for the thing that would otherwise be lost — the review finding the task came out of, the number that made it worth doing. It is not room for how the system behaves; that link in the task already points at the spec section which owns it, and a task explaining behaviour is a spec section wearing a checkbox. Anything past one line belongs in the milestone's `## Notes`, and most of it belongs nowhere.

## Priority and rejected tasks

Two markers, both of them ASCII, both of them after the checkbox so that every grep written against `- [x]` keeps working:

```markdown
- [ ] (^) **APP-12** The /webhooks endpoint accepts events
- [-] (v) **APP-14** ~~CSV export of events~~
      **Rejected 2026-08-05.** The client exports from BI; a second export served nobody.
```

**Priority says what goes first, not what is necessary.** Almost every task in a milestone is necessary — that is why it is in the milestone — so "important" sorts nothing. `(^)` means everything else waits on this one: it is the spine of the milestone, and the day it slips the whole milestone slips. `(=)` is the default: required, but nothing is held up by it. `(v)` means the milestone closes without it, and it is the first thing moved out when the milestone gets tight. **At most a third of a milestone's *open* tasks may be `(^)`** — a list where everything is urgent orders nothing. Open is the denominator because priority sorts work that is still ahead of you; finished and rejected tasks keep whatever token they had, and counting them would let a milestone drift over the cap without a single new task. A missing token reads as `(=)`, so plans written before the marker existed stay valid.

**A rejected task is never deleted.** It becomes `- [-]`, its title struck through, with a mandatory `**Rejected YYYY-MM-DD.**` note giving the reason — "not needed" is not a reason. The id and the priority token stay: numbers are never reused, and every reference to this one has to keep resolving. Rejected tasks leave the roadmap's progress denominator and are counted after it, `4/6, 1 rejected`, so the milestone can still reach its own total.

## Five structural rules

These are not style. They are why the system holds together, and breaking one costs a refactor later.

1. **Section numbers are addresses.** Append new sections; never renumber existing ones. Every link in the tree points at a number.
2. **Links run one way:** `plan/` → `spec/` and `adr/`, never the reverse. So a spec correction never forces a plan edit, and moving a task never touches the spec.
3. **The spec is the current state, never its history.** When a requirement, a parameter, an architecture or a behaviour changes, edit the sentence that carries it and delete what stopped being true. No "changed", "correction", "update", "previously X", "changed from X to Y", and never the old value left standing beside the new one. Somebody reading the spec has to come away knowing how the system works now, without reconstructing how it got there. Git and the plan task carry the path it took.
4. **An ADR reads as the decision in force.** When the same decision changes in its details, edit Context, Decision, Consequences and Options to say what holds now; a correction is not a section of its own, and a superseded value does not stay next to the current one. Where the earlier decision still explains why the architecture looks the way it does, a short `## Decision History` at the end carries it: what held before, what replaced it, and why if that is not obvious. Never a copy of the old text, it counts against the 80 lines like everything else, and where the earlier decision explains nothing there is no such section. A *new* ADR is for a new decision, or one replaced outright — a changed parameter is the same decision.
5. **A plan task never describes behaviour.** It links to the spec section that does. A task that explains how something works is a spec section wearing a checkbox.

## Language and typography

- Dates as `YYYY-MM-DD`, never relative. "Next week" means nothing in a file six months from now.
- Short sentences, one thought each, varied in length so the text does not read like a metronome.
- No adjectives that judge instead of describing: key, solid, modern, powerful, robust, seamless.
- Terminology matches the glossary in `spec/00`. One name per thing, everywhere.
- The em dash belongs only where it is correct punctuation — a genuine aside, or a dropped verb. As universal glue between clauses it is the loudest signal of machine-written text; a colon, a comma or a full stop is almost always better. Inside table cells it is fine.
- The document's language is recorded in `docs/README.md` under Conventions. Do not mix languages inside one file; literal names of fields and sections are the exception. `CLAUDE.md` stays English regardless, because it is read from sibling repositories.
- Headings, status words and task labels come from the vocabulary table in `${CLAUDE_PLUGIN_ROOT}/skills/docs-init/references/headings.md`, not from translating on the fly. Every literal written out in these skills is the English column; the tree gets its own. One term per concept, or `spec/`, `plan/` and `adr/` stop reading as one document.

Polish documents carry extra rules — quotation marks `„ "`, and the pauza is stricter than the English em dash. See [references/language-pl.md](references/language-pl.md).

## Cross-references

- Links between documents are relative, and the link text carries the section number: `[04 §3](../spec/04-auth-and-session.md#3-session-storage)`. When a heading changes and the anchor breaks, `04 §3` still leads to the right place.
- Anchors only for short headings. For something like "4.3. Layer 2: the app (live since the first release)", link the file and leave the number in the text.
- Code in *other* repositories is plain text, never a link: `some-api/modules/order/forms/OrderForm.php:45`. They are separate repositories, so a relative link would mislead.
- At most two linked documents per task. More than that means the task is too big.
- An `Issue:` link is not one of those two. It points at a tracker, not at a document, so it neither explains the task nor counts against the limit — and it goes last on the metadata line, after `Spec`, `ADR`, `Depends on` and `Blocker`, so the eye reaching for the spec link stops before the URL rather than after it.

## What we don't write

**Warm-ups before the content.**
Bad: "This document aims to comprehensively describe the key aspects of the authentication process, which forms the foundation of application security."
Good: "The most important document in the spec. The session bridge is what makes an order placed in the app land on the user's account."

**Claims with nothing behind them.**
Bad: "The API probably checks token expiry."
Good: "The API verifies the signature only: `validationConstraints` in `api/config/components.php` lists just `SignedWith`, so a token with an expired `exp` passes."

**The dash as glue.**
Bad: "The app downloads the file — caches it — and opens the system viewer."
Good: "The app downloads the file, caches it and opens the system viewer."

**Done-conditions nobody can check.**
Bad: "Done when the screen works correctly."
Good: "Done when a 422 with `<br />` joined into the message renders as readable text."

**A table restated in prose.** When a table lists five statuses, the paragraph under it does not list them again. It says what the table cannot: why the boundary falls there, and what happens in the odd case.

**Rule-of-three flourishes** ("fast, reliable and convenient") and closing paragraphs that summarise what the reader just read.

## Before you call a document done

1. Every claim about the system points at code you actually opened.
2. Nothing duplicates another document; it links instead.
3. Tables where content can be enumerated, paragraphs where something needs justifying.
4. Section numbering untouched, new content appended rather than wedged between existing numbers.
5. No trace of the edit itself: nothing saying something was changed, corrected or updated, and no earlier value left standing next to the current one.
6. Links and anchors checked, including the section numbers in the link text.
7. No sentence that can be deleted without losing information.
8. Under its length ceiling. Over it is a signal about structure, not a prompt to compress the prose. Under it is not a problem to fix.

A bloated document that is already written goes through `utils:declutter`. A long one that reads stiffly goes through `utils:humanize-content`.

Worked examples of each document type, good and bad side by side: [references/examples.md](references/examples.md).
