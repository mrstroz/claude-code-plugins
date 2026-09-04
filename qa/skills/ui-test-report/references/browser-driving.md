# Driving Chrome without wasting turns

The Chrome MCP drives a real browser with the user's real session. That is the point — it tests the app as the user has it, with their login, their data and their extensions — and it is also why a run is worth doing carefully rather than fast. This is the driver to choose when that session cannot be reproduced in the Playwright QA profile; for everything else, [playwright-driver.md](playwright-driver.md) runs the same scenario file in one command.

## Batching

Every tool call is a full round trip through the model. Across forty scenarios, the difference between six calls per scenario and two is most of the afternoon. `browser_batch` runs a list of tool calls in one round trip, sequentially, and returns their outputs and screenshots together.

The shape that works: `find` on its own first, because its refs are the output the batch needs. Then one batch per scenario — click by ref, wait, `javascript_tool` for the assertion, `javascript_tool` for `__ann()`, `computer` screenshot:

```json
[
  { "name": "computer", "input": { "action": "left_click", "ref": "…", "tabId": 123 } },
  { "name": "find", "input": { "query": "Apply button inside the open drawer", "tabId": 123 } },
  { "name": "javascript_tool", "input": { "text": "document.querySelectorAll('tbody tr').length", "tabId": 123 } },
  { "name": "javascript_tool", "input": { "text": "__ann({ n: '03', t: '…', d: '…', ok: true })", "tabId": 123 } },
  { "name": "computer", "input": { "action": "screenshot", "save_to_disk": true, "tabId": 123 } }
]
```

Two constraints shape what goes in a batch:

- **Coordinates written in a batch refer to the screenshot taken before it.** Anything that moves the layout — opening a drawer, filtering a list — makes every coordinate after it stale. Refs do not have this problem, which is one more reason to click by ref and keep coordinates out of batches entirely.
- **A batch stops at the first error.** So after an action that opens a panel, the next item in the batch is a `find` for something inside that panel, not a click: it confirms the panel is there, it waits out the animation, and if the panel did not open the batch stops with a clear message instead of clicking the backdrop.

The caption goes into the batch before its assertion has come back, so do not type the number into `d` — read it from the page inside the same `__ann()` call:

```js
const n = document.querySelectorAll("tbody tr").length;
__ann({ n: "03", t: "Apply — list filtered", d: `The list drops from 11 to <b>${n}</b> records.`, ok: n === 6 });
```

The verdict and the value on the picture then come from the DOM at capture time, exactly as the Playwright runner does it, and the separate assertion item in the batch returns the same value for the report.

## Setup

Load the tools in one `ToolSearch` call. Each separate call is a full round trip for a schema you already knew you needed.

Call `tabs_context_mcp` before anything else, then create a tab for the run rather than reusing one the user is working in. Close it at the end unless the user asked to keep it open.

Widen the window if the layout depends on it (`resize_window`). Note that the screenshot the tool returns may still be smaller than the CSS viewport — see coordinates below.

## Targeting elements

`find` with a natural-language description returns refs; `computer` accepts `ref` in place of `coordinate` for clicks. Prefer that everywhere. It survives layout shifts, it does not care about pixel scales, and it fails loudly when the element is gone instead of clicking whatever moved into that spot.

Fall back to coordinates only when `find` cannot describe the target — icon buttons inside a dense toolbar, a specific cell in a grid. Then convert properly:

```js
__at(".filter-toolbar button:nth-of-type(2)", 1568); // 1568 = width the last screenshot reported
```

Reading `getBoundingClientRect()` and clicking those numbers directly is the single most common way to click the wrong thing: it returns CSS pixels, the tool wants screenshot pixels, and on a typical setup those differ by about 20%.

## Assertions

`javascript_tool` is what turns a screenshot into a verified result. The ones that carry most runs:

```js
document.querySelectorAll("tbody tr").length;                       // result count
location.search;                                                     // filter / route state
document.querySelector(".chip")?.innerText.replace(/\n/g, " ");      // rendered label
!!document.querySelector(".p-toggleswitch-checked");                 // toggle state
Array.from(document.querySelectorAll("[role=option]")).map(e => e.innerText.trim()); // dropdown contents
document.body.innerText.match(/Results - \d+/)?.[0];                 // a count the app renders itself
```

Read the value **before** writing the caption, and put the number in the caption. A caption saying "the list is filtered" is worth much less than one saying "6 of 11", and it is the difference between a report a reviewer can spot-check and one they have to take on trust.

`read_console_messages` with a `pattern` is worth a look when something behaves oddly — a failed request often explains an empty list faster than more clicking.

## Timing

The tools return as soon as the command is dispatched, not when the UI has settled. Two habits cover almost everything:

- after opening a drawer, dialog or menu, `find` an element inside it before clicking anything — it confirms the panel is there, gives the animation time to finish, and costs nothing extra inside a batch
- after an action that refetches, wait for the data before asserting; an assertion run too early reports the previous state and produces a confidently wrong caption

A click that "does nothing" is usually a click that landed during an animation, on the backdrop, and closed what it was aiming at. Confirm the panel, then act.

## Things not to do

**Do not trigger `alert`, `confirm` or `prompt`.** A native dialog blocks the extension entirely and nothing recovers until a human dismisses it. If one appears anyway, tell the user immediately — it will not clear itself.

**Do not repeat a failing interaction more than two or three times.** If an element will not respond, stop and ask. Looping on the same click burns the run and buries the reason in noise.

**Do not treat a hard reload as free.** Everything injected into the page is gone afterwards, including the annotation overlay. Re-inject before the next captioned screenshot.

## Cleaning up

Some scenarios need state that does not exist yet — a saved view, a second record, a user with a different role. Create it, note it, and list it at the end of the report under what was left behind. Deleting it is usually the wrong move: the environment is shared, and something you did not create may now depend on it.
