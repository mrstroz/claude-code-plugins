# Driving the run with Playwright

The runner executes `scenarios.json` in a browser window that stays open between runs. One command replaces the click–assert–caption–screenshot loop for every scenario, and the model's job shrinks to looking at the app, writing the scenario file, reading the results and writing the report.

```bash
cd docs/qa/<TASK>
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000
```

Defaults: `--scenarios scenarios.json`, `--out screenshots`, `--results results.json`, all relative to the current directory. Flags worth knowing: `--only 07,08`, `--slow-mo 500` (default 250 so the eye can follow), `--viewport 1920x1080`, `--timeout 10000`, `--browser brave`.

## The QA window

The browser is a long-lived process, not something each run starts and stops. The first run — or `--open` — launches it detached, with remote debugging on a local port (9333 by default), on a profile of its own, and records port, pid and profile in `~/.cache/qa-ui-test/browser.json`. Every later run finds it there, connects over CDP, opens a tab, works in it and closes only that tab. The window stays until:

```bash
node …/run-scenarios.mjs --close
```

This is what keeps a session alive. A login cookie with no expiry — the normal case for a PHP or Rails session — is dropped the moment the browser exits, so a runner that launched and closed a browser per run could never hold one, however persistent its profile. Now the cookie lives as long as the window, and the user logs in once, in that window:

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --open
```

opens the window (or a new tab in it) on the app and prints the URL it landed on. A `/login` there means the user has to log in by hand in the window; nothing else is needed — no Enter in a terminal, no flag to re-run. The runner never types credentials and never sees them.

Playwright cannot attach to the user's everyday browser: Chromium blocks remote debugging on the default profile (since 136), and a second `--user-data-dir` is a second profile anyway. Hence the profile of its own, at `~/.cache/qa-ui-test/profile`.

## Looking at the page before writing selectors

Selectors and expected values written from memory are the reason a first run comes back with a dozen errors. The window is open before the scenario file is written, so read the app through it:

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --inspect --url /items
```

prints one JSON inventory of the page: every visible control with its role, accessible name, id or test id, the `<select>`s with their option values, every table with headers, row count and the first rows, open dialogs, headings. Targets in the scenario file come straight from that list, and so do the expected values — the ids in the rows, the option value the filter takes.

A page has more states than URLs. To read it inside a drawer or after a dialog opened, run scenario steps first:

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --inspect --url /items \
  --steps '[{ "click": { "role": "button", "name": "Filters" } }, { "wait": ".drawer.open" }]'
```

`--eval` takes the same `--url` and `--steps` and evaluates one expression instead, for the value the inventory does not carry — `"document.querySelector('table').className"`, the full list of ids, `location.pathname` to confirm the session before a long run. Both open a tab, work, print, and close the tab; no throwaway scenario file is needed next to the real one.

Reconnaissance is also where expected values get fixed. The six villas a filter has to return are known from the seed data or the unfiltered list *before* the filter is applied; a scenario that reads the filtered table and asserts what it found has checked nothing.

### Chromium or Brave

Default is the Chromium that Playwright installs — it is always there once Playwright is. `--browser brave` uses the Brave on `PATH` instead, on a separate profile, when the user wants the window to be the browser they know; `--executable PATH` names any other Chromium-based binary. A snap-packaged browser cannot see hidden directories at the top of `$HOME`, so for `/snap/bin/brave` the profile goes to `~/snap/brave/common/qa-ui-test/profile`. The choice is recorded in `browser.json`; switching means `--close` first, and the runner says so.

## Installing Playwright, once per machine

The plugin ships no dependencies. The package is resolved from the project's own `node_modules` first (many projects already have it), then from `~/.cache/qa-ui-test`, then globally. When none has it the runner exits with the exact command:

```bash
npm install --prefix ~/.cache/qa-ui-test playwright@1 && npx --prefix ~/.cache/qa-ui-test playwright install chromium
```

Run it as the user asks, not silently: it changes the machine. It lives under `~/.cache` rather than inside the plugin because the plugin cache is versioned and replaced on update, and a `node_modules` inside it would vanish with the old version.

## Reading the results

The file is validated before anything is clicked — a scenario with no `expect` and no `manual`, an unknown step, a `${ref}` nothing reads, a `requires` pointing at a later scenario — and every problem is listed at once. Then `results.json` gets one entry per scenario:

```json
{
  "n": "03", "slug": "apply-villa-chip-url", "status": "pass", "at": "2026-09-07T10:52:31.104Z",
  "stepsHash": "f1e2e604b7a3",
  "given": [{ "desc": "the unfiltered list had 11 rows", "passed": true, "actual": 11, "expected": 11 }],
  "values": { "ids": ["P-101", "P-103", "P-104", "P-107", "P-109", "P-111"], "chip": "Property type: Villa" },
  "expects": [{ "desc": "the six villas in the seed data — no other row, none missing", "passed": true, "actual": ["P-101", "…"], "expected": ["P-101", "…"] }],
  "caption": "The condition surfaces as a chip: <b>Property type: Villa</b> …",
  "screenshot": "screenshots/03-apply-villa-chip-url.jpg",
  "completed": true,
  "console": [],
  "revision": "first checked only the ids; added the row count so an empty list cannot pass",
  "revisionHash": "f1e2e604b7a3",
  "history": [{ "at": "2026-09-07T10:49:59.412Z", "status": "fail", "completed": true, "stepsHash": "591434db6bd8", "expects": [ "…" ] }]
}
```

- `pass` / `fail` / `check` map straight onto the report table. A `fail` entry names the assertion that broke and the value it saw — that is the "Actual" line of the finding, already written
- `blocked` means the scenario did not run: a `given` did not hold (`blockedBy: "given"`) or a scenario in `requires` did not finish (`blockedBy: "04"`), with `reason` saying which check or which error. There is no screenshot. It goes into the report as BLOCKED with an entry under Not run; it is a result, not something to hide by re-running until it passes
- `error` means a step could not run: the selector matched nothing, a wait timed out, the page threw. It is not a FAIL and not a CHECK, and the report cannot be handed over while it stands — the screenshot is at `NN-slug.error.jpg`, which `check-evidence.js` refuses. The next section says what to do with it
- `completed` says whether the steps ran to the end, independently of the verdict. It is what `requires` looks at: a scenario judged a FAIL by verdict after an error has `completed: false`, and the ones that build on it stay blocked until it actually runs through
- `history` appears when the scenario's status or steps differ from the previous results file: the earlier entry is kept, with its time and the hash of the steps it ran. Steps are compared by hash, so a changed comparator counts as a rewrite even when the description stayed the same. A rewritten scenario is expected to carry `revision`, and the sentence is tied to the version of the steps it first appeared with (`revisionHash`): the one that explained the first rewrite does not cover the second, which needs its own. The runner lists the scenarios that lack one, and `check-evidence.js` refuses a report where they remain. Do not delete `screenshots/` or `results.json` to get a "clean" run; the runner overwrites by name and removes a stale picture itself, and the history is the point
- `diagnosis` is the reason recorded with `--verdict`; `diagnosisCarried: true` means a later run hit the same failure — same steps, same step, same message — and kept the verdict. `failedStep` names the step that threw. `error` is the first line of the message, for reading; `errorDetail` is the whole of it minus Playwright's retry counters and wait intervals, and that is what "same message" means — the first line of a timeout reads the same for a button that is missing and one that is disabled, the call log below it does not
- `console` holds console errors, page errors, failed requests and HTTP 4xx/5xx seen during that scenario. An empty list is worth a glance too when a scenario failed — no failed request narrows the cause to the front end

The `values` map is what goes into the report's findings and captions; nothing in the report should carry a number that is not in the results file.

## When a scenario errors

A timeout on a click is what a missing button looks like, and a missing button may be the bug. Before touching the step, find out which:

1. `--eval` whether the element exists at all, in the state the scenario reached: `--eval "!!document.querySelector('#export')" --url /items --steps '[…]'`. `--inspect` with the same steps shows what *is* there instead
2. read the scenario's `console` entries in `results.json` — a 500 on the request that renders the button explains more than another attempt
3. read the code that renders it, enough to say whether the element is conditional and on what

Then one of two things:

- **The step was wrong** — the name changed, the drawer needs a wait, the selector was a guess. Fix it in `scenarios.json`, put one sentence in `revision` saying what the earlier version checked and why that was wrong, and re-run with `--only NN`. The fix has to keep checking the same requirement: replacing `equals` with `lt` because `equals` failed, or dropping the step that failed, is not a correction but a weaker test, and the history in the results file will show it
- **The element the criterion requires is not there** — the scenario is a FAIL and the error is its evidence. Record that without re-running:

  ```bash
  node …/run-scenarios.mjs --verdict 04=fail --reason "Export button is not rendered on the filtered list (no element, no request in console); the criterion requires it"
  ```

  The entry as it was goes to `history`, the error message stays on the entry, `diagnosis` holds the reason, and `04-slug.error.jpg` is renamed to `04-slug.jpg` so the picture of the missing button becomes the evidence behind the row. `--verdict NN=check` is the same move for something the tooling turned out unable to drive. On the next run the runner keeps the verdict when it hits the same failure — same steps, same step, same message — and says so; a different error is a new error. The scenario still counts as not completed, so whatever `requires` it stays blocked until it runs through

`--verdict NN=fail` also overturns a PASS whose picture shows something the assertions did not cover — the list rendered under the drawer, say. The badge on the picture stays what it was at capture; the results entry records it (`pictureSays`), and the finding has to say in one line that the verdict supersedes the caption, or `check-evidence.js` refuses the report. `--verdict NN=pass` exists only to withdraw such a verdict: it is accepted for a completed run whose assertions all held, and for nothing else — a PASS is never given by judgement. It refuses a blocked scenario too: nothing ran, so there is nothing to judge.

## Re-running

`--only 07` runs 07 and, before it, everything 07 `requires`, transitively and in file order; the runner prints what it pulled in. A PASS from an earlier run is not a state the app is in now, so the dependency runs again rather than being trusted. A `--only` run merges its entries into the existing `results.json` by number and removes the `.error.jpg` of a scenario that now ran, so the full file stays the single record of the run.

## When to use the Chrome extension instead

- the app needs the user's real session and it cannot be reproduced in the QA window — hardware keys, a corporate SSO that pins the device
- a browser extension is part of what is under test
- the app refuses automated browsers outright

Then choose the Chrome driver at the start; the scenario file is still written, and [browser-driving.md](browser-driving.md) covers executing it by hand in batches.

## What the runner does not do

It does not type credentials, does not install anything, does not close dialogs, does not post results, and does not decide what an error means. A native `alert` or `confirm` in the app blocks the page — Playwright dismisses them by default, so a scenario that depends on the dialog's choice needs to be marked manual.
