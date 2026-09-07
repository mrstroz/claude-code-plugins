---
name: ui-test-report
description: Run a feature through a real browser and come back with proof it works — derive the scenarios from the ticket and the diff, or execute the list you were handed as written, write them down as a scenario file, click through every one of them, caption each screenshot with the scenario number and what it proves, verify the result with a JavaScript assertion against values fixed before the run rather than by eye, and hand back a numbered pass/fail/blocked table plus a "things to fix" section with reproduction steps, all saved under docs/qa/<TASK>/ in the repository. Two ways to drive the browser, chosen at the start — Playwright in a QA window that stays open between runs (default: Chromium or Brave on its own profile, logged in once by hand, one command runs the whole file while you watch), or the user's own Chrome through the Claude in Chrome extension when the app needs their real session or extensions. Use whenever the user wants a feature exercised in the UI rather than described: "przetestuj to w przeglądarce", "przeklikaj to i zrób screenshoty", "sprawdź czy to działa w UI", "zrób testy tej funkcji", "pokaż że to działa", "przetestuj dokładnie ten feature", "zrób QA tego zanim zmerguję", "odpal to w playwright", "przejdź te scenariusze", "test this in the browser", "click through the feature and screenshot it", "QA this before I merge", "walk me through it and show it works", "verify this works end to end in the app", "run these scenarios", "run the QA scenarios again" — and after finishing an implementation when the user asks whether it actually works. Do NOT use it to write automated tests — Playwright or Cypress specs are ordinary code. Do NOT use it to only draft a list of what should be tested for a release; that is jira:jira-testing-release, which produces the plan this skill executes.
argument-hint: "[what to test and where, e.g. \"property filtering on localhost:3000\" or \"TES-8147\"]"
---

# Walking a feature through the browser and proving it works

Take a feature that has just been built, work out what actually needs checking — or take the list you were handed — write the checks down as a scenario file, run every one of them in a browser, and come back with a numbered table plus one captioned screenshot per row. The output is meant to be pasted into a ticket and believed without anybody re-running it.

**A screenshot is evidence for a human; a JavaScript assertion is the actual check.** Reading a result off an image is guessing — the ids in the table and `location.search` are facts. Assert first, then take the picture to show the reader what that fact looked like. An assertion is only as good as the value it compares against: "fewer rows than before" passes a filter that keeps the wrong rows, so the expected value is fixed from the data before the run, never read off the result.

## Workflow

### 1. Settle scope, driver and language

Ask once, with a single `AskUserQuestion`:

- **Driver** — who clicks. Two options, in this order:
  - *Playwright in the QA window* (recommended): a browser window of its own — Chromium, or Brave with `--browser brave` when the user prefers it — that stays open between runs. The user logs in once in that window; each run opens a tab, works, closes the tab. One command runs the whole file and the user watches it happen.
  - *Chrome through the extension*: the user's own browser, session and extensions, driven one batch at a time. Slower by a factor of a few; the only choice when the app needs a session the QA window cannot reproduce.
- **Where** the app runs (`http://localhost:3000` and the page under test).
- **What** is under test: a ticket key, a branch, a list of scenarios, or "what we just built".
- **Language** of the on-image captions and the report. Default to English — the report usually ends up in a ticket read by the whole team. Offer the conversation's language as the alternative.

Skip any question the conversation already answers. "Przeklikaj to w moim Chromie" has chosen the driver; a ticket key in the thread has chosen the scope. Asking about something you were just told reads as not having paid attention.

### 2. Open the window and look at the app

Everything the run produces lives in the repository under `docs/qa/<TASK>/`: `scenarios.json`, `results.json`, `report.md` and `screenshots/`. `<TASK>` is the ticket key — from the conversation, or from the branch name (`RO-2562-stock-items-perf` → `RO-2562`) — and a short slug of the feature (`filter-drawer`) when there is no ticket. The report and its pictures belong with the code they test and travel in the same pull request; a directory next to the repository is one nobody will find in a month.

Before a single selector is written, open the QA window and read the pages under test through it:

```bash
cd docs/qa/<TASK>
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000 --open
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000 --inspect --url /items
```

`--open` prints the URL the tab landed on. A login page means the user logs in in that window, once — ask them to, and wait; the session lives as long as the window does. `--inspect` prints one inventory of the page: the controls with their roles and accessible names, the selects with their option values, the tables with headers, row counts and first rows, open dialogs. Add `--steps '[…]'` to read the page inside a drawer or after a dialog opened — a page has more states than URLs — and `--eval "…"` for one value the inventory does not carry. Details in [references/playwright-driver.md](references/playwright-driver.md); with the Chrome driver the same inventory comes from pasting `scripts/inspect.js` into `javascript_tool`.

Two things come out of this that nothing else provides: the targets as the page actually names them, so the file is written from what exists rather than corrected forty times against it; and the data — which rows exist, their ids, the count before any filter. That is where the expected value of every assertion comes from, decided now. A scenario that reads the filtered table and asserts what it found has checked nothing.

### 3. Build the scenario list and write it down

Where the list comes from, in order — the first that applies wins:

1. **The user's instruction now.** "Run 03 to 07 again", "only the drawer", "add the empty-state case": this sets the scope, whatever any file says.
2. **An existing `docs/qa/<TASK>/scenarios.json`.** A re-run starts from it — same numbers, same assertions — and only the user widens or narrows it.
3. **A list that was handed over** — the ticket's test plan, `jira:jira-testing-release` output, a pasted table. Execute it as written: keep its numbering and its expected outcomes, and fill in what it leaves open (the selector, the exact value, the wait). It was approved by whoever wrote it; do not ask for approval again.
4. **Derive it** from the acceptance criteria, the diff and the components — the method is in [references/scenario-design.md](references/scenario-design.md). This is the one case where the numbered table is shown and the run waits for a yes: fixing the list costs one sentence now and the whole run after forty screenshots.

Cases a handed-over list does not cover go into a separate **Proposed additions** block under the table. They run only when the user takes them; the ones declined are listed in the report under the same heading, so the gap stays visible. The scope of a run is the reader's to set, and a list that grows every time it is executed stops being the plan.

Then write `scenarios.json`, in the format in [references/scenario-file.md](references/scenario-file.md): number, slug, title, `requires` naming the scenarios it builds on, `given` for what must be true before it starts, the steps, the assertions with the expected values from step 2, and the caption template. This happens with every driver — with Playwright it is the runner's input, with Chrome it is the script you follow — and it is what lets the run be repeated, `--only 07` after a fix or the whole file on the next build, without designing it again.

Number scenarios from `01` and keep the numbers stable for the rest of the run — they are the key joining a report row to its screenshot file. Create `screenshots/` next to the report before the first capture.

### 4. Run the scenarios

#### Playwright in the QA window

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000
```

The runner validates the file, opens a tab, injects the caption overlay, checks each scenario's `given`, clicks, asserts, captions, writes `screenshots/NN-slug.jpg` and `results.json`, and closes the tab. The window stays open for the next run and for the user to look at; `--close` ends it when the session is over. Four things can come back that need you:

- **It exits before running.** Playwright is missing — show the install command and run it when the user says so, since changing the machine is not this skill's call — or the file is not runnable: a scenario with no `expect` and no `manual`, a `${ref}` nothing reads, a `requires` pointing forward. Every problem is listed at once; fix the file.
- **A scenario is `blocked`.** A `given` did not hold, or a scenario it `requires` did not run to the end — an error, even one already judged a FAIL, counts as not finished. It did not run and has no screenshot. It is a result — BLOCKED in the table, one line under Not run — and not something to make pass. Fix the state or the dependency and re-run with `--only NN`; the runner pulls the dependencies in and runs them first.
- **A scenario is `error`.** A selector matched nothing or a wait timed out. That is a step that could not run — and a timeout on a click is exactly what a missing button looks like, which may be the bug. Establish the cause before touching anything: `--eval` whether the element exists in that state, the scenario's `console` entries in `results.json`, the code that renders it. Then either fix the step, with one sentence in `revision` saying what the earlier version got wrong, and `--only NN`; or record the verdict, `--verdict NN=fail --reason "…"`, which keeps the error as evidence and turns the row into a FAIL. The sequence is in [references/playwright-driver.md](references/playwright-driver.md). A fix has to keep checking the same requirement: a comparator loosened because the strict one failed is a weaker test, and the history in the results will show it.
- **A scenario changed status or steps since the previous results.** The runner lists them and keeps the earlier entry under `history`. The report says so in "Changes to the scenarios during the run", from the `revision` lines — otherwise a PASS that was a FAIL an hour ago reads as a fix that never happened. Do not wipe `screenshots/` or `results.json` before a re-run; the runner overwrites by name and removes stale pictures itself.

Read `results.json`: `pass`/`fail`/`check`/`blocked` become the table, a `fail` entry already carries the assertion and the actual value for the finding, and `values` holds every number the captions and findings may quote.

#### Chrome through the extension

Load every Chrome tool in one `ToolSearch` call rather than one call per tool:

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__read_console_messages
```

Then `tabs_context_mcp`, a new tab, `navigate`, and inject the overlay: `Read` the file below and paste its contents into `javascript_tool`. It defines `__ann()` for captions, `__annClear()` to remove them, and `__at()` for coordinate conversion.

```
${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/annotate.js
```

If the extension is not connected, stop and say so — or offer the Playwright driver, which needs nothing from the browser. Quietly falling back to "here is how you could test this yourself" produces a document that looks like a QA report and contains no evidence, which is worse than an error.

Then, per scenario, two round trips rather than six: `find` for the refs, then one `browser_batch` with the click, a `find` inside whatever opened, the assertion, `__ann()` and the screenshot. The caption reads its number from the DOM inside the `__ann()` call, so the value on the picture is the one the page had at capture time. [references/browser-driving.md](references/browser-driving.md) has the batch shape, what breaks it, and how `given`, `requires` and an error are handled by hand.

```js
const ids = Array.from(document.querySelectorAll("tbody td.id")).map((td) => td.innerText.trim());
const expected = ["P-101", "P-103", "P-104", "P-107", "P-109", "P-111"]; // the villas in the seed, read in step 2
__ann({
  n: "06",
  t: "Apply — chip at the top, six villas remain, URL updated",
  d: `Apply closes the drawer and the condition surfaces as a chip: <b>Property type: Villa</b>. Of 11 properties the <b>${ids.length} villas</b> remain, and no other row. The URL now carries <code>?type[]=villa</code>.`,
  ok: JSON.stringify(ids) === JSON.stringify(expected),
  hl: [".overview-filter-chip"],
  pins: [[".overview-filter-chip", "Applied filter, removable", 0, -38]],
});
```

`ok: true` renders PASS, `false` renders FAIL, `null` renders CHECK. `top: true` moves the card to the top when the bottom of the screen is part of what the scenario shows. The screenshot item in the batch uses `save_to_disk: true`; its result names the file it wrote — copy that exact path to `screenshots/NN-slug.jpg`.

Keep the slug short and descriptive (`06-apply-chip-filtered-url.jpg`). Zero-padded numbers keep file order and table order identical, which is what lets a reader scan the directory and follow the run.

### 5. Look at the pictures

The assertions measured what they were told to; the pictures show everything else. `Read` a selection of them — every FAIL, the first picture of each UI state the run reaches (the first drawer, the first dialog, the empty state), and a handful of the rest — and look for what no assertion covered: elements overlapping, a label cut off, a button under a sticky footer, a layout broken at this viewport. The caption card sits bottom-left and is not part of the page.

Write what you saw under "Visual observations" in the report, opening with the numbers looked at, so the reader knows what was not. An observation never changes a row on its own. When it breaks an explicit criterion of that scenario — the dialog the criterion needs is unreachable because it is clipped — record it with `--verdict NN=fail --reason "…"` and write the finding, opening with the fact that the picture's caption still reads PASS and the verdict supersedes it: the badge was drawn at capture and does not change. Images cost tokens, which is why this is a selection and why saying which ones matters.

### 6. Write the report

Format in [references/reporting.md](references/reporting.md): the results table, the findings, what was not run and why, what changed during the run, the visual observations, and a note about anything left behind in the test environment. The opening paragraph names the driver and the coverage — a different session has different permissions and extensions, and a reviewer reading a FAIL needs to know which browser saw it and how much of the list ran.

Then verify the evidence is complete:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/check-evidence.js" docs/qa/<TASK>/report.md
```

It reads the report, `screenshots/` and, when present, `results.json`, and fails on a row with no screenshot, a screenshot with no row, a BLOCKED row that has a picture or no entry under Not run, a scenario still `error` in the results, a row whose status disagrees with the results, a scenario rewritten without a `revision`, and a capture too small to contain anything. Fix what it reports rather than explaining it away; a row nobody can check is the one failure mode this whole format exists to prevent.

### 7. Hand over

`docs/qa/<TASK>/` — the report, `screenshots/`, `scenarios.json` and `results.json` — goes into the repository with the change and nowhere else. If the user wants the report on the ticket, point at `jira:jira-feedback` — this skill posts nothing on its own, so a run can never surprise anyone by appearing in a tracker.

## Three things that ruin a Chrome run

The Playwright runner handles all three — it waits for elements, targets by selector and re-injects the overlay on every navigation. Through the extension they are yours to watch:

**Animations.** Side sheets, drawers and modals slide in over roughly 300 ms. A click sent before that finishes lands on the backdrop and closes the panel you just opened. It looks exactly like "the button does nothing", so it is easy to misdiagnose as a bug in the product. After opening a drawer, `find` something inside it before clicking anything.

**Two pixel scales.** `getBoundingClientRect()` returns CSS pixels; the `computer` tool takes screenshot pixels, and they differ (1920 vs 1568 is typical). Target elements with `find` → `ref` and the problem does not arise. When only coordinates will do, use `__at(selector, shotWidth)` from the overlay, passing the width the last screenshot reported.

**A reload wipes the overlay.** `location.reload()` and hard navigation throw away the page context, `__ann` with it. Re-inject before the next captioned screenshot — otherwise the call silently fails and you get an uncaptioned image that looks like all the others. And call `__annClear()` before the next scenario's clicks: the card is fixed and on top of everything, so left in place it swallows a click on whatever sits under it.

## What counts as a finding

A scenario that behaves differently from the acceptance criteria is a FAIL and needs reproduction steps. A scenario the tooling could not exercise — a drag the sortable library ignores because the event was synthetic, a flow needing a second account, a native `confirm` whose answer matters — is a CHECK, and needs one sentence saying what a human should do instead. A scenario that did not run because its precondition did not hold or its dependency did not finish is BLOCKED, and needs one line saying what would unblock it.

Keeping those apart matters more than it sounds. A report that marks tooling limits as failures teaches the team to skim past failures, one that marks them as passes claims coverage it does not have, and one that quietly re-runs a blocked scenario until it passes has tested a state the app was never in.

A step that could not run is not yet any of these. Find out why before rewriting it: the element that is not there may be the bug, and a test rewritten to get past it has hidden the finding it was written to make. When the step was wrong, the fix keeps the same requirement under test and says in `revision` what the earlier version got wrong — the runner keeps the earlier version in the results, so a fix that made the check weaker is visible either way.

When a failure has an obvious cause in the code, read enough to name it — the file and the function, not a guess at the fix. That is the difference between a bug report and one somebody can act on without repeating your investigation.
