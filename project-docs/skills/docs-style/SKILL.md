---
name: docs-style
description: Writing rules for spec, ADR and plan documents — short, checkable, scannable, plain language, with hard length budgets and every claim about system behaviour pointing at code someone actually opened. Read this before writing the first paragraph, not after; fixing a finished draft costs more than drafting it right. Use when adding or rewriting a spec section, opening an ADR or amending an accepted one, writing a plan task or a milestone file, editing docs/README.md or a roadmap, or reviewing documentation someone else wrote. Triggers on "dopisz do spec", "zrób ADR", "opisz to w dokumentacji", "napisz specyfikację", "dodaj zadanie do planu", "popraw ten dokument w docs", "uporządkuj dokumentację projektu", "ta specyfikacja jest za długa", "add this to the spec", "write an ADR for this", "document this decision", "clean up the project docs", "the spec is too long". Works in Polish and English; CLAUDE.md stays English either way. Do NOT use for blog posts, landing copy, release notes or user-facing READMEs (that is utils:humanize-content), or for trimming a document that is not part of a spec/ADR/plan tree (utils:declutter).
---

# Writing docs/ so people actually read it

Two readers open these documents: a person who needs an answer in thirty seconds, and an agent that will implement exactly what is written. Both trip over the same three things — padding, generalities, and claims nobody checked. Everything below follows from that.

## Three properties

**Checkable.** Every sentence about how the system behaves points at the code that proves it: a path, and a line number where that helps. A claim you have not verified does not go in. When something cannot be verified, write down plainly what is unknown and how to settle it — an honest gap is useful, a confident guess is a trap that costs someone a day.

**Scannable.** Facts that can be enumerated go in tables. Decisions go in short numbered sections. Everything else goes in paragraphs of two or three sentences. A reader hunting one detail should find it without reading its neighbours.

**No padding.** If cutting a sentence loses nothing, that sentence carried nothing. This is not the same as being terse: the reason behind a decision earns its space, an announcement that a reason is coming does not.

## Length budgets

Rules without numbers do not hold. A document drifts one paragraph at a time, and nobody ever notices the paragraph that broke it — so the limits are explicit:

| File | Budget | Past the budget means |
|---|---|---|
| `adr/NNNN-*.md` | 40–80 lines | The decision is really two decisions, or Context has become a history lesson |
| `spec/NN-*.md` | 120–280 lines | The area should be split into two numbered documents |
| `plan/NN-*.md` (milestone) | under 150 lines | The milestone should have been two milestones |
| `plan/roadmap.md` | under 120 lines | See the roadmap rule below |
| `plan/README.md` | under 80 lines | Project-specific rules are leaking in from the spec |
| `docs/README.md` | under 70 lines | It stopped being a map and started holding content |
| `adr/README.md` | under 40 lines + the register | |
| One plan task | 2–4 lines | The task is too large; split it |

**The roadmap rule.** Whoever finishes a task **replaces** the "State today" cell — never appends to it. History belongs in git and in the per-task annotations. A cell that accumulates one entry per session becomes the longest thing in the repository inside a week, and then nobody reads the one place everyone was supposed to start.

Three rows are mandatory in "State today": the current milestone, the last completed task, and what is next. Add a fourth row only for a fact somebody needs at the start of *every* session and that lives nowhere else — a deployed URL, a standing blocker, something you are waiting on from the user.

## Shape by document type

| Type | Shape |
|---|---|
| `spec/NN-*.md` | Numbered sections `## N. Title`. A short opening with no ceremony, tables for anything enumerable, "Out of scope" at the end. The section number is an address: never renumber, append |
| `adr/NNNN-*.md` | The template in `adr/template.md`: status table, Context, Decision, Consequences split into positive / negative / requirements, Options considered with the reason each was rejected, When to revisit |
| `plan/NN-*.md` | Goal, end of milestone, external dependencies, the task list, optional Notes |
| One task | Checkbox, id, title, a link to the spec section carrying its number, "Depends on", "Done when" where the condition is not obvious from the title |
| `README.md` anywhere | A map and nothing else: what lives where, and where to start. No content that has its own document |

An optional `**Done YYYY-MM-DD.**` annotation may follow a ticked task, capped at two sentences. It earns its place when it stops someone "fixing" something that was deliberate, or records a measurement nobody will repeat. Anything longer belongs in the milestone's `## Notes`, and most of it belongs nowhere.

## Four structural rules

These are not style. They are why the system holds together, and breaking one costs a refactor later.

1. **Section numbers are addresses.** Append new sections; never renumber existing ones. Every link in the tree points at a number.
2. **Links run one way:** `plan/` → `spec/` and `adr/`, never the reverse. So a spec correction never forces a plan edit, and moving a task never touches the spec.
3. **An accepted ADR is never rewritten.** A factual correction goes in as a `## Amendment (YYYY-MM-DD)` section at the end. A changed mind is a *new* ADR that supersedes the old one, and the old one's status becomes "Superseded by ADR-NNNN". The point is that in six months you can reconstruct the decision together with what turned out to be wrong about it.
4. **A plan task never describes behaviour.** It links to the spec section that does. A task that explains how something works is a spec section wearing a checkbox.

## Language and typography

- Dates as `YYYY-MM-DD`, never relative. "Next week" means nothing in a file six months from now.
- Short sentences, one thought each, varied in length so the text does not read like a metronome.
- No adjectives that judge instead of describing: key, solid, modern, powerful, robust, seamless.
- Terminology matches the glossary in `spec/00`. One name per thing, everywhere.
- The em dash belongs only where it is correct punctuation — a genuine aside, or a dropped verb. As universal glue between clauses it is the loudest signal of machine-written text; a colon, a comma or a full stop is almost always better. Inside table cells it is fine.
- The document's language is recorded in `docs/README.md` under Conventions. Do not mix languages inside one file; literal names of fields and sections are the exception. `CLAUDE.md` stays English regardless, because it is read from sibling repositories.

Polish documents carry extra rules — quotation marks `„ "`, and the pauza is stricter than the English em dash. See [references/language-pl.md](references/language-pl.md).

## Cross-references

- Links between documents are relative, and the link text carries the section number: `[04 §3](../spec/04-auth-and-session.md#3-session-storage)`. When a heading changes and the anchor breaks, `04 §3` still leads to the right place.
- Anchors only for short headings. For something like "4.3. Layer 2: the app (live since the first release)", link the file and leave the number in the text.
- Code in *other* repositories is plain text, never a link: `some-api/modules/order/forms/OrderForm.php:45`. They are separate repositories, so a relative link would mislead.
- At most two linked documents per task. More than that means the task is too big.

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
5. Links and anchors checked, including the section numbers in the link text.
6. No sentence that can be deleted without losing information.
7. Inside its length budget. Over budget is a signal about structure, not a prompt to compress the prose.

A bloated document that is already written goes through `utils:declutter`. A long one that reads stiffly goes through `utils:humanize-content`.

Worked examples of each document type, good and bad side by side: [references/examples.md](references/examples.md).
