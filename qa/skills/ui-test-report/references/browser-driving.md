# Driving Chrome without wasting turns

The Chrome MCP drives a real browser with the user's real session. That is the point — it tests the app as the user has it, with their login, their data and their extensions — and it is also why a run is worth doing carefully rather than fast. This is the driver to choose when that session cannot be reproduced in the Playwright QA profile; for everything else, [playwright-driver.md](playwright-driver.md) runs the same scenario file in one command.

## What the runner still does, and what it does not

The scenario file, the results file, the test data and the database are the runner's under both drivers. Clicking, waiting, asserting and captioning are yours here — the extension has no `awaitResponse`, no `within`, no automatic blocking on a failed precondition. Be explicit about which is which in the report: a hand-driven run is a hand-driven run.

```bash
cd docs/qa/<TASK>
node …/run-scenarios.mjs --task-dir . --new-run --driver chrome            # prints the run id, starts the run in results.json
node …/run-scenarios.mjs --base-url http://localhost:3000 --prepare        # setups into the ledger, records.json
node …/run-scenarios.mjs --db "SELECT …" --params '[…]'                    # one read-only query, with withDB
node …/run-scenarios.mjs --finish                                          # checks your entries, cleans up, closes the run
node …/run-scenarios.mjs --cleanup                                         # whatever records.json still lists, later
```

`--new-run` writes the `run` block into `results.json` (driver `chrome`, status `manual`, the build block). You write the entries by hand as you go, under `scenarios` in that file — one per scenario with `n`, `slug`, `title`, `status`, `runId` (the id `--new-run` printed), `expects` (each with `desc`, `source`, `passed`, `actual`, `expected`), `values`, `screenshot` (`screenshots/NN-slug.jpg`) and `reason` for a blocked one — and `--finish` validates them (a PASS needs passed expects and a picture), removes the run's test data and marks the run completed. `check-evidence.js` then checks the report against it exactly as for a Playwright run.

## Batching

Every tool call is a full round trip through the model. `browser_batch` runs a list of tool calls in one round trip, sequentially, and returns their outputs and screenshots together.

The shape that works: `find` on its own first, because its refs are the output the batch needs. Then one batch per scenario — click by ref, wait, `javascript_tool` for the assertion, `javascript_tool` for `__ann()`, `computer` screenshot:

```json
[
  { "name": "computer", "input": { "action": "left_click", "ref": "…", "tabId": 123 } },
  { "name": "find", "input": { "query": "Apply button inside the open drawer", "tabId": 123 } },
  { "name": "javascript_tool", "input": { "text": "document.querySelectorAll('tbody tr').length", "tabId": 123 } },
  { "name": "javascript_tool", "input": { "text": "__ann({ n: '03', t: '…', d: '…', v: { n: document.querySelectorAll('tbody tr').length }, ok: true, target: 'tbody' })", "tabId": 123 } },
  { "name": "computer", "input": { "action": "screenshot", "save_to_disk": true, "tabId": 123 } }
]
```

Two constraints shape what goes in a batch:

- **Coordinates written in a batch refer to the screenshot taken before it.** Click by ref and keep coordinates out of batches entirely.
- **A batch stops at the first error.** After an action that opens a panel, the next item is a `find` for something inside that panel: it confirms the panel is there, waits out the animation, and stops the batch with a clear message if the panel did not open.

The caption goes into the batch before its assertion has come back, so do not type the number into `d` — pass the values in `v` and read them from the page inside the same `__ann()` call:

```js
const n = document.querySelectorAll("tbody tr").length;
__ann({ n: "03", t: "Apply — list filtered", d: "The list drops from 11 to <b>${n}</b> records.", v: { n }, ok: n === 6, target: "tbody" });
```

`v` is substituted with HTML escaping, so a value from the page cannot inject markup into the caption; the template's own `<b>` stays. The return value names the selectors that matched nothing — a `target` that is not on the page is written onto the card and belongs in the results entry as `captionDiag`.

## Setup

Load the tools in one `ToolSearch` call. Call `tabs_context_mcp` before anything else, then create a tab for the run rather than reusing one the user is working in. Close it at the end unless the user asked to keep it open. Widen the window if the layout depends on it (`resize_window`).

## Targeting elements

`find` with a natural-language description returns refs; `computer` accepts `ref` in place of `coordinate` for clicks. Prefer that everywhere. Fall back to coordinates only when `find` cannot describe the target, and convert properly: `__at(".filter-toolbar button:nth-of-type(2)", 1568)` with the width the last screenshot reported. `getBoundingClientRect()` clicked verbatim lands in the wrong place — CSS pixels against screenshot pixels, about 20 % apart on a typical setup.

## Assertions and waiting

`javascript_tool` is what turns a screenshot into a verified result: row counts, `location.search`, a chip's text, a toggle's state, the options of an open dropdown. Read the value **before** writing the caption, and put the number in the caption.

What the runner does with `within` and `awaitResponse`, you do by hand: after an action that saves or refetches, poll the value (`javascript_tool` again after a short wait) until it changes or you decide it will not, and write the wait into the results entry; for the response, `read_network_requests` after the action shows the status the API returned. Do not assert the previous state by reading too early — a confidently wrong caption is worse than a late one. `read_console_messages` with a `pattern` is worth a look when something behaves oddly.

For a `db` check, run `--db` from the shell with the same query and params the file names and record the rows under the expect with `source: "db"`. Only reads: the runner refuses anything else.

## The scenario file, by hand

The Chrome driver runs the same `scenarios.json` the Playwright runner would, one batch per scenario, so the file's rules hold here too — they are just yours to apply:

- **`uses`** — `--prepare` before the first scenario that needs the setup; the ledger records what it made, `--finish` removes it at the end, `--cleanup` after a run that never reached `--finish`
- **`given`** is a `javascript_tool` call before the batch. When a check does not hold, the scenario is BLOCKED: no batch, no screenshot, a `reason` in the results, a line under Not run
- **`requires`** is your reading order. When a required scenario errored or was blocked, the ones that build on it are BLOCKED too
- **An error** — the element `find` cannot see, a click that times out — gets the same triage as under Playwright: is the element there at all, what does the console say, what does the code render. A missing element the criterion requires is a FAIL with the error as evidence; a wrong step is fixed in the file with a `revision`
- **An inventory** of a page comes from pasting `scripts/inspect.js` into `javascript_tool`

## Things not to do

**Do not trigger `alert`, `confirm` or `prompt`.** A native dialog blocks the extension entirely. If one appears anyway, tell the user immediately.

**Do not repeat a failing interaction more than two or three times.** Stop and ask.

**Do not treat a hard reload as free.** Everything injected into the page is gone afterwards, including the annotation overlay. Re-inject before the next captioned screenshot, and call `__annClear()` before the next scenario's clicks.

## Cleaning up

What the ledger knows, `--cleanup` removes. What was created outside it — by hand, in a shared environment — is listed in the report under Test data with where it is; deleting it by hand is usually the wrong move, since something you did not create may now depend on it.
