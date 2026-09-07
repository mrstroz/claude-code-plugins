# Working out what to test

The goal is a numbered list where every row is one thing a person could get wrong, ordered so the run flows from state to state without pointless resets. Build it from the cheapest source first — and when a list was handed over, that list is the scope.

## 0. What was handed over

Three things can arrive before any deriving starts, and each one settles more than the next:

- **The user's instruction now.** "Run 03 to 07 again", "only the drawer", "add the empty-state case" — this decides the scope, whatever any file says.
- **An existing `docs/qa/<TASK>/scenarios.json`.** A re-run starts from it: same numbers, same assertions. The user can widen or narrow it; nothing else does.
- **A list from somewhere else** — the ticket's test plan, `jira:jira-testing-release` output, a pasted table. It is executed as written: keep its numbering and its expected outcomes, and fill in what it leaves open (the selector, the exact value, the wait). It was already approved by whoever wrote it, so it is not shown for approval again.

Cases you notice that the handed-over list does not cover go into a separate block, **Proposed additions**, in the conversation. They run only if the user takes them; the ones declined are listed in the report under the same heading, so the gap is visible without the run having grown on its own. The scope of a QA run is the reader's to set, and a list that gains six rows every time it is executed stops being the plan.

Only when none of the three exists does the rest of this file apply.

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

## 4. The running app

Open the QA window and read the screens before writing a single selector — `--inspect` for the controls, option values, tables and open dialogs of a page, with `--steps` to read it inside a drawer or after a dialog opened; the exact commands are in [playwright-driver.md](playwright-driver.md). Two things come out of this that nothing else provides:

- **the targets as the page names them** — the accessible name of the button, the `value` of the option, the id on the table — so the file is written from what exists rather than corrected forty times against it
- **the data** — which rows are there, their ids, the count before any filter. The expected value of every assertion is fixed here, before the run. A filter scenario knows the six ids it must return because the unfiltered list showed them; it does not learn them from the filtered result

Write the preconditions down at the same time, as `given`: a scenario that assumes eleven rows says so, and the runner checks it before clicking.

## 5. Coverage axes

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

## 6. Order and dependencies

Sequence the run so each scenario leaves the app close to where the next one starts. Building up (add a filter, add a second, remove one, reload) beats resetting to a clean state forty times, and the intermediate states are themselves worth a picture.

Write the chain down: a scenario that uses the state an earlier one built — or a value it read — names it in `requires`. That is what lets a single scenario be re-run on the right state, and what stops the rest of the chain from running on a state that was never reached when one link errors.

Put the destructive scenarios — delete, reset, sign out — near the end, so a failure there does not cost you the setup the earlier rows depend on.

## Scope

A scenario is cheap while it is still a row in a table and expensive once it is a gap discovered afterwards, so derive the list fully the first time. But the list is the scope, and the scope belongs to the reader: what the criteria and the diff support goes in; what you would also like to check goes into Proposed additions and waits for a yes.

What does not belong on the list: anything with no observable UI outcome, and anything that needs a state you cannot reach in this environment. Say so in the table instead of quietly dropping it — a reviewer needs to know that "saved filters need a view" was a precondition you had to create, not a case you skipped.
