# Bug

Something that used to work, or was meant to, does not. Read [the shape of an issue](sections.md)
with this file. It says what goes in each section below, and this file only says which sections a
`Bug` has and what a defect does differently.

A defect that has to reach production without waiting for the next release is a
[`HOTFIX`](hotfix.md) instead. Same shape, one extra sentence.

```markdown
> [!WARNING] …                              (only when the premise was reasoned, not watched)

## TLDR

What a user sees, and what they should see instead. Two sentences.

## Out of scope                              (only what somebody actually decided)

- records already broken stay as they are — when that is the decision, and not otherwise
- what belongs to another issue, named with its key

## Steps to reproduce

1. …
2. …
3. Observed: … / Expected: …

## Acceptance criteria

- [ ] the defect no longer reproduces by the steps above
- [ ] whatever else must stay true, so the fix cannot trade one bug for another

## Findings                                  (only when the reporter already knows)

- `path/to/the/file` — `theMethod()`, one sentence on why it is the suspect
- how that part behaves today, when that is what makes the defect possible
- Suspected: what the reporter believes the fix is — only when they already know, never a guess

## Risk                                      (only when the configuration defines risk areas)

risk-<level> — one sentence naming the reason.

## Open questions                            (only when there are any)

- Q1: do the records already broken by this get repaired as part of the fix?

## Demo                                      (only when there is a recording)
```

`TLDR` is the part most often written wrong, and in a defect report it carries the whole
statement of what is broken. It is for what somebody using the product sees ("the feed for a
company is never generated"), not for the mechanism that produces it. A description opening with a
method signature has moved `Findings` to the top and left the reader to reconstruct what broke.
The precise pair, what was observed against what was expected, goes in the last reproduction
step, where whoever checks the fix actually reads it.

`Out of scope` and `Q1` in the skeleton above are the same question in its two honest forms, and
a defect almost always raises it: whether the records already broken get repaired. Somebody
decided it, and it is an exclusion; nobody has, and it is a question. Writing the exclusion on
nobody's behalf is how the narrow fix ships. [The rule in full](sections.md#out-of-scope).

Not every defect reproduces on demand, and one whose premise was reasoned rather than watched
opens with a panel saying so. Both are in [`Steps to reproduce`](sections.md#steps-to-reproduce).

## A worked example

A defect report that earns its length. The criteria say what will be true, and `Findings` splits
what the reporter saw from what they think: the first line is how the code behaves today and can
be checked by opening the file, the second is the fix they suspect and says so, which is why the
next person tests it instead of building it.

`Out of scope` carries a single line, and that line is the whole reason the section exists: the
duplicates already in the database stay where they are, which is otherwise the first thing whoever
picks this up has to ask. Somebody decided that. Had nobody decided it, the same sentence would be
`Q1` instead, because an exclusion and an unanswered question look identical once they are written
down and only one of them is safe to build on.

`TLDR` is one sentence rather than two, because one carried both halves. No `Open questions`,
because the reporter watched this happen and settled the one question a defect always raises. The
project defines risk areas, so `Risk` is there with its reason.

```markdown
[BE] Repeated imports create duplicate projects

## TLDR

Re-running the supplier import creates a second project for a feed entry that was already
imported, so the same development shows up twice on the customer's website.

## Out of scope

- projects duplicated by earlier runs stay as they are — merging them is separate work

## Steps to reproduce

1. Run the supplier import for a company that has never imported this feed.
2. Run the same import again without changing the feed.
3. Observed: two projects with the same reference. Expected: one, updated.

## Acceptance criteria

- [ ] Importing the same feed twice leaves exactly one project per feed entry.
- [ ] An entry whose details changed updates the existing project rather than replacing it.
- [ ] Projects created by earlier runs are not duplicated further by a later one.

## Findings

- `app/import/ProjectImporter` — `resolveProject()` looks the project up by name rather than by
  the feed's own reference.
- Suspected: matching on the feed's own reference, which every entry already carries.

## Risk

risk-medium — it changes how imported records are matched, and a wrong match is silent.
```
