# Working out what to test

The goal is a numbered list where every row is one thing a person could get wrong, ordered so the run flows from state to state without pointless resets, and every row knows what it needs (data, a predecessor) and what proves it (a value, and an element on screen). Build it from the cheapest source first — and when a list was handed over, that list is the scope.

## 0. What was handed over

Three things can arrive before any deriving starts, and each one settles more than the next:

- **The user's instruction now.** "Run 03 to 07 again", "only the drawer", "add the empty-state case" — this decides the scope, whatever any file says.
- **An existing `docs/qa/<TASK>/scenarios.json`.** A re-run starts from it: same numbers, same assertions, same `withDB` answer. The user can widen or narrow it; nothing else does.
- **A list from somewhere else** — the ticket's test plan, `jira:jira-testing-release` output, a pasted table. It is executed as written: keep its numbering and its expected outcomes, and fill in what it leaves open (the selector, the exact value, the wait, the target). It was already approved by whoever wrote it, so it is not shown for approval again.

Cases you notice that the handed-over list does not cover go into a separate block, **Proposed additions**, in the conversation. They run only if the user takes them; the ones declined are listed in the report under the same heading. The scope of a QA run is the reader's to set.

Only when none of the three exists does the rest of this file apply.

## 1. Acceptance criteria

If there is a ticket, one scenario per criterion is the floor of coverage, not the ceiling. Keep the criterion's own wording in the scenario title where you can, so a reviewer can tick criteria off against rows without translating between two vocabularies.

## 2. The diff

```bash
git log --all --oneline --grep="<TICKET-KEY>"
git show --stat <commit>
```

Two things worth checking before you trust the list: **is the code actually live** (`git merge-base --is-ancestor <commit> HEAD`, and do the new files exist), and **is it behind a flag** (grep `.env` and the config). Forty screenshots of the old screen is the most expensive way to discover a flag left off.

## 3. The components

Read the changed components for **variants, not lines**: how many field or input types the feature renders, which operators or modes each exposes and which change the shape of the form, which dialogs exist and what each button does, what is conditional — permissions, a saved view, an empty collection, a flag. This is where the long tail of scenarios comes from, and it is the part a ticket never contains.

## 4. The running app, and the data

Open the QA window and read the screens before writing a single selector — `--inspect` for the controls, option values, tables and open dialogs of a page, `--steps` to read it inside a drawer, `--db` for the rows behind it when withDB is on. Two things come out of this that nothing else provides:

- **the targets as the page names them** — the accessible name of the button, the `value` of the option, the id on the table, the selector of the chip — so the file is written from what exists, and every scenario's `caption.target` points at something real
- **the data** — which rows are there, their ids, the count before any filter. The expected value of every assertion is fixed here, before the run. A filter scenario knows the six ids it must return because the seed showed them; it does not learn them from the filtered result

Then decide what the run has to **create** rather than find. Rows that the scenarios depend on — the two views a filter has to distinguish, the user with the other role, the record that is going to be deleted — are a `setup` with names carrying `${runId}`, not a hope that the database still holds them from last time. Write the preconditions down at the same time, as `given`: a scenario that assumes eleven rows says so, and the runner checks it before clicking.

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
| Saved data (withDB) | the row that appears in the list but was written under the wrong tenant, twice, or not at all; the soft delete the list forgot; the update that changed a field it should not have |

## 6. What proves it, on screen

Every scenario names a `target`: the element or region a reader should look at on the picture to see the result — the new row, the chip, the changed field, the counter, the validation message, the dialog. For an absence, point at what shows it: the empty state, the list that stayed at three rows, the form that cleared. The rule is not "draw a frame somewhere": a frame around an unrelated element is worse than none, and a screenshot proves nothing about the database — that is what the `db` expect and its `source: db` line are for. When genuinely nothing on screen proves the result, say so in the file (`"target": { "none": "…" }`) and the card says it on the picture.

## 7. Order and dependencies

Sequence the run so each scenario leaves the app close to where the next one starts, and keep the chains short. A scenario that uses the state an earlier one built — or a value it read — names it in `requires`; a scenario that needs data names the setup in `uses`. Prefer several short flows on a shared setup over one long chain: `--only 07` then re-runs a setup and a predecessor, not six scenarios, and a broken link blocks two rows, not thirty. Put the destructive scenarios — delete, reset, sign out — near the end.

## Scope

A scenario is cheap while it is still a row in a table and expensive once it is a gap discovered afterwards, so derive the list fully the first time. But the list is the scope, and the scope belongs to the reader: what the criteria and the diff support goes in; what you would also like to check goes into Proposed additions and waits for a yes. What does not belong on the list: anything with no observable outcome, and anything that needs a state you cannot reach in this environment — say so in the table instead of quietly dropping it.
