---
name: ui-test-report
description: Run a feature through a real browser and come back with proof it works — derive the scenarios from the ticket and the diff, write them down as a scenario file, click through every one of them, caption each screenshot with the scenario number and what it proves, verify the result with a JavaScript assertion rather than by eye, and hand back a numbered pass/fail table plus a "things to fix" section with reproduction steps, all saved under docs/qa/<TASK>/ in the repository. Two ways to drive the browser, chosen at the start — Playwright in a QA window that stays open between runs (default: Chromium or Brave on its own profile, logged in once by hand, one command runs the whole file while you watch), or the user's own Chrome through the Claude in Chrome extension when the app needs their real session or extensions. Use whenever the user wants a feature exercised in the UI rather than described: "przetestuj to w przeglądarce", "przeklikaj to i zrób screenshoty", "sprawdź czy to działa w UI", "zrób testy tej funkcji", "pokaż że to działa", "przetestuj dokładnie ten feature", "zrób QA tego zanim zmerguję", "odpal to w playwright", "test this in the browser", "click through the feature and screenshot it", "QA this before I merge", "walk me through it and show it works", "verify this works end to end in the app", "run the QA scenarios again" — and after finishing an implementation when the user asks whether it actually works. Do NOT use it to write automated tests — Playwright or Cypress specs are ordinary code. Do NOT use it to only draft a list of what should be tested for a release; that is jira:jira-testing-release, which produces the plan this skill executes.
argument-hint: "[what to test and where, e.g. \"property filtering on localhost:3000\" or \"TES-8147\"]"
---

# Walking a feature through the browser and proving it works

Take a feature that has just been built, work out what actually needs checking, write the checks down as a scenario file, run every one of them in a browser, and come back with a numbered table plus one captioned screenshot per row. The output is meant to be pasted into a ticket and believed without anybody re-running it.

**A screenshot is evidence for a human; a JavaScript assertion is the actual check.** Reading a result off an image is guessing — `document.querySelectorAll('tbody tr').length` and `location.search` are facts. Assert first, then take the picture to show the reader what that fact looked like.

## Workflow

### 1. Settle scope, driver and language

Ask once, with a single `AskUserQuestion`:

- **Driver** — who clicks. Two options, in this order:
  - *Playwright in the QA window* (recommended): a browser window of its own — Chromium, or Brave with `--browser brave` when the user prefers it — that stays open between runs. The user logs in once in that window; each run opens a tab, works, closes the tab. One command runs the whole file and the user watches it happen.
  - *Chrome through the extension*: the user's own browser, session and extensions, driven one batch at a time. Slower by a factor of a few; the only choice when the app needs a session the QA window cannot reproduce.
- **Where** the app runs (`http://localhost:3000` and the page under test).
- **What** is under test: a ticket key, a branch, or "what we just built".
- **Language** of the on-image captions and the report. Default to English — the report usually ends up in a ticket read by the whole team. Offer the conversation's language as the alternative.

Skip any question the conversation already answers. "Przeklikaj to w moim Chromie" has chosen the driver; a ticket key in the thread has chosen the scope. Asking about something you were just told reads as not having paid attention.

### 2. Build the scenario list, get it signed off, write it down

Derive coverage from the ticket's acceptance criteria and the feature's diff — the method is in [references/scenario-design.md](references/scenario-design.md).

Show the numbered table and wait for a yes before the first click. Fixing the list costs one sentence now; discovering a gap after forty screenshots costs the whole run.

Everything the run produces lives in the repository under `docs/qa/<TASK>/`: `scenarios.json`, `results.json`, `report.md` and `screenshots/`. `<TASK>` is the ticket key — from the conversation, or from the branch name (`RO-2562-stock-items-perf` → `RO-2562`) — and a short slug of the feature (`filter-drawer`) when there is no ticket. The report and its pictures belong with the code they test and travel in the same pull request; a directory next to the repository is one nobody will find in a month. Write nothing temporary in there — a throwaway scenario file for probing the DOM is what `--eval` is for.

Then write `scenarios.json` there, in the format in [references/scenario-file.md](references/scenario-file.md): number, slug, title, the steps, the assertions and the caption template for each row. This happens with every driver. With Playwright it is the runner's input; with Chrome it is the script you follow, and either way it is what lets the run be repeated — `--only 07` after a fix, or the whole thing on the next build — without designing it again.

Number scenarios from `01` and keep the numbers stable for the rest of the run — they are the key joining a report row to its screenshot file. Create `screenshots/` next to the report before the first capture.

### 3. Run the scenarios

#### Playwright in the QA window

Details in [references/playwright-driver.md](references/playwright-driver.md). Open the window first and check where the app lands:

```bash
cd docs/qa/<TASK>
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000 --open
```

It prints the URL of the tab. A login page means the user has to log in in that window — ask them to, and wait; there is no flag to pass and nothing to press afterwards, the session simply lives as long as the window does. While writing selectors, read the page through the same window instead of guessing or writing a probe file: `--eval "document.querySelector('table').className" --url /items` returns one value and closes its tab.

Then one command runs the file:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000
```

The runner opens a tab, injects the caption overlay, clicks, asserts, captions, writes `screenshots/NN-slug.jpg` and `results.json`, and closes the tab. The window stays open for the next run and for the user to look at; `--close` ends it when the session is over. Three things can come back that need you:

- **It exits with an install command.** Playwright is not on the machine. Show the command and run it when the user says so; it changes the machine, which is not this skill's call.
- **A scenario is `error`.** A selector matched nothing or a wait timed out. That is a broken step, not a finding: fix it in `scenarios.json` and re-run with `--only NN`. Its screenshot is named so that `check-evidence.js` rejects it, so it cannot slip into the report by accident.
- **A scenario changed status since the previous results.** The runner lists them at the end and keeps the earlier entry under `history` in `results.json`. Rewriting an assertion that turned out to be wrong is normal — a JavaScript string comparison is not a database collation — but the report then has to say so, in its "Changes to the scenarios during the run" section, or a PASS that was a FAIL an hour ago reads as a fix that never happened. Do not wipe `screenshots/` or `results.json` before a re-run; the runner overwrites by name, and the history is what a reviewer needs.

Read `results.json`: `pass`/`fail`/`check` become the table, a `fail` entry already carries the assertion and the actual value for the finding, and `values` holds every number the captions and findings may quote.

#### Chrome through the extension

Load every Chrome tool in one `ToolSearch` call rather than one call per tool:

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__read_console_messages
```

Then `tabs_context_mcp`, a new tab, `navigate`, and inject the overlay: `Read` the file below and paste its contents into `javascript_tool`. It defines `__ann()` for captions and `__at()` for coordinate conversion.

```
${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/annotate.js
```

If the extension is not connected, stop and say so — or offer the Playwright driver, which needs nothing from the browser. Quietly falling back to "here is how you could test this yourself" produces a document that looks like a QA report and contains no evidence, which is worse than an error.

Then, per scenario, two round trips rather than six: `find` for the refs, then one `browser_batch` with the click, a `find` inside whatever opened, the assertion, `__ann()` and the screenshot. The caption reads its number from the DOM inside the `__ann()` call, so the value on the picture is the one the page had at capture time. [references/browser-driving.md](references/browser-driving.md) has the batch shape and what breaks it.

```js
const n = document.querySelectorAll("tbody tr").length;
__ann({
  n: "06",
  t: "Apply — chip at the top, list filtered, URL updated",
  d: `Apply closes the drawer and the condition surfaces as a chip: <b>Property type: Villa</b>. The list drops from 11 to <b>${n}</b> records. The URL now carries <code>?type[]=villa</code>.`,
  ok: n === 6,
  hl: [".overview-filter-chip"],
  pins: [[".overview-filter-chip", "Applied filter, removable", 0, -38]],
});
```

`ok: true` renders PASS, `false` renders FAIL, `null` renders CHECK. `top: true` moves the card to the top when the bottom of the screen is part of what the scenario shows. The screenshot item in the batch uses `save_to_disk: true`; its result names the file it wrote — copy that exact path to `screenshots/NN-slug.jpg`.

Keep the slug short and descriptive (`06-apply-chip-filtered-url.jpg`). Zero-padded numbers keep file order and table order identical, which is what lets a reader scan the directory and follow the run.

### 4. Write the report

Format in [references/reporting.md](references/reporting.md): the results table, then the findings, then a note about anything left behind in the test environment. The opening paragraph names the driver — a different session has different permissions and extensions, and a reviewer reading a FAIL needs to know which browser saw it.

Then verify the evidence is complete:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/check-evidence.js" docs/qa/<TASK>/report.md docs/qa/<TASK>/screenshots
```

It fails on a row with no screenshot, a screenshot with no row, a malformed name — including the runner's `*.error.jpg` — and a capture too small to contain anything. Fix what it reports rather than explaining it away; a row nobody can check is the one failure mode this whole format exists to prevent.

### 5. Hand over

`docs/qa/<TASK>/` — the report, `screenshots/`, `scenarios.json` and `results.json` — goes into the repository with the change and nowhere else. If the user wants the report on the ticket, point at `jira:jira-feedback` — this skill posts nothing on its own, so a run can never surprise anyone by appearing in a tracker.

## Three things that ruin a Chrome run

The Playwright runner handles all three — it waits for elements, targets by selector and re-injects the overlay on every navigation. Through the extension they are yours to watch:

**Animations.** Side sheets, drawers and modals slide in over roughly 300 ms. A click sent before that finishes lands on the backdrop and closes the panel you just opened. It looks exactly like "the button does nothing", so it is easy to misdiagnose as a bug in the product. After opening a drawer, `find` something inside it before clicking anything.

**Two pixel scales.** `getBoundingClientRect()` returns CSS pixels; the `computer` tool takes screenshot pixels, and they differ (1920 vs 1568 is typical). Target elements with `find` → `ref` and the problem does not arise. When only coordinates will do, use `__at(selector, shotWidth)` from the overlay, passing the width the last screenshot reported.

**A reload wipes the overlay.** `location.reload()` and hard navigation throw away the page context, `__ann` with it. Re-inject before the next captioned screenshot — otherwise the call silently fails and you get an uncaptioned image that looks like all the others.

## What counts as a finding

A scenario that behaves differently from the acceptance criteria is a FAIL and needs reproduction steps. A scenario the tooling could not exercise — a drag the sortable library ignores because the event was synthetic, a flow needing a second account, a native `confirm` whose answer matters — is a CHECK, and needs one sentence saying what a human should do instead.

Keeping those apart matters more than it sounds. A report that marks tooling limits as failures teaches the team to skim past failures, and one that marks them as passes claims coverage it does not have.

When a failure has an obvious cause in the code, read enough to name it — the file and the function, not a guess at the fix. That is the difference between a bug report and one somebody can act on without repeating your investigation.
