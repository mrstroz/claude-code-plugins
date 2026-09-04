# Task and Subtask

One self-contained piece of work. Read [the shape of an issue](sections.md) with this file. It
says what goes in each section below, and this file only says which sections a `Task` has.

```markdown
## TLDR

What is missing or wrong today, and what this changes about it. Two sentences.

## Out of scope                              (only what somebody actually decided)

- what this deliberately does not do
- what belongs to another issue, named with its key

## Acceptance criteria

- [ ] something observably true when this is done
- [ ] three to five of them, each checkable by a person who did not write the code

## Findings                                  (only when somebody checked)

- where it lives — see [Pointing at code](sections.md#pointing-at-code)
- how that part works today, when that is what makes this necessary
- what will bite: a constraint, something that would break, a failure already watched
- Suspected: what the author believes the answer is — only when they already know, never a guess

## Risk                                      (only when the configuration defines risk areas)

risk-<level> — one sentence naming the reason.

## Open questions                            (only when there are any)

- Q1: the question, phrased so a yes or a no answers it

## Demo                                      (only when there is a recording)
```

A `Task` has no section of its own. It is the plain shape, and that is the point of it. Where a
defect has `Steps to reproduce` and a `Story` has `Subtasks`, a `Task` goes straight from what it
refuses to what will be true.

`Subtask` uses the same shape. What separates it from a `Task` is only that it sits under a
`Story`, so it is created with `--parent` and its title carries its own subsystem prefix. Nothing
about the description changes: a subtask that needs a different shape is a `Task` that was filed
in the wrong place.

## A worked example

A `Task` from a project with no `risk` block in its configuration, so there is no `Risk` section
and no label. Four criteria, one `Out of scope` line somebody decided, and `Findings` that say how
the export works today rather than how the new field should be wired in. The one open question is
the one the author could not answer and did not guess.

```markdown
[api] Add the last-login timestamp to the customer export

## TLDR

The customer CSV that support downloads has no way of telling an active account from an abandoned
one, so the quarterly clean-up is done by hand against the admin panel. This adds a last-login
column to the export.

## Out of scope

- accounts that never logged in stay in the export with an empty column; filtering them out is a
  separate request from support

## Acceptance criteria

- [ ] The customer export has a `last_login` column, ISO-8601 in UTC, empty when the account never
      logged in.
- [ ] The column appears in the same position for every export format the endpoint serves.
- [ ] An export of ten thousand customers finishes in the same time as before, within the margin
      the existing export test asserts.
- [ ] The support role can see the column; no other role gains a field it did not have.

## Findings

- `src/customers/export.service.ts` builds the CSV from a fixed column list in `EXPORT_COLUMNS`;
  every other column is read from the customer row itself.
- Last login is not on the customer row. It is written to `sessions` on every successful login by
  `auth/session.service.ts`, and nothing aggregates it.
- The export streams rows in pages of five hundred, so a per-row lookup against `sessions` would
  add ten thousand queries to the largest export.

## Open questions

- Q1: Is the last *successful* login the value support wants, or the last attempt, which the
  sessions table also records?
```
