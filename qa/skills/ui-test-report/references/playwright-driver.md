# Driving the run with Playwright

The runner executes `qa-scenarios.json` in a Chromium that Playwright launches — visible (`headed`) or not (`headless`) — on a profile of its own. One command replaces the click–assert–caption–screenshot loop for every scenario, and the model's job shrinks to writing the scenario file, reading the results and writing the report.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" \
  --scenarios qa-scenarios.json --base-url http://localhost:3000 --driver headed
```

Flags worth knowing: `--driver headless`, `--only 07,08`, `--slow-mo 500` (headed only; default 250 so the eye can follow), `--viewport 1920x1080`, `--out screenshots`, `--results qa-results.json`, `--timeout 10000`.

## The QA profile

Playwright cannot attach to the user's everyday Chrome: Chromium blocks remote debugging on the default profile (since 136), and a second `--user-data-dir` is a second profile anyway. So the runner keeps one of its own at `~/.cache/qa-ui-test/profile`. It is a real persistent profile — cookies, local storage and logins stay between runs, and both drivers share it, so a session established in a visible window is available to a headless run afterwards.

First use, and whenever the results show the app redirecting to a login page:

```bash
node …/run-scenarios.mjs --base-url http://localhost:3000 --login
```

A window opens on the app; the user logs in by hand and presses Enter in the terminal. The runner never types credentials and never sees them. It also cannot run while another Chromium holds the profile — finish `--login` before starting the run.

## Installing Playwright, once per machine

The plugin ships no dependencies. The package is resolved from the project's own `node_modules` first (many projects already have it), then from `~/.cache/qa-ui-test`, then globally. When none has it the runner exits with the exact command:

```bash
npm install --prefix ~/.cache/qa-ui-test playwright@1 && npx --prefix ~/.cache/qa-ui-test playwright install chromium
```

Run it as the user asks, not silently: it changes the machine. It lives under `~/.cache` rather than inside the plugin because the plugin cache is versioned and replaced on update, and a `node_modules` inside it would vanish with the old version.

## Headed or headless

Headed is the default: the user sees what is being tested, in order, and a misfiring selector is obvious on screen. Headless is for repeating a run — after fixing a selector, or to re-check a build — when nobody needs to watch. Same profile, same screenshots, same results; only the window differs.

## Reading the results

`qa-results.json` has one entry per scenario:

```json
{
  "n": "03", "slug": "apply-villa-chip-url", "status": "pass",
  "values": { "after": 6, "chip": "Property type: Villa" },
  "expects": [{ "desc": "fewer rows than the baseline", "passed": true, "actual": 6, "expected": 11 }],
  "caption": "The list drops from 11 to <b>6</b> records …",
  "screenshot": "screenshots/03-apply-villa-chip-url.jpg",
  "console": []
}
```

- `pass` / `fail` / `check` map straight onto the report table. A `fail` entry names the assertion that broke and the value it saw — that is the "Actual" line of the finding, already written
- `error` means a step could not run: the selector matched nothing, a wait timed out, the page threw. It is not a FAIL and it is not a CHECK. Read the message, fix the step in `qa-scenarios.json`, re-run that scenario with `--only NN`. The screenshot is at `NN-slug.error.jpg` so `check-evidence.js` refuses the run until it is replaced. A `--only` run merges its entries into the existing `qa-results.json` by number and removes the `.error.jpg` of a scenario that now ran, so the full file stays the single record of the run. Re-run the scenarios it depends on with it (`--only 13,14`) when the fixed one needs state an earlier one builds
- `console` holds console errors, page errors, failed requests and HTTP 4xx/5xx seen during that scenario. An empty list is worth a glance too when a scenario failed — no failed request narrows the cause to the front end
- `warning` on a passed scenario means it had no `expect`. Add one or mark it manual before trusting the row

The `values` map is what goes into the report's findings and captions; nothing in the report should carry a number that is not in the results file.

## When to use the Chrome extension instead

- the app needs the user's real session and it cannot be reproduced in the QA profile — hardware keys, a corporate SSO that pins the device
- a browser extension is part of what is under test
- the app refuses automated browsers outright

Then choose the Chrome driver at the start; the scenario file is still written, and [browser-driving.md](browser-driving.md) covers executing it by hand in batches.

## What the runner does not do

It does not log in, does not install anything, does not close dialogs, does not post results. A native `alert` or `confirm` in the app blocks the page — Playwright dismisses them by default, so a scenario that depends on the dialog's choice needs to be marked manual.
