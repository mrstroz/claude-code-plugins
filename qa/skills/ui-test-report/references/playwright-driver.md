# Driving the run with Playwright

The runner executes `scenarios.json` in a browser window that stays open between runs. One command replaces the click–assert–caption–screenshot loop for every scenario, and the model's job shrinks to looking at the app, writing the scenario file, reading the results and writing the report.

```bash
cd docs/qa/<TASK>
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000
```

Defaults: `--scenarios scenarios.json` in the current directory (`--task-dir DIR` to point elsewhere). Flags worth knowing: `--only 07,08`, `--fast` (no slow motion, for a re-run nobody needs to watch) or `--slow-mo 500` (default 250 so the eye can follow), `--keep-data`, `--viewport 1920x1080`, `--timeout 10000`, `--browser brave`, `--config path/to/qa.config.json`.

## Every run is a run

```
docs/qa/<TASK>/
  scenarios.json                 the plan
  results.json                   the latest run under `run`; per scenario, the last result and the run that produced it
  report.md                      the report
  screenshots/NN-slug.jpg        one picture per scenario
  records.json                   only while test data is still in the database
```

Every execution gets a run id, and `results.json` says which run last executed each scenario. A `--only 07` removes 07's earlier picture, writes the new one under the same name and replaces 07's entry; the other entries stay as they were, with their own run id. The runner prints which scenarios were **not** executed this time; their rows read `(earlier)` in the report, where the reader can see they are not a result on the current state. Nothing is archived per run — the repository's history is the archive between builds, and a picture of a result that a later run replaced was evidence for a result that no longer stands. The runner keeps no history of earlier executions either: what changed since the previous `results.json` is printed at the end of the run, and that print is what the report's "Changes to the scenarios" section is written from.

The `run` block records the run id, status (`running` → `completed` or `interrupted`), start and end, scope (`all` or `{ only }`), driver, base URL, browser and version, viewport, slow motion, runner version, a hash of the scenario file, `fixturesVersion` from `setups.version`, whether withDB was on and which database (no secret), the build, the executed numbers, the counts, and `data` — records created, cleaned, kept, cleanup failures. The build block is `git rev-parse HEAD` and `git status` of the task directory's repository: branch, commit, whether the tree was dirty and how many files — with a note saying it is the local checkout and **not verified as the build running at the base URL**. The report repeats that qualification; a local commit is evidence about the checkout, not about a container built this morning or a remote deployment.

`results.json` is rewritten after every scenario, atomically. Ctrl-C finishes the current scenario, cleans up the run's data, marks the run `interrupted` and exits 130; a second Ctrl-C leaves at once, and the run is marked with a note that cleanup may not have finished. A run whose process died without either — power, `kill -9` — stays `running` in the file, which `check-evidence.js` treats the same way: it refuses a report whose run did not complete without the report saying so.

## The QA window

The browser is a long-lived process, not something each run starts and stops. The first run — or `--open` — launches it detached, with remote debugging on a local port (9333 by default), on a profile of its own, and records port, pid and profile in `~/.cache/qa-ui-test/browser.json`. Every later run connects over CDP, opens a tab, works in it and closes only that tab. The window stays until `--close`.

This is what keeps a session alive: a login cookie with no expiry — the normal case for a PHP or Rails session — is dropped the moment the browser exits. The user logs in once, in that window:

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --open
```

opens the window (or a new tab in it) on the app and prints the URL it landed on. A `/login` there means the user has to log in by hand in the window; the runner never types credentials and never sees them. Playwright cannot attach to the user's everyday browser (Chromium blocks remote debugging on the default profile), hence the profile of its own.

Default is the Chromium that Playwright installs. `--browser brave` uses the Brave on `PATH` on a separate profile; `--executable PATH` names any Chromium-based binary — also the way out when the project's Playwright wants a Chromium build that is not installed. For a snap-packaged browser the profile goes under `~/snap/<name>/common/`.

## Installing Playwright, once per machine

The plugin ships no dependencies. The package is resolved from the project's own `node_modules` first, then from `~/.cache/qa-ui-test`, then globally. When none has it the runner exits with the exact command:

```bash
npm install --prefix ~/.cache/qa-ui-test playwright@1 && npx --prefix ~/.cache/qa-ui-test playwright install chromium
```

Run it as the user asks, not silently. Neither the database nor the fixtures need Playwright: `--prepare`, `--cleanup`, `--db`, `--db-discover`, `--verdict`, `--new-run` and `--finish` run without it.

## Looking at the page before writing selectors

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --inspect --url /items
node …/run-scenarios.mjs --base-url http://localhost:3000 --inspect --url /items --steps '[{ "click": { "role": "button", "name": "Filters" } }, { "wait": ".drawer.open" }]'
node …/run-scenarios.mjs --base-url http://localhost:3000 --eval "document.querySelector('table').className" --url /items
node …/run-scenarios.mjs --db "SELECT id, ref FROM properties WHERE type = 'villa' ORDER BY id" --params '[]'
```

`--inspect` prints one inventory of the page: controls with roles and accessible names, `<select>`s with their option values, tables with headers, row counts and first rows, open dialogs. `--steps` runs scenario steps first, to read the page inside a drawer. `--eval` reads one value. With withDB, `--db` runs one read-only query — the ids a filter has to return, the count before any action — so expected values are fixed from the data before the run.

## Readiness

`goto` and `reload` wait for the `load` event and then for the file's `ready` condition, when there is one — a selector that has to be visible, or a `js` expression. That condition is the app saying it is ready (the shell rendered, the bootstrap flag set, the spinner gone), and a timeout on it is an error of the step, recorded as such. There is no network-idle wait behind the scenes: it was a guess that happened to fit most pages and silently swallowed its own timeout, so a page that never settled looked like a page that had. `{ "wait": { "loadState": "networkidle" } }` remains for the page that offers no other signal, spelled out so the file says so.

## Reading the results

`results.json`: `runId` and `run` for the latest run, then one entry per scenario:

```json
{
  "n": "03", "slug": "apply-villa-chip-url", "status": "pass", "at": "2026-09-10T10:52:31.104Z",
  "runId": "20260910-105210-3c1e", "stepsHash": "f1e2e604b7a3", "hashVersion": 2,
  "requires": ["01"], "uses": ["villaSeed"],
  "given": [{ "desc": "the unfiltered list had 11 rows", "source": "ui", "passed": true, "actual": 11, "expected": 11 }],
  "values": { "ids": ["P-101", "P-103"], "save": { "status": 201, "ok": true, "json": { "id": 42 } } },
  "expects": [
    { "desc": "the API accepted the view", "source": "http", "passed": true, "actual": 201, "expected": 201 },
    { "desc": "the list refreshes", "source": "ui", "passed": true, "actual": 6, "expected": 6, "waitedMs": 812, "attempts": 5 },
    { "desc": "one row in the database", "source": "db", "passed": false, "actual": 2, "expected": 1, "reason": "expected number 1, got number 2", "actualType": "number" }
  ],
  "caption": "…", "captionDiag": { "missing": [".chip"] },
  "screenshot": "screenshots/03-apply-villa-chip-url.jpg",
  "completed": true, "console": [],
  "revision": "…", "revisionHash": "f1e2e604b7a3"
}
```

- `pass` / `fail` / `check` map straight onto the report table. A `fail` entry names the assertion, its source, the value it saw and the reason — the "Actual" line of the finding, already written, with UI and DB told apart
- `blocked` means the scenario did not run: a setup failed (`blockedBy: "setup:name"`), a `given` did not hold (`"given"`), or a required scenario did not finish (`"04"`), with `reason`. No screenshot. BLOCKED in the report, an entry under Not run
- `error` means a step could not run. Not a FAIL, not a CHECK; the screenshot is `NN-slug.error.jpg`, which `check-evidence.js` refuses. The next section says what to do
- `completed` says whether the steps ran to the end, independently of the verdict; it is what `requires` looks at
- `runId` is the run that produced the entry; one that differs from the file's `runId` was not executed by the latest run, and its row reads `(earlier)` in the report
- Steps are compared by hash (`hashVersion: 2` covers requires, uses and the setups' content) against the previous `results.json`, so a changed comparator or a changed fixture counts as a rewrite even when the description stayed the same; the runner names such scenarios at the end of the run, with `(steps)` and the status change, and says when the `revision` does not cover the steps as they are now (`revisionHash`). The file itself keeps no history — the print and the report's "Changes" section are the record
- `captionDiag.missing` lists caption selectors — the target first — that matched nothing; the card on the picture says the same
- `diagnosis` is the reason recorded with `--verdict`; `diagnosisCarried: true` means a later run hit the same failure and kept the verdict. `console` holds console errors, page errors, failed requests and HTTP 4xx/5xx seen during the scenario

Nothing in the report should carry a number that is not in `results.json`.

## When a scenario errors

A timeout on a click is what a missing button looks like, and a missing button may be the bug. Before touching the step, find out which:

1. `--eval` whether the element exists at all, in the state the scenario reached; `--inspect` with the same steps shows what *is* there instead
2. read the scenario's `console` entries — a 500 on the request that renders the button explains more than another attempt
3. read the code that renders it, enough to say whether the element is conditional and on what

Then one of two things:

- **The step was wrong.** Fix it in `scenarios.json`, put one sentence in `revision`, and re-run with `--only NN`. The fix keeps checking the same requirement: replacing `equals` with `lt` because `equals` failed, or dropping the step that failed, is a weaker test, and the runner's end-of-run print names it
- **The element the criterion requires is not there.** The scenario is a FAIL and the error is its evidence:

  ```bash
  node …/run-scenarios.mjs --verdict 04=fail --reason "Export button is not rendered on the filtered list (no element, no request in console); the criterion requires it"
  ```

  The error message stays on the entry, `diagnosis` holds the reason, and `04-slug.error.jpg` is renamed to `04-slug.jpg`. `--verdict NN=check` is the same move for something the tooling turned out unable to drive. A verdict applies to the scenario's entry as it is now; on the next run the runner keeps the verdict when it hits the same failure — same steps, same step, same message — and says so

`--verdict NN=fail` also overturns a PASS whose picture shows something the assertions did not cover. The badge on the picture stays what it was at capture; the entry records it (`pictureSays`), and the finding has to say in one line that the verdict supersedes the caption, or `check-evidence.js` refuses the report. `--verdict NN=pass` exists only to withdraw such a verdict: it is accepted for a completed run whose assertions all held, and for nothing else. It refuses a blocked scenario: nothing ran, so there is nothing to judge.

## Re-running

`--only 07` runs 07 and, before it, everything 07 `requires`, transitively and in file order, plus the setups 07 `uses` — on fresh data, under a new run id. A PASS from an earlier run is not a state the app is in now, so the dependency runs again rather than being trusted. The validator checks the selection first: a value 07 reads that only 02 stores, with 02 not in `requires`, stops the run before the browser with the scenario to add. `--fast` drops the slow motion for a re-run nobody needs to watch; nothing else changes, and no scenario is ever retried on its own.

## When to use the Chrome extension instead

- the app needs the user's real session and it cannot be reproduced in the QA window — hardware keys, a corporate SSO that pins the device
- a browser extension is part of what is under test
- the app refuses automated browsers outright

Then choose the Chrome driver at the start; the scenario file is still written, and [browser-driving.md](browser-driving.md) covers executing it by hand, and what the runner still does for such a run (the run in `results.json`, the setups, the database, the closing check).

## What the runner does not do

It does not type credentials, does not install anything, does not close dialogs, does not post results, does not retry a scenario, does not reset a database, and does not decide what an error means. A native `alert` or `confirm` in the app blocks the page — Playwright dismisses them by default, so a scenario that depends on the dialog's choice needs to be marked manual.
