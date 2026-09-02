# Working out what to test

The goal is a numbered list where every row is one thing a person could get wrong, ordered so the run flows from state to state without pointless resets. Build it from the cheapest source first.

## 1. Acceptance criteria

If there is a ticket, one scenario per criterion is the floor of coverage, not the ceiling. Criteria are written before the code and describe intent; they never mention the third dialog mode somebody added along the way.

Keep the criterion's own wording in the scenario title where you can. A reviewer scanning the report should be able to tick criteria off against rows without translating between two vocabularies.

## 2. The diff

```bash
git log --all --oneline --grep="<TICKET-KEY>"
git show --stat <commit>
```

That gives the changed UI files. Two things worth checking before you trust the list:

- **Is the code actually live?** A feature can be merged, reverted and reapplied; the presence of a commit in history says nothing about the working tree. `git merge-base --is-ancestor <commit> HEAD` and a look at whether the new files exist settle it.
- **Is it behind a flag?** Grep `.env` and the config for anything gating the feature. A flag left off means the old screen is on screen, and forty screenshots of the old screen is the most expensive way to discover that.

## 3. The components

Read the changed components for **variants, not lines**. The question is not what the code does but how many distinguishable states a user can put it in:

- how many field or input types the feature renders, and whether each renders a different control
- which operators, modes or options each type exposes, and which of them change the shape of the form (an operator that needs no value hides the value input — that is its own scenario)
- which dialogs exist and what each button in them does
- what is conditional: permissions, a saved view, an empty collection, a feature flag

This is where the long tail of scenarios comes from, and it is the part a ticket never contains.

## 4. Coverage axes

Walk this list against the feature and keep whatever applies:

| Axis | What it catches |
| --- | --- |
| Happy path | the thing works at all |
| Each type and operator variant | a control that renders but does not filter |
| Add and remove | state that survives its own deletion |
| Enable and disable | rows kept but excluded, toggles that only look off |
| Combination | two conditions that work alone and not together |
| Persistence | reload, URL params, deep link, back/forward |
| Empty and zero results | the empty state rendering at all |
| Cancel with unsaved changes | silent data loss, or a warning that fires when nothing is pending |
| Conditional context | permissions, saved views, a second account |

## 5. Order

Sequence the run so each scenario leaves the app close to where the next one starts. Building up (add a filter, add a second, remove one, reload) beats resetting to a clean state forty times, and the intermediate states are themselves worth a picture.

Put the destructive scenarios — delete, reset, sign out — near the end, so a failure there does not cost you the setup the earlier rows depend on.

## Scope

A scenario is cheap while it is still a row in a table and expensive once it is a gap discovered afterwards. Forty planned and forty executed beats ten planned and a second run.

What does not belong on the list: anything with no observable UI outcome, and anything that needs a state you cannot reach in this environment. Say so in the table instead of quietly dropping it — a reviewer needs to know that "saved filters need a view" was a precondition you had to create, not a case you skipped.
