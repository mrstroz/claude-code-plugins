---
name: ui-test-report
description: Run a feature through a real Chrome session and come back with proof it works — derive the scenarios from the ticket and the diff, click through every one of them in the browser, caption each screenshot with the scenario number and what it proves, verify the result in JavaScript rather than by eye, and hand back a numbered pass/fail table plus a "things to fix" section with reproduction steps. Use whenever the user wants a feature exercised in the UI rather than described: "przetestuj to w przeglądarce", "przeklikaj to i zrób screenshoty", "sprawdź czy to działa w UI", "zrób testy tej funkcji", "pokaż że to działa", "przetestuj dokładnie ten feature", "zrób QA tego zanim zmerguję", "test this in the browser", "click through the feature and screenshot it", "QA this before I merge", "walk me through it and show it works", "verify this works end to end in the app" — and after finishing an implementation when the user asks whether it actually works. Needs the Claude in Chrome extension connected; it drives a real logged-in browser, not a headless one. Do NOT use it to write automated tests — Playwright or Cypress specs are ordinary code. Do NOT use it to only draft a list of what should be tested for a release; that is jira:jira-testing-release, which produces the plan this skill executes.
argument-hint: "[what to test and where, e.g. \"property filtering on localhost:3000\" or \"TES-8147\"]"
---

# Walking a feature through the browser and proving it works

Take a feature that has just been built, work out what actually needs checking, click through every case in a real Chrome session, and come back with a numbered table plus one captioned screenshot per row. The output is meant to be pasted into a ticket and believed without anybody re-running it.

**A screenshot is evidence for a human; a JavaScript assertion is the actual check.** Reading a result off an image is guessing — `document.querySelectorAll('tbody tr').length` and `location.search` are facts. Assert first, then take the picture to show the reader what that fact looked like.

## Workflow

### 1. Settle scope and language

Ask once, with a single `AskUserQuestion`:

- **Language** of the on-image captions and the report. Default to English — the report usually ends up in a ticket read by the whole team. Offer the conversation's language as the alternative.
- **Where** the app runs (`http://localhost:3000` and the page under test).
- **What** is under test: a ticket key, a branch, or "what we just built".

Skip any question the conversation already answers. If a ticket key or a fresh diff is right there in the thread, use it — asking about something you were just told reads as not having paid attention.

### 2. Build the scenario list, and get it signed off

Derive coverage from the ticket's acceptance criteria and the feature's diff — the method is in [references/scenario-design.md](references/scenario-design.md).

Show the numbered table and wait for a yes before the first click. Fixing the list costs one sentence now; discovering a gap after forty screenshots costs the whole run.

Number scenarios from `01` and keep the numbers stable for the rest of the run — they are the key joining a report row to its screenshot file.

### 3. Open the app

Load every Chrome tool in one `ToolSearch` call rather than one call per tool:

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__read_console_messages
```

Then `tabs_context_mcp`, a new tab, `navigate`, and inject the overlay: `Read` the file below and paste its contents into `javascript_tool`. It defines `__ann()` for captions and `__at()` for coordinate conversion.

```
${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/annotate.js
```

If the extension is not connected, stop and say so. Quietly falling back to "here is how you could test this yourself" produces a document that looks like a QA report and contains no evidence, which is worse than an error.

Create the output directory (`screenshots/` next to the report) before the first capture.

### 4. Run the scenarios, one at a time

For each row:

1. **Act** — drive the UI. Prefer `find` → `ref` over pixel coordinates.
2. **Assert** — `javascript_tool` to read back what changed: result counts, `location.search`, chip or badge text, a toggle's class. Record the actual value; it goes into the caption.
3. **Caption** — call `__ann()` with the scenario number, a short title, one or two sentences of detail including the numbers you just read, and the verdict.

   ```js
   __ann({
     n: "06",
     t: "Apply — chip at the top, list filtered, URL updated",
     d: 'Apply closes the drawer and the condition surfaces as a chip: <b>Property type: Villa</b>. The list drops from 11 to <b>6</b> records. The URL now carries <code>?type[]=villa</code>, so the state survives a reload.',
     ok: true,
     hl: [".overview-filter-chip"],
     pins: [[".overview-filter-chip", "Applied filter, removable", 0, -38]],
   });
   ```

   `ok: true` renders PASS, `false` renders FAIL, `null` renders CHECK. `top: true` moves the card to the top when the bottom of the screen is part of what the scenario shows.
4. **Capture** — `computer` with `action: "screenshot"` and `save_to_disk: true`. The result names the file it wrote.
5. **File it** — copy that exact path to `screenshots/NN-slug.jpg`. The tool tells you where the file is, so there is no need to go hunting for the newest thing in `/tmp`.

Keep the slug short and descriptive (`06-apply-chip-filtered-url.jpg`). Zero-padded numbers keep file order and table order identical, which is what lets a reader scan the directory and follow the run.

### 5. Write the report

Format in [references/reporting.md](references/reporting.md): the results table, then the findings, then a note about anything left behind in the test environment.

Then verify the evidence is complete:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ui-test-report/scripts/check-evidence.js" qa-report.md screenshots
```

It fails on a row with no screenshot, a screenshot with no row, a malformed name and a capture too small to contain anything. Fix what it reports rather than explaining it away — a row nobody can check is the one failure mode this whole format exists to prevent.

### 6. Hand over

The report and `screenshots/` stay local. If the user wants them on the ticket, point at `jira:jira-feedback` — this skill posts nothing on its own, so a run can never surprise anyone by appearing in a tracker.

## Three things that ruin a run

**Animations.** Side sheets, drawers and modals slide in over roughly 300 ms. A click sent before that finishes lands on the backdrop and closes the panel you just opened. It looks exactly like "the button does nothing", so it is easy to misdiagnose as a bug in the product. After opening a drawer, take a confirming screenshot before clicking anything inside it.

**Two pixel scales.** `getBoundingClientRect()` returns CSS pixels; the `computer` tool takes screenshot pixels, and they differ (1920 vs 1568 is typical). Target elements with `find` → `ref` and the problem does not arise. When only coordinates will do, use `__at(selector, shotWidth)` from the overlay, passing the width the last screenshot reported.

**A reload wipes the overlay.** `location.reload()` and hard navigation throw away the page context, `__ann` with it. Re-inject before the next captioned screenshot — otherwise the call silently fails and you get an uncaptioned image that looks like all the others.

More on driving the browser, including the assertions worth reaching for and what to do when an element stops responding, is in [references/browser-driving.md](references/browser-driving.md).

## What counts as a finding

A scenario that behaves differently from the acceptance criteria is a FAIL and needs reproduction steps. A scenario the tooling could not exercise — a drag the sortable library ignores because the event was synthetic, a flow needing a second account — is a CHECK, and needs one sentence saying what a human should do instead.

Keeping those apart matters more than it sounds. A report that marks tooling limits as failures teaches the team to skim past failures, and one that marks them as passes claims coverage it does not have.

When a failure has an obvious cause in the code, read enough to name it — the file and the function, not a guess at the fix. That is the difference between a bug report and one somebody can act on without repeating your investigation.
