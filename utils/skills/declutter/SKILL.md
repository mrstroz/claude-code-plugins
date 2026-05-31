---
name: declutter
description: Tighten and declutter an existing document so a human can read it fast — cut filler, repetition, throat-clearing, and marketing fluff while keeping every fact, decision, number, and caveat, and keeping the language natural (no jargon, no telegraphic shortcuts). Use when a document (especially one drafted by AI) is bloated, padded, or slow to skim — e.g. the user says "uporządkuj ten dokument", "to jest za długie", "skróć to ale nie gub treści", "wytnij lanie wody", "this doc is bloated", "cut the fluff", "make this readable", "too verbose", "remove the AI slop" — or just generated a long README / spec / report / proposal / release notes / JIRA description and wants it trimmed. Also trigger right after producing a long document, to offer a tightened pass. Do NOT use for writing a new document from scratch, for summaries that intentionally drop information, for translation, or for editing code.
---

# Declutter

One job: make an existing document shorter to *read*, not harder to read. AI drafts pad themselves with filler, repetition, and throat-clearing; strip that so a person can move through every paragraph quickly and each one pays them back. Cut ruthlessly, but never at the cost of meaning or a natural voice.

## The line you're walking

Two failure modes — avoid both:

- **Too timid** — you reword a little but the bloat survives. The reader still wastes time, so the skill did nothing.
- **Too brutal** — you compress prose into dense, jargon-y, telegraphic fragments ("launch postponed — API blocker; revisit Q3"). It's shorter but slower to parse and reads like a robot.

Aim for the middle: fewer words, full and natural sentences, nothing of substance lost. "We postponed the launch because the API wasn't ready" is already tight and clear — leave it. You're removing the paragraph of preamble *around* a sentence like that, not crushing the sentence itself. The goal is less to read, not harder to read.

## Workflow

1. **Find the target** — a file path, pasted text, or "the doc you just wrote." If it's unclear which document, ask before touching anything.
2. **Read the whole thing first** and note its purpose and its reader. Value is relative to purpose: you can't judge what earns its place until you know what the document is *for* and who skims it. A runbook, a design spec, and a launch announcement each keep different things.
3. **Cut and tighten** per the rules below.
4. **Apply directly.** If it's a file, edit it in place — git is the safety net. If it's pasted text or has no file, return the tightened version inline.
5. **Leave a short note** of what you cut — two or three lines, e.g. *"Cut: repeated intro/summary, three filler transitions, a marketing-tone conclusion. Kept all steps, the numbers, and the rollback caveat."* This earns trust, because you're removing the user's content. Keep the note short so it doesn't become new bloat.

## What to cut

- **Throat-clearing and preamble** — "In today's fast-paced world…", "It's important to note that…", "As we can see…". Start at the first sentence that actually says something.
- **Restating the question or the obvious** — echoing the prompt back, or explaining what the reader already knows.
- **Redundant summaries** — the same point made in the intro, the body, *and* the conclusion. Say it once, where it lands best. Empty conclusions ("In summary, X is a powerful tool that…") usually go entirely.
- **Filler qualifiers** — "generally speaking", "it's worth noting", "in many cases", "as mentioned above". They add length, not information.
- **Fluff adjectives and corpo verbs** — "powerful", "seamless", "robust", "comprehensive", "leverage", "utilize", "facilitate". Use the plain word or delete it.
- **Wordy constructions** — "in order to" → "to", "due to the fact that" → "because", "make a decision" → "decide". Tightening the sentence, not abbreviating it into code.
- **Padding lists** — bullets that restate each other, or trivial/obvious items added to look thorough. Merge or drop them.
- **Hollow sections** — a heading that exists for structural symmetry but covers nothing the reader needs. Remove the section, don't just trim it.

The same logic applies in any language — these examples are English, but if the document is Polish, German, etc., cut the equivalent filler there ("warto zauważyć, że…", "w dzisiejszych czasach…", "należy podkreślić, że…") and keep the result in the document's original language.

## What to keep — when in doubt, keep

Removing real information is worse than leaving a little fluff. A surviving filler line costs the reader seconds; a deleted constraint costs them a mistake. Protect:

- **Facts, numbers, names, dates, links** — verbatim.
- **Decisions and the reason behind them** — the *why* is often the single highest-value sentence in the document.
- **Steps, commands, and code blocks** — copy code and commands exactly; never paraphrase them.
- **Caveats and constraints that change what the reader does** — edge cases, gotchas, "don't do X".
- **Tables** — usually already dense; leave them unless a column is pure noise.

If you can't tell whether a sentence is substance or fluff, keep it.

## Don't

- Don't invent, add, or "improve" claims — you're editing, not rewriting the argument.
- Don't change meaning or soften a strong, accurate statement into something vague.
- Don't convert readable prose into bullet fragments just to look shorter. Use a list only when the items are genuinely parallel; otherwise flowing prose is faster to read.
- Don't touch code, commands, quotes, or data inside the document.
- Don't change the document's format or language.

## Calibrate to the document

- **Specs, runbooks, legal text — anything where precision matters** — cut filler, but err toward keeping detail.
- **Reports, READMEs, proposals, announcements** — cut hard; these bloat the most.

Default: aggressive on fluff, conservative on substance.

## Example

**Before** (~75 words):

> ## Overview of the Migration
> In today's data-driven landscape, database migrations are an incredibly important and critical task. It is worth noting that this migration moves us from MySQL to PostgreSQL. The reason we are doing this is because PostgreSQL offers more robust support for JSON columns, which our team will be able to leverage going forward. One important thing to keep in mind is that the migration must run during off-peak hours in order to avoid downtime for our users.

**After** (~30 words):

> ## Migration: MySQL → PostgreSQL
> We're moving to PostgreSQL for its stronger JSON column support. Run the migration during off-peak hours to avoid user-facing downtime.

The decision, the reason, and the caveat all survive in plain sentences. What's gone is the scene-setting, "incredibly important and critical", "it is worth noting", "leverage going forward", and "in order to" — none of which told the reader anything.
