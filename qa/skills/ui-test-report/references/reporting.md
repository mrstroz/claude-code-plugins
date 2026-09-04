# The report

Write it for someone who was not there and will not re-run it: a table they can scan, findings they can act on, and a picture behind every claim.

Save it as `docs/qa/<TASK>/report.md` next to `screenshots/`, and give the same content back in the conversation — the user usually wants to read it without opening a file.

## Structure

```markdown
# QA — <feature>, <ticket key if any>

<One paragraph: what was tested, on which branch/commit, in which environment,
with which data, how many scenarios, and which driver clicked — "Playwright,
visible window, QA profile, Chromium 151" or "Chrome extension, the user's own
session". Anything that would change the result if it were different goes here
— a feature flag, a seeded data set, a role. The driver belongs on that list:
a different session has different permissions, extensions and cookies, and a
reviewer reading a FAIL needs to know which browser saw it.>

## Scenarios

| # | Scenario | Result |
| --- | --- | --- |
| 01 | Baseline — list loads with no filters | PASS |
| 02 | Filter drawer opens from the funnel | PASS |
| 18 | Cancel reverts changes Auto apply already applied | FAIL |
| 37 | Row reordering by drag & drop | CHECK |

## Things to fix

## Changes to the scenarios during the run

## Test data left behind

## Files
```

Keep the table to three columns. A fourth for the screenshot file is redundant — the number is the filename — and it makes the table harder to scan, which is the only thing the table is for.

## Statuses

| Status | Means | Requires |
| --- | --- | --- |
| PASS | behaves as the criterion says | the caption naming the value that proves it |
| FAIL | behaves differently from the criterion | an entry under Things to fix |
| CHECK | could not be verified with this tooling | one sentence saying what a human should do |

CHECK exists because some things genuinely cannot be driven from here — a synthetic drag that a sortable library ignores, a flow needing a second account, an email that has to arrive. Filing those as failures teaches the team to skim past failures; filing them as passes claims coverage that was never obtained. Naming them honestly is what keeps the other thirty-nine rows worth reading.

## Things to fix

One numbered entry per finding, most important first:

```markdown
### 1. Cancel reverts changes Auto apply already applied — screenshot 18

**Steps to reproduce**
1. Applied state: Price >= 600,000 (6 of 11 records).
2. Open the filter drawer, turn Auto apply on.
3. Change the value to 2,000,000 — it applies immediately: 2 records, URL `min_price=2000000`.
4. Press Cancel.

**Actual:** an "Unsaved Changes" dialog appears although nothing is pending, and
confirming reverts the list and the URL to 600,000.

**Expected:** with Auto apply on there are no unsaved changes, so Cancel closes the drawer.

**Cause:** `useFilterBuilder.ts` — `hasUnsavedChanges()` and `discardChanges()` both
compare against `openSnapshot`, taken when the drawer opens and never refreshed by
auto apply.
```

The cause line is what separates a report somebody fixes today from one that starts a second investigation. Name the file and the function when reading the code makes it obvious; write nothing rather than a guess, since a wrong pointer costs more than none.

Minor observations that are not worth a fix on their own — wrong toast copy, a truncated label — still belong here, marked as minor. They cost one line and they are the things nobody ever writes down.

## Changes to the scenarios during the run

One line per scenario whose step or assertion was rewritten after a FAIL or an ERROR: what the first version checked, why it was wrong, what the final one checks.

```markdown
- **10** first asserted that material numbers ascend by JavaScript string comparison and failed; MySQL orders by collation, so the check was wrong, not the sort. Now asserts the 20 numbers equal `ORDER BY material_num` run directly in MySQL.
```

The section exists because a PASS that used to be a FAIL reads as "fixed" unless the report says the check changed rather than the code. `results.json` keeps the earlier entry under `history` for every such scenario and the runner lists them at the end of the run, so the material is already there. Leave the section out when nothing was rewritten.

## Test data left behind

Anything created to reach a scenario: records, saved views, users, uploaded files, and which environment they are in. Whoever reads the report needs to know that a stray "QA test view" on DEV came from this run and can go, and equally that it is still there.

## Files

Say where the evidence is: `screenshots/NN-slug.jpg`, numbered to match the table, the report itself, and `scenarios.json` — the run as data, which is what lets somebody repeat it. With the Playwright driver add `results.json`, the assertions and values behind every row. If captions were written in a language other than the report, say which.
