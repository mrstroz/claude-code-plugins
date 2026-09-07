# The report

Write it for someone who was not there and will not re-run it: a table they can scan, findings they can act on, and a picture behind every claim.

Save it as `docs/qa/<TASK>/report.md` next to `screenshots/`, and give the same content back in the conversation — the user usually wants to read it without opening a file.

## Structure

```markdown
# QA — <feature>, <ticket key if any>

<One paragraph: what was tested, on which branch/commit, in which environment,
with which data, how many scenarios ran out of how many, and which driver
clicked — "Playwright, visible window, QA profile, Chromium 151" or "Chrome
extension, the user's own session". Anything that would change the result if it
were different goes here — a feature flag, a seeded data set, a role. The driver
belongs on that list: a different session has different permissions, extensions
and cookies, and a reviewer reading a FAIL needs to know which browser saw it.
When something did not run, say so here in one clause — "38 of 40 ran; 05 and
06 blocked by the failure in 04" — so the coverage is the first thing read.>

## Scenarios

| # | Scenario | Result |
| --- | --- | --- |
| 01 | Baseline — list loads with no filters | PASS |
| 02 | Filter drawer opens from the funnel | PASS |
| 18 | Cancel reverts changes Auto apply already applied | FAIL |
| 22 | Reset with the price filter active | BLOCKED |
| 37 | Row reordering by drag & drop | CHECK |

## Things to fix

## Not run

## Changes to the scenarios during the run

## Visual observations

## Proposed additions (not run)

## Test data left behind

## Files
```

Keep the table to three columns. A fourth for the screenshot file is redundant — the number is the filename — and it makes the table harder to scan, which is the only thing the table is for. The result column carries one of the four tokens below, in English whatever the report's language: `check-evidence.js` reads them.

## Statuses

| Status | Means | Requires |
| --- | --- | --- |
| PASS | behaves as the criterion says | the caption naming the value that proves it |
| FAIL | behaves differently from the criterion | an entry under Things to fix |
| CHECK | could not be verified with this tooling | one sentence saying what a human should do |
| BLOCKED | did not run: a precondition did not hold, or a scenario it depends on did not finish | an entry under Not run, and no screenshot |

CHECK exists because some things genuinely cannot be driven from here — a synthetic drag that a sortable library ignores, a flow needing a second account, an email that has to arrive. Filing those as failures teaches the team to skim past failures; filing them as passes claims coverage that was never obtained.

BLOCKED exists because a scenario that runs on the wrong state produces a finding about nothing. It is an honest result — this part of the feature was not tested in this run, and here is why — and it carries no screenshot, since a picture of a state the scenario never reached would be evidence of nothing. A report with three BLOCKED rows and a clear reason is worth more than one with forty PASSes nobody can place.

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

A finding that began as an execution error quotes the runner's message as its evidence and the diagnosis recorded with `--verdict` as its actual: "**Actual:** `locator.click: Timeout 10000ms exceeded` — the Export button is not rendered on the filtered list; no request for it appears in the console." The reader then knows the row was a FAIL by judgement, and on what grounds.

A finding that overturned a PASS opens by saying so, because the picture still carries the green badge: "The caption on screenshot 06 reads PASS — the assertion held. The verdict supersedes it: the button overlaps the footer." One line naming the number and the badge is what `check-evidence.js` looks for.

Minor observations that are not worth a fix on their own — wrong toast copy, a truncated label — still belong here, marked as minor. They cost one line and they are the things nobody ever writes down.

## Not run

One line per BLOCKED row, the number in bold — that is what `check-evidence.js` looks for — with the reason and what would unblock it:

```markdown
- **22** — precondition "price filter is active" did not hold: the URL carried `type[]=villa`. Depends on 21, which failed; re-run after 21 is fixed.
- **23** — requires 22.
```

Leave the section out when nothing was blocked.

## Changes to the scenarios during the run

One line per scenario whose steps or assertions were rewritten after a FAIL or an error: what the first version checked, why it was wrong, what the final one checks — the `revision` from the scenario file, expanded if it needs to be.

```markdown
- **10** first asserted that material numbers ascend by JavaScript string comparison and failed; MySQL orders by collation, so the check was wrong, not the sort. Now asserts the 20 numbers equal `ORDER BY material_num` run directly in MySQL.
```

The section exists because a PASS that used to be a FAIL reads as "fixed" unless the report says the check changed rather than the code. `results.json` keeps the earlier entry under `history` for every such scenario and the runner lists them at the end of the run, so the material is already there. One line per rewrite: a scenario rewritten twice has two, because the sentence that explained the first change says nothing about the second. A change that kept the requirement but replaced a wrong step belongs here; a change that made the check weaker is a finding about the report, not a revision. Leave the section out when nothing was rewritten.

## Visual observations

What the pictures show that the assertions did not measure: an element overlapping another, a label cut off, a button under the sticky footer, a layout that broke at this viewport. Start with which pictures were looked at, then one line per observation with its number:

```markdown
Looked at: 03, 06, 12, 18, 22, 31.

- **06** the chip row wraps under the Apply button at 1440 px; the button stays clickable.
- **18** the "Unsaved Changes" dialog's second button is clipped by the drawer edge.
```

Looking costs tokens, so it is selective: every FAIL, the first picture of each UI state the run reaches (the first drawer, the first dialog, the empty state), and a handful of the rest. Saying which ones is what lets the reader know what was not looked at. An observation here never changes a row on its own. When what the picture shows breaks an explicit criterion of that scenario — the dialog the criterion needs is unreachable because it is clipped — record it with `--verdict NN=fail --reason "…"` and move it to Things to fix.

## Proposed additions (not run)

When the scenario list was handed over — from the ticket, from `jira:jira-testing-release`, from the user — and the run suggested cases it did not cover, list them here, one line each, so they are visible without having been silently added to the run. Leave the section out when the list was derived by this skill or every proposal was accepted.

## Test data left behind

Anything created to reach a scenario: records, saved views, users, uploaded files, and which environment they are in. Whoever reads the report needs to know that a stray "QA test view" on DEV came from this run and can go, and equally that it is still there.

## Files

Say where the evidence is: `screenshots/NN-slug.jpg`, numbered to match the table, the report itself, and `scenarios.json` — the run as data, which is what lets somebody repeat it. With the Playwright driver add `results.json`, the assertions, values, verdicts and history behind every row. If captions were written in a language other than the report, say which.
