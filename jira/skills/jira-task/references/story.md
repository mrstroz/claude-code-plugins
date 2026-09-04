# Story

Several pieces of work that are each useful on their own. Read [the shape of an
issue](sections.md) with this file. It says what goes in each section below, and this file only
says which sections a `Story` has and what changes when the work is split.

The test for reaching this file at all is whether each piece would still be worth shipping if the
others never happened. If yes, it is a `Story` with one subtask per piece. If no, it is one
[`Task`](task.md) that happens to be long.

```markdown
## TLDR

The capability, who gets it, and what makes it worth doing now. Two or three sentences.

## Out of scope

- what the feature deliberately leaves out

## Subtasks

- [<prefix>] first piece of work
- [<prefix>] second piece of work

## Acceptance criteria

- [ ] criteria for the feature as a whole, not for any single subtask

## Risk                                      (only when the configuration defines risk areas)

risk-<level> — one sentence naming the reason.

## Open questions                            (only when there are any)

## Demo                                      (only when there is a recording)
```

**A `Story` carries no `Findings`.** Technical detail belongs to whichever subtask it concerns,
and a finding sitting at the parent gets read by nobody working on a child. If something is true
of every piece, it is usually the constraint that made this a `Story`, and it belongs in `TLDR`.

The `Subtasks` section carries the split as titles, not keys. The reason, and the test a line has
to pass to be here at all, are in [`Subtasks`](sections.md#subtasks). Each subtask is then created
as its own issue with `--parent`, from its own draft in the [`Task`](task.md) shape.

Criteria at this level are for the feature as a whole. The temptation is to restate each subtask
as a criterion. Such a list is neither one thing nor the other: it duplicates `Subtasks`, and it
says nothing about whether the pieces together add up to the capability. Ask instead: if every
subtask were merged and the feature still did not work, what would be untrue?

## A worked example

A feature split into four pieces, each shippable alone: an export that only produces CSV is still
an export, and a scheduled report without the mail delivery still lands in the downloads list.
That is what makes it a `Story` rather than one long `Task`, and it is the only test that decided
the shape.

Watch where the positive statements went. An earlier draft had a `Scope` section listing the
formats, the scheduler and the mail; every one of those lines is a criterion in some tense, so
they moved. What was left was the two "leaves out" lines, which is `Out of scope` and nothing
else.

`TLDR` carries the constraint that runs through every piece, the ten-thousand-row ceiling,
because a finding true of all four belongs at the parent as context, not as a `Findings` section
the children will never read. The project defines risk areas, so `Risk` is there.

```markdown
[api+web] Let account owners export and schedule order reports

## TLDR

Account owners who want their order history outside the app ask support for a database extract,
which takes a day and arrives in whatever shape the engineer on duty chose. This gives them an
export they run themselves, in CSV or XLSX, on demand or on a schedule, delivered by mail. Every
piece has to work within the ten-thousand-row ceiling the current list endpoint already enforces.

## Out of scope

- exports for roles other than the account owner; the permission model for that is its own
  discussion
- historical orders older than the retention window, which the database no longer holds

## Subtasks

- [api] Add an order export endpoint that streams CSV
- [api] Add XLSX as a second export format on the same endpoint
- [web] Add the export button and format choice to the orders page
- [api+web] Schedule an export and deliver it by mail

## Acceptance criteria

- [ ] An account owner can download their orders as CSV and as XLSX from the orders page.
- [ ] An export of ten thousand orders finishes without the request timing out.
- [ ] A scheduled export arrives by mail at the chosen interval and also appears in the
      downloads list.
- [ ] No role other than the account owner sees the export controls or can call the endpoint.

## Risk

risk-medium — it adds a scheduled job and outbound mail, both listed as medium areas, and it
reads order data across the whole account rather than one page of it.

## Open questions

- Q1: Does a scheduled export that produces zero rows still send a mail?
```
