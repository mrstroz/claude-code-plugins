---
name: ui-test-report
description: Run a feature through a real browser and come back with proof it works — derive the scenarios from the ticket and the diff, or execute the list you were handed as written, write them down as a scenario file with the test data they need, click through every one of them, caption each screenshot with the scenario number, a red frame around the element that proves it and the values read from the page, verify the result with a JavaScript assertion (and, when the user chooses withDB, a read-only database query) against values fixed before the run rather than by eye, and hand back a numbered pass/fail/blocked table plus a "things to fix" section with reproduction steps, all saved under docs/qa/<TASK>/ in the repository as one scenario file, one results file, one report and one screenshots directory. Two ways to drive the browser, chosen at the start — Playwright in a QA window that stays open between runs (default: Chromium or Brave on its own profile, logged in once by hand, one command runs the whole file while you watch, or --fast for a re-run), or the user's own Chrome through the Claude in Chrome extension when the app needs their real session or extensions. Use whenever the user wants a feature exercised in the UI rather than described: "przetestuj to w przeglądarce", "przeklikaj to i zrób screenshoty", "sprawdź czy to działa w UI", "sprawdź czy to się zapisało w bazie", "zrób testy tej funkcji", "pokaż że to działa", "przetestuj dokładnie ten feature", "zrób QA tego zanim zmerguję", "odpal to w playwright", "przejdź te scenariusze", "powtórz scenariusz 7", "test this in the browser", "click through the feature and screenshot it", "QA this before I merge", "check the database after the save", "walk me through it and show it works", "verify this works end to end in the app", "run these scenarios", "run the QA scenarios again", "re-run scenario 07" — and after finishing an implementation when the user asks whether it actually works. Do NOT use it to write automated tests — Playwright or Cypress specs are ordinary code. Do NOT use it to only draft a list of what should be tested for a release; that is jira:jira-testing-release, which produces the plan this skill executes.
argument-hint: "[what to test and where, e.g. \"property filtering on localhost:3000\" or \"TES-8147\"]"
---

# Walking a feature through the browser and proving it works

Take a feature that has just been built, work out what actually needs checking — or take the list you were handed — write the checks down as a scenario file, run every one of them in a browser, and come back with a numbered table plus one captioned screenshot per row. The output is meant to be pasted into a ticket and believed without anybody re-running it.

**A screenshot is evidence for a human; a JavaScript assertion is the actual check.** Reading a result off an image is guessing — the ids in the table and `location.search` are facts. Assert first, then take the picture to show the reader what that fact looked like. An assertion is only as good as the value it compares against: "fewer rows than before" passes a filter that keeps the wrong rows, so the expected value is fixed from the data before the run, never read off the result. And a picture proves nothing about the database: when the user chose withDB, a read-only query is the check for what was saved, reported as its own line of evidence.

## Workflow

### 1. Settle scope, driver, database and language

Ask once, with a single `AskUserQuestion`:

- **Driver** — who clicks. Two options, in this order:
  - *Playwright in the QA window* (recommended): a browser window of its own — Chromium, or Brave with `--browser brave` — that stays open between runs. The user logs in once in that window; each run opens a tab, works, closes the tab. One command runs the whole file and the user watches it happen.
  - *Chrome through the extension*: the user's own browser, session and extensions, driven one batch at a time. Slower by a factor of a few; the only choice when the app needs a session the QA window cannot reproduce.
- **Where** the app runs (`http://localhost:3000` and the page under test).
- **What** is under test: a ticket key, a branch, a list of scenarios, or "what we just built".
- **Database** — *"Czy oprócz UI sprawdzać również zapisane dane w lokalnej bazie?"*: **Tylko UI** (default) or **UI + lokalna baza danych (withDB)**. withDB adds read-only queries next to the UI assertions, for the row that appears on screen but was saved under the wrong tenant, twice, or not at all. The answer is written into `scenarios.json` as `"withDB"`, so a re-run reads it from there instead of asking again; ask only when the file does not exist yet or the user is changing the mode.
- **Language** of the on-image captions and the report. Default to English — the report usually ends up in a ticket read by the whole team. Offer the conversation's language as the alternative.

Skip any question the conversation already answers. "Przeklikaj to w moim Chromie" has chosen the driver; a ticket key in the thread has chosen the scope; an existing scenario file has chosen the database. Asking about something you were just told reads as not having paid attention.

### 2. Open the window and look at the app — and the data

Everything the run produces lives in the repository under `docs/qa/<TASK>/`: `scenarios.json` (the plan), `results.json` (the latest run's metadata under `run`, and for every scenario its last result with the id of the run that produced it), `report.md`, `screenshots/` with one picture per scenario, and `records.json` only while test data the runner created is still in the database. `<TASK>` is the ticket key or a short slug of the feature. A re-run overwrites in place — the picture and the entry of every scenario it executed — and leaves the rest as they were, each with its own run id. The repository's history is the archive between builds; the runner keeps none of its own.

Before a single selector is written, open the QA window and read the pages under test through it:

```bash
cd docs/qa/<TASK>
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000 --open
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000 --inspect --url /items
```

`--open` prints the URL the tab landed on. A login page means the user logs in in that window, once — ask them to, and wait. `--inspect` prints one inventory of the page: controls with roles and accessible names, selects with option values, tables with headers and first rows, open dialogs. Add `--steps '[…]'` to read the page inside a drawer, `--eval "…"` for one value the inventory does not carry. Details in [references/playwright-driver.md](references/playwright-driver.md); with the Chrome driver the same inventory comes from pasting `scripts/inspect.js` into `javascript_tool`.

Two things come out of this: the targets as the page actually names them — for the steps and for each scenario's `caption.target`, the element a reader should look at — and the data: which rows exist, their ids, the count before any filter. That is where the expected value of every assertion comes from, decided now. Then decide what the run has to **create** rather than find: rows the scenarios depend on become a named `setup` with `${runId}` in their names, prepared by the runner before the first scenario that uses them and removed afterwards, so a re-run does not build on last week's leftovers. [references/test-data.md](references/test-data.md) has the shapes.

**With withDB**, before anything else: find the database. `--db-discover` reads the project's `docker-compose` files and `docker ps` and prints a skeleton for `docs/qa/qa.config.json` — engine, container or compose service, database, user, and the password as a pointer (`container-env:MYSQL_PASSWORD`), never a value. Ask only for what it could not read. Then `--db-check` connects, describes the connection without the secret, and runs the config's probe — one value read from the UI and from the database — to confirm the app at the base URL reads this database; without a probe, ask the user to confirm and write which of the two happened into the report. `--db "SELECT …"` reads the rows behind the screens for the expected values. All of it in [references/database.md](references/database.md).

### 3. Build the scenario list and write it down

Where the list comes from, in order — the first that applies wins:

1. **The user's instruction now.** "Run 03 to 07 again", "only the drawer", "add the empty-state case": this sets the scope, whatever any file says.
2. **An existing `docs/qa/<TASK>/scenarios.json`.** A re-run starts from it — same numbers, same assertions, same withDB answer — and only the user widens or narrows it.
3. **A list that was handed over** — the ticket's test plan, `jira:jira-testing-release` output, a pasted table. Execute it as written: keep its numbering and expected outcomes, fill in what it leaves open (the selector, the exact value, the wait, the target). Do not ask for approval again.
4. **Derive it** from the acceptance criteria, the diff and the components — the method is in [references/scenario-design.md](references/scenario-design.md). This is the one case where the numbered table is shown and the run waits for a yes.

Cases a handed-over list does not cover go into a separate **Proposed additions** block under the table. They run only when the user takes them; the ones declined are listed in the report under the same heading.

Then write `scenarios.json`, in the format in [references/scenario-file.md](references/scenario-file.md): `withDB`, the app's `ready` condition, the `setups`, and per scenario the number, slug, title, `uses` (setups), `requires` (earlier scenarios whose state it builds on), `given` (what must be true before it starts), the steps — one operation each, an `awaitResponse` on the click that saves, `within` on the read that waits for the refresh or the asynchronous write, a `db` read where withDB is on — the assertions with the expected values from step 2, `leaves` for what the scenario creates through the UI, and the caption with its **target**. Every scenario names the element or region that proves its result: the saved row, the changed field, the counter, the validation message; for an absence, the empty state or the container that stayed the same. The runner draws a red frame around it and writes on the card when it matched nothing. Prefer several short flows on a shared setup over one long chain: `--only 07` then re-runs a setup and a predecessor, not six scenarios.

This happens with every driver — with Playwright it is the runner's input, with Chrome it is the script you follow — and it is what lets the run be repeated. Number scenarios from `01` and keep the numbers stable: they are the key joining a report row to its screenshot file.

### 4. Run the scenarios

#### Playwright in the QA window

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/run-scenarios.mjs" --base-url http://localhost:3000
```

The runner validates the file, opens the database when withDB is on, starts a run in `results.json`, opens a tab, injects the caption overlay, prepares each setup before the first scenario that uses it, checks each scenario's `given`, clicks, asserts, captions, writes the screenshot and the results after every scenario, cleans up the run's data at the end, and closes the tab. `--fast` drops the slow motion for a re-run nobody needs to watch; `--keep-data` leaves the created records in place for a look at the rows behind a FAIL (say so in the report; `--cleanup` removes them later). Five things can come back that need you:

- **It exits before running.** Playwright is missing — show the install command and run it when the user says so — or the file is not runnable: two operations in a step, two comparators in a check, a `${ref}` nothing stores, a `requires` pointing forward, a caption without `target`, a `db` step without `withDB`, a value a `--only` selection does not read. Every problem is listed at once; fix the file. Or the database is unreachable: fix the connection or ask the user whether to run UI only — not both, and never silently.
- **A scenario is `blocked`.** A setup failed, a `given` did not hold, or a scenario it `requires` did not finish in this run. It did not run and has no screenshot. It is a result — BLOCKED in the table, one line under Not run — and not something to make pass. Fix the cause and re-run with `--only NN`; the runner pulls the dependencies and the setups in.
- **A scenario is `error`.** A selector matched nothing, a wait or an `awaitResponse` timed out, a database read failed. That is a step that could not run — and a timeout on a click is exactly what a missing button looks like. Establish the cause before touching anything: `--eval` whether the element exists in that state, the scenario's `console` entries, the code. Then either fix the step, with one sentence in `revision`, and `--only NN`; or record the verdict, `--verdict NN=fail --reason "…"`, which keeps the error as evidence. The sequence is in [references/playwright-driver.md](references/playwright-driver.md). A fix keeps checking the same requirement; a comparator loosened because the strict one failed is a weaker test, and the runner names every rewritten scenario at the end of the run — that line is the record, since `results.json` keeps no history.
- **Scenarios were not executed in this run.** Under `--only`, the runner lists them; their entries keep their earlier run id, and their rows read `PASS (earlier)` in the report, where the reader can see they are not a result on the current state.
- **The run was interrupted.** Ctrl-C finishes the current scenario, cleans up and marks the run `interrupted`; the report has to say so, naming the run.

Read `results.json`: `pass`/`fail`/`check`/`blocked` become the table, a `fail` entry already carries the assertion, its source (`ui`, `db`, `http`), the actual value and the reason, and `values` holds every number the captions and findings may quote.

#### Chrome through the extension

Load every Chrome tool in one `ToolSearch` call rather than one call per tool:

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__read_network_requests
```

The runner still owns the results file, the test data and the database: `--new-run --driver chrome` starts the run in `results.json`, `--prepare` runs the setups into the ledger, `--db` reads the database, you write one entry per scenario under `scenarios` in `results.json`, and `--finish` checks them, cleans up and closes the run. The clicking, waiting, asserting and captioning are yours, by hand: there is no `awaitResponse`, no `within`, no automatic blocking here, and the report says the run was hand-driven. Then `tabs_context_mcp`, a new tab, `navigate`, and inject the overlay: `Read` the file below and paste its contents into `javascript_tool`.

```
${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/annotate.js
```

If the extension is not connected, stop and say so — or offer the Playwright driver. Quietly falling back to "here is how you could test this yourself" produces a document that looks like a QA report and contains no evidence.

Then, per scenario, two round trips rather than six: `find` for the refs, then one `browser_batch` with the click, a `find` inside whatever opened, the assertion, `__ann()` and the screenshot. [references/browser-driving.md](references/browser-driving.md) has the batch shape, what breaks it, and how `uses`, `given`, `requires`, a database check and an error are handled by hand.

```js
const ids = Array.from(document.querySelectorAll("tbody td.id")).map((td) => td.innerText.trim());
const expected = ["P-101", "P-103", "P-104", "P-107", "P-109", "P-111"]; // the villas in the seed, read in step 2
__ann({
  n: "06", t: "Apply — chip at the top, six villas remain, URL updated",
  d: "Apply closes the drawer and the condition surfaces as a chip: <b>${chip}</b>. Of 11 properties the <b>${n} villas</b> remain, and no other row.",
  v: { chip: document.querySelector(".chip")?.innerText.trim(), n: ids.length },
  ok: JSON.stringify(ids) === JSON.stringify(expected),
  target: { selector: "tbody", label: "six villas" }, hl: [".chip"],
});
```

`ok: true` renders PASS, `false` FAIL, `null` CHECK. Values go in `v` and are escaped on the way into the caption. The screenshot item in the batch uses `save_to_disk: true`; its result names the file it wrote — copy that exact path to `screenshots/NN-slug.jpg`.

### 5. Look at the pictures

The assertions measured what they were told to; the pictures show everything else. `Read` a selection — every FAIL, the first picture of each UI state, a handful of the rest, and any whose caption reported a missing target — and look for what no assertion covered: elements overlapping, a label cut off, a button under a sticky footer. The caption card and the red frames are overlays and not part of the page.

Write what you saw under "Visual observations", opening with the numbers looked at. An observation never changes a row on its own. When it breaks an explicit criterion, record it with `--verdict NN=fail --reason "…"` and write the finding, opening with the fact that the picture's caption still reads PASS and the verdict supersedes it.

### 6. Write the report

Format in [references/reporting.md](references/reporting.md): the three-column table, the findings with UI and DB evidence on separate lines, what was not run and why, what changed during the run, the visual observations, the test data created, cleaned or kept, and the build — the local commit and branch, with the note that this is the checkout and not a verified version of the app at that URL. A row from an earlier run says `(earlier)` in its Result cell; an interrupted run is named.

Then verify the evidence is complete:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/check-evidence.js" docs/qa/<TASK>/report.md
```

It reads the report, `results.json` and `screenshots/`, and fails on a row with no screenshot or a screenshot with no row, a BLOCKED row that has a picture or no entry under Not run, a scenario still `error`, a status that disagrees with `results.json`, a row from an earlier run without `(earlier)` — or with it on a row this run executed — a run that was interrupted or kept its data without the report saying so, a `records.json` the Test data section does not mention, a leftover `runs/` directory from 0.7.0, and a capture too small to contain anything. Fix what it reports rather than explaining it away.

### 7. Hand over

`docs/qa/<TASK>/` — the report, `scenarios.json`, `results.json` and `screenshots/` — goes into the repository with the change and nowhere else. A project may ignore `screenshots/` in git; then the repository keeps the report and the results, and the pictures are local evidence for the ticket. If the user wants the report on the ticket, point at `jira:jira-feedback` — this skill posts nothing on its own.

## Three things that ruin a Chrome run

The Playwright runner handles all three. Through the extension they are yours to watch:

**Animations.** A click sent before a drawer finishes sliding lands on the backdrop and closes it. After opening a drawer, `find` something inside it before clicking anything.

**Two pixel scales.** `getBoundingClientRect()` returns CSS pixels; the `computer` tool takes screenshot pixels. Target elements with `find` → `ref`; when only coordinates will do, use `__at(selector, shotWidth)` from the overlay.

**A reload wipes the overlay.** Re-inject before the next captioned screenshot, and call `__annClear()` before the next scenario's clicks — the overlays are click-through, but a stale card on a picture is a caption for the wrong scenario.

## What counts as a finding

A scenario that behaves differently from the acceptance criteria is a FAIL and needs reproduction steps — with the UI and the database evidence on their own lines when both were read. A scenario the tooling could not exercise is a CHECK, and needs one sentence saying what a human should do instead. A scenario that did not run because its setup failed, its precondition did not hold or its dependency did not finish is BLOCKED, and needs one line saying what would unblock it. A database check that could not be made is none of these: it is an error to settle before handover, never a PASS on the UI alone. "The data is wrong" and "the data could not be checked" are two different sentences.

A step that could not run is not yet any of these. Find out why before rewriting it: the element that is not there may be the bug, and a test rewritten to get past it has hidden the finding it was written to make.

When a failure has an obvious cause in the code, read enough to name it — the file and the function, not a guess at the fix.
