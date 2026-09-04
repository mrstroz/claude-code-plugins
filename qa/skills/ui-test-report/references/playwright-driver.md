# Driving the run with Playwright

The runner executes `scenarios.json` in a browser window that stays open between runs. One command replaces the click–assert–caption–screenshot loop for every scenario, and the model's job shrinks to writing the scenario file, reading the results and writing the report.

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

opens the window (or a new tab in it) on the app and prints the URL it landed on. A `/login` there means the user has to log in by hand in the window; nothing else is needed — no Enter in a terminal, no flag to re-run. The runner never types credentials and never sees them. Confirm the session before a long run:

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --eval "location.pathname" --url /items
```

`--eval` opens a tab, navigates, evaluates one JavaScript expression, prints it as JSON and closes the tab. It is also the tool for looking at the DOM while writing selectors — which table class, which filter names, which `<option>` values — so no throwaway scenario file ever has to be written next to the real one.

Playwright cannot attach to the user's everyday browser: Chromium blocks remote debugging on the default profile (since 136), and a second `--user-data-dir` is a second profile anyway. Hence the profile of its own, at `~/.cache/qa-ui-test/profile`.

### Chromium or Brave

Default is the Chromium that Playwright installs — it is always there once Playwright is. `--browser brave` uses the Brave on `PATH` instead, on a separate profile, when the user wants the window to be the browser they know; `--executable PATH` names any other Chromium-based binary. A snap-packaged browser cannot see hidden directories at the top of `$HOME`, so for `/snap/bin/brave` the profile goes to `~/snap/brave/common/qa-ui-test/profile`. The choice is recorded in `browser.json`; switching means `--close` first, and the runner says so.

## Installing Playwright, once per machine

The plugin ships no dependencies. The package is resolved from the project's own `node_modules` first (many projects already have it), then from `~/.cache/qa-ui-test`, then globally. When none has it the runner exits with the exact command:

```bash
npm install --prefix ~/.cache/qa-ui-test playwright@1 && npx --prefix ~/.cache/qa-ui-test playwright install chromium
```

Run it as the user asks, not silently: it changes the machine. It lives under `~/.cache` rather than inside the plugin because the plugin cache is versioned and replaced on update, and a `node_modules` inside it would vanish with the old version.

## Reading the results

`results.json` has one entry per scenario:

```json
{
  "n": "03", "slug": "apply-villa-chip-url", "status": "pass", "at": "2026-09-04T10:52:31.104Z",
  "values": { "after": 6, "chip": "Property type: Villa" },
  "expects": [{ "desc": "fewer rows than the baseline", "passed": true, "actual": 6, "expected": 11 }],
  "caption": "The list drops from 11 to <b>6</b> records …",
  "screenshot": "screenshots/03-apply-villa-chip-url.jpg",
  "console": [],
  "history": [{ "at": "2026-09-04T10:49:59.412Z", "status": "fail", "expects": [ … ] }]
}
```

- `pass` / `fail` / `check` map straight onto the report table. A `fail` entry names the assertion that broke and the value it saw — that is the "Actual" line of the finding, already written
- `error` means a step could not run: the selector matched nothing, a wait timed out, the page threw. It is not a FAIL and it is not a CHECK. Read the message, fix the step in `scenarios.json`, re-run that scenario with `--only NN`. The screenshot is at `NN-slug.error.jpg` so `check-evidence.js` refuses the run until it is replaced. A `--only` run merges its entries into the existing `results.json` by number and removes the `.error.jpg` of a scenario that now ran, so the full file stays the single record of the run. Re-run the scenarios it depends on with it (`--only 13,14`) when the fixed one needs state an earlier one builds
- `history` appears when the scenario's status or set of assertions differs from the previous results file: the earlier entry is kept, with its time. A scenario that failed on one check and passed after the check was rewritten shows both, and the runner names such scenarios at the end of the run. That is the material for the report's "Changes to the scenarios during the run" section — the reader has to be able to tell a check that was wrong from code that changed between runs. Do not delete `screenshots/` or `results.json` to get a "clean" run; the runner overwrites by name, and the history is the point
- `console` holds console errors, page errors, failed requests and HTTP 4xx/5xx seen during that scenario. An empty list is worth a glance too when a scenario failed — no failed request narrows the cause to the front end
- `warning` on a passed scenario means it had no `expect`. Add one or mark it manual before trusting the row

The `values` map is what goes into the report's findings and captions; nothing in the report should carry a number that is not in the results file.

## When to use the Chrome extension instead

- the app needs the user's real session and it cannot be reproduced in the QA window — hardware keys, a corporate SSO that pins the device
- a browser extension is part of what is under test
- the app refuses automated browsers outright

Then choose the Chrome driver at the start; the scenario file is still written, and [browser-driving.md](browser-driving.md) covers executing it by hand in batches.

## What the runner does not do

It does not type credentials, does not install anything, does not close dialogs, does not post results. A native `alert` or `confirm` in the app blocks the page — Playwright dismisses them by default, so a scenario that depends on the dialog's choice needs to be marked manual.
