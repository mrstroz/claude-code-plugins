# The report

Write it for someone who was not there and will not re-run it: a table they can scan, findings they can act on, and a picture behind every claim — with the run that produced each row named, so a result from last week cannot be read as a result on today's build.

Save it as `docs/qa/<TASK>/report.md`, and give the same content back in the conversation — the user usually wants to read it without opening a file. The report is the latest one; the runs it draws on are under `runs/`.

## Structure

```markdown
# QA — <feature>, <ticket key if any>

<One paragraph: which run this is (its id), what was tested, on which
environment (base URL), which driver clicked — "Playwright, QA window,
Chromium 151, 1440x900" or "Chrome extension, the user's own session" —
whether the database was checked and which one, and the build: the local
commit and branch with the note that the tree was dirty (N files) and that
this is the checkout, not a verified version of the app at that URL; a
remote build id when the app exposes one. How many scenarios ran in this
run out of how many, and which rows come from an earlier run. When a run
was interrupted, say so here, with its id. Anything that would change the
result if it were different — a feature flag, a role — goes here too.>

## Scenarios

| # | Scenario | Result | Run |
| --- | --- | --- | --- |
| 01 | Baseline — list loads with no filters | PASS | 20260910-105210-3c1e |
| 02 | Filter drawer opens from the funnel | PASS | 20260910-105210-3c1e |
| 18 | Cancel reverts changes Auto apply already applied | FAIL | 20260910-105210-3c1e |
| 22 | Reset with the price filter active | BLOCKED | 20260910-105210-3c1e |
| 37 | Row reordering by drag & drop | CHECK | 20260908-151200-1a2b (earlier) |

## Things to fix

## Not run

## Changes to the scenarios during the run

## Visual observations

## Proposed additions (not run)

## Test data

## Files
```

Four columns. The **Run** column is the run id from the index (`sourceRunId`) — the execution the row comes from. A row from an earlier run says `(earlier)` after the id, and the opening paragraph says why it was not re-run. `check-evidence.js` reads the column and refuses a row whose run id differs from the index, so a PASS obtained on the build before this one cannot sit in the table looking current. The result column carries one of the four tokens below, in English whatever the report's language.

## Statuses

| Status | Means | Requires |
| --- | --- | --- |
| PASS | behaves as the criterion says | the caption naming the value that proves it |
| FAIL | behaves differently from the criterion | an entry under Things to fix |
| CHECK | could not be verified with this tooling | one sentence saying what a human should do |
| BLOCKED | did not run: a setup failed, a precondition did not hold, or a scenario it depends on did not finish | an entry under Not run, and no screenshot |

CHECK exists because some things genuinely cannot be driven from here — a synthetic drag that a sortable library ignores, a flow needing a second account, an email that has to arrive. BLOCKED exists because a scenario that runs on the wrong state produces a finding about nothing; it is an honest result and carries no screenshot. A database check that could not be made — connection lost, query failed — is neither: it is an error the run has to settle before handover, and it never turns into a PASS on the UI alone.

## Things to fix

One numbered entry per finding, most important first:

```markdown
### 1. Save writes the view under the wrong tenant — screenshot 07, run 20260910-105210-3c1e

**Steps to reproduce**
1. Logged in as tenant 1; seeded views "QA 20260910-105210-3c1e alpha" and "… beta".
2. Type "QA 20260910-105210-3c1e gamma", press Save.

**UI:** the row appears in the list within 0.8 s (assertion held: 3 rows; POST /api/views → 201).

**DB:** `SELECT owner_id FROM views WHERE name = 'QA … gamma'` → `2`. Expected `1`, the tenant that saved it.

**Expected:** the row belongs to the tenant of the session that created it.

**Cause:** `ViewController::actionCreate()` — `owner_id` is read from the request body, not from the session.
```

Where the scenario checked both the UI and the database, the finding carries both on their own lines, labelled, so the reader sees which source disagreed. The `source` on every expect in the index is what these lines come from. The cause line is what separates a report somebody fixes today from one that starts a second investigation; write nothing rather than a guess.

A finding that began as an execution error quotes the runner's message as its evidence and the diagnosis recorded with `--verdict` as its actual. A finding that overturned a PASS opens by saying so, because the picture still carries the green badge: "The caption on screenshot 06 reads PASS — the assertion held. The verdict supersedes it: the button overlaps the footer." One line naming the number and the badge is what `check-evidence.js` looks for.

Minor observations still belong here, marked as minor.

## Not run

One line per BLOCKED row, the number in bold — that is what `check-evidence.js` looks for — with the reason and what would unblock it:

```markdown
- **22** — precondition "price filter is active" did not hold: the URL carried `type[]=villa`. Depends on 21, which failed.
- **23** — requires 22.
- **31** — setup "secondAccount" failed: POST /api/users → 409 (the user from run 20260909-… was kept and not cleaned).
```

Leave the section out when nothing was blocked.

## Changes to the scenarios during the run

One line per scenario whose steps, dependencies or fixtures were rewritten since an earlier run: what the first version checked, why it was wrong, what the final one checks — the `revision` from the scenario file, expanded if it needs to be. The index marks such entries `rewritten` and keeps the earlier one under `history` with its run id; the runner lists them at the end of the run. A change that kept the requirement but replaced a wrong step belongs here; a change that made the check weaker is a finding about the report. Leave the section out when nothing was rewritten.

## Visual observations

What the pictures show that the assertions did not measure. Start with which pictures were looked at, then one line per observation with its number and run. A caption whose target matched nothing (`captionDiag` in the index; the card says "no element matched") is worth a line here too: the picture has no frame around its evidence. An observation never changes a row on its own; when it breaks an explicit criterion, record it with `--verdict NN=fail --reason "…"` and move it to Things to fix.

## Proposed additions (not run)

When the list was handed over and the run suggested cases it did not cover, one line each. Leave the section out when the list was derived by this skill or every proposal was accepted.

## Test data

From `run.json`'s `data` block and the ledger: how many records the run created and through what (setups, `leaves`), how many cleanup removed, how many had no cleanup step, and any cleanup failure with the record's kind and id — those rows are still in the database. When the run was made with `--keep-data`, say so and name the command that removes them (`--cleanup --run <id>`); `check-evidence.js` refuses a report whose run kept data without a word about it. Anything created outside the ledger — by hand, in a shared environment — is listed here too, with where it is.

## Files

`runs/<runId>/screenshots/NN-slug.jpg`, numbered to match the table; `results.json` (the index: assertions, values, verdicts, history, the run each row comes from); `runs/<runId>/run.json` and `results.json` for each run cited; `scenarios.json` — the run as data, which is what lets somebody repeat it. If captions were written in a language other than the report, say which.
