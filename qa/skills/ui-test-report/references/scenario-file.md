# The scenario file

`scenarios.json` is the approved scenario table written down as data. It is produced in every run, whichever driver clicks: with Playwright it is the runner's input, with the Chrome extension it is the script the model follows one batch at a time. Either way a run can be repeated (`--only 07`), handed to a colleague, or moved from one driver to the other without redesigning anything.

It is data rather than code because a wrong selector in a JSON file is a one-line fix and a re-run, while a wrong selector in a script the model wrote is a debugging session. The runner owns the control flow; the file owns what to click, what data has to exist first, and what must be true afterwards.

## Shape

```json
{
  "feature": "Saved views, TES-8147",
  "withDB": true,
  "ready": "#app-ready",
  "setups": {
    "version": "seed-2026-09",
    "twoViews": {
      "prepare": [
        { "http": { "method": "POST", "url": "/api/views", "json": { "name": "QA ${runId} alpha" }, "expectStatus": 201, "name": "alpha",
                    "record": { "kind": "view", "id": "json.id", "cleanup": { "http": { "method": "DELETE", "url": "/api/views/${id}" } } } } }
      ]
    }
  },
  "scenarios": [
    {
      "n": "01",
      "slug": "baseline",
      "title": "Baseline — the seeded view is listed, count says 1",
      "uses": ["twoViews"],
      "steps": [
        { "goto": "/views" },
        { "read": { "name": "ids", "js": "Array.from(document.querySelectorAll('tbody td.id')).map(td => Number(td.innerText))" } },
        { "expect": { "name": "ids", "contains": "${alpha.json.id}", "desc": "the seeded view is listed" } },
        { "expect": { "name": "ids", "path": "length", "equals": 1, "desc": "and nothing else" } }
      ],
      "caption": { "t": "Baseline", "d": "The list shows <b>${ids}</b>.", "target": "tbody" }
    },
    {
      "n": "02",
      "slug": "save-new-view",
      "title": "Save — 201 from the API, the row appears, the database row belongs to tenant 1",
      "requires": ["01"],
      "given": [{ "name": "ids", "path": "length", "equals": 1, "desc": "one view before saving" }],
      "steps": [
        { "fill": { "selector": "#name", "value": "QA ${runId} gamma" } },
        { "click": { "role": "button", "name": "Save" }, "awaitResponse": { "name": "save", "url": "/api/views", "method": "POST" } },
        { "expect": { "name": "save", "path": "status", "equals": 201, "desc": "the API accepted the view" } },
        { "expect": { "js": "document.querySelectorAll('tbody tr').length", "equals": 2, "within": 3000, "desc": "the list refreshes to two rows" } },
        { "read": { "name": "newId", "js": "Number(document.querySelector('tbody tr:last-child td.id').innerText)" } },
        { "db": { "name": "row", "query": "SELECT id, owner_id FROM views WHERE name = ?", "params": ["QA ${runId} gamma"], "one": true } },
        { "expect": { "name": "row", "path": "owner_id", "equals": 1, "desc": "owned by tenant 1" } },
        { "expect": { "name": "row", "path": "id", "equals": "${newId}", "desc": "the row on screen is the row in the database" } }
      ],
      "leaves": [{ "kind": "view", "id": "${newId}", "cleanup": { "http": { "method": "DELETE", "url": "/api/views/${id}" } } }],
      "caption": { "t": "Save — row added, DB agrees", "d": "POST → <b>${save.status}</b>; row <b>${newId}</b> is listed and owned by tenant <b>${row.owner_id}</b>.",
                   "target": { "selector": "tbody tr:last-child", "label": "new row" }, "hl": ["#count"] }
    }
  ]
}
```

A bare array of scenarios is accepted too, with no setups, no readiness condition and no database.

The second scenario is the shape most rows take: data prepared by a setup, a precondition about it, an action tied to the response it causes, a UI read that waits for the refresh, a database read of exactly the record the scenario made, and assertions whose expected values were known **before the run** — the tenant from the requirement, the id from the page. "Fewer rows than before" would pass a filter that drops the wrong rows; "UI equals DB" would pass when both hold the wrong value. Name what has to be there and what must not.

## Top-level fields

| Field | Meaning |
| --- | --- |
| `feature` | one line for the report |
| `withDB` | `true` when the run checks the database as well as the UI — the answer to the start-up question, kept here so a re-run does not ask again. Without it every `db` step and `sql` fixture is a validation error |
| `ready` | what "the app is ready" means after `goto` and `reload`: a selector that has to be visible, or `{ "js": "…" }` that has to hold. Checked after the `load` event; a timeout is an error of the step. There is no network-idle guess |
| `setups` | named blocks of test data, see [test-data.md](test-data.md); `version` is free text recorded in `results.json` under `run.fixturesVersion` |
| `scenarios` | the rows |

## Scenario fields

| Field | Meaning |
| --- | --- |
| `n` | zero-padded number, `"01"`… — the key joining the report row to the screenshot file; it never changes once the table is approved |
| `slug` | lowercase letters, digits, dashes; the file becomes `NN-slug.jpg` |
| `title` | the row text in the report table |
| `uses` | setups this scenario needs. Each runs once per run, before the first scenario that uses it — under `--only` too, so a single scenario re-runs on fresh data. A setup that fails blocks the scenarios that use it |
| `requires` | earlier scenarios whose *state* this one builds on: a drawer left open, a value `read` into `${…}`. Under `--only` they are pulled in and run first; one that did not finish in this run blocks this one |
| `given` | preconditions checked before the first step, each in the shape of an `expect`. One that does not hold makes the scenario `blocked`, with the check and the value it saw |
| `steps` | run in order; see below |
| `leaves` | records the scenario itself creates through the UI — `{ "kind", "id": "${newId}", "cleanup" }` — appended to the run's ledger when the steps complete, so cleanup and the report cover them |
| `caption` | what is drawn onto the screenshot: `t` title, `d` template (inline HTML allowed, `${name}` filled from the values with HTML escaping), `target` **required** — the element or region that proves the result, `hl` further selectors outlined in red, `pins` `[selector, text, dx, dy]` callouts, `top: true` to force the card up (by default it moves up on its own when it would cover the target) |
| `manual` | `true` marks a scenario the tooling cannot verify. The runner takes the screenshot with a CHECK badge and runs no verdict |
| `revision` | one sentence, added when the steps or assertions were rewritten after a run: what the earlier version checked and why it was wrong. Tied to the steps as they are now; rewrite them again and it needs rewriting too |

**`target`** names what the picture is evidence of: the saved row, the changed field, the counter, the validation message, the chip. For an absence — nothing was written, the list is empty — point at the container or the empty state, not at a random element. When nothing on screen proves the result, write `"target": { "none": "why" }` and the card says so; a screenshot never proves the contents of the database, that is what the `db` expect is for. A target that matches nothing is written onto the card ("⚠ no element matched: .chip") and recorded in the results as `captionDiag`, so a picture without its frame cannot pass for one with it.

## Steps

Every step carries **exactly one** operation. The only other keys allowed are `desc` and, on an action, `awaitResponse`.

| Step | Example | Notes |
| --- | --- | --- |
| `goto` | `{ "goto": "/properties" }` | relative to `--base-url`; waits for `load`, then for the file's `ready` |
| `reload` | `{ "reload": true }` | hard reload, same readiness rule; the overlay survives it |
| `click` / `dblclick` / `hover` | `{ "click": { "role": "button", "name": "Apply" } }` | see targets |
| `fill` | `{ "fill": { "selector": "#price", "value": "600000" } }` | replaces the field's value |
| `type` | same shape as `fill` | key by key, for inputs that react per keystroke |
| `select` | `{ "select": { "selector": "#type", "value": "villa" } }` | native `<select>` |
| `check` / `uncheck` | `{ "check": { "label": "Auto apply" } }` | checkbox or radio |
| `press` | `{ "press": "Enter" }` or `{ "press": "Escape", "selector": "#q" }` | keyboard |
| `wait` | `{ "wait": 350 }`, `{ "wait": ".drawer.open" }`, `{ "wait": { "url": "type=villa" } }`, `{ "wait": { "js": "!document.querySelector('.spinner')" } }` | milliseconds, a selector to become visible, a URL regex, or a JS condition. `{ "wait": { "loadState": "networkidle" } }` exists for the page with no other readiness signal, and has to be written in that long form on purpose |
| `read` | `{ "read": { "name": "after", "js": "…", "as": "number" } }` | evaluates the expression and stores it under `name`; `as` converts (see values) |
| `db` | `{ "db": { "name": "row", "query": "SELECT … WHERE name = ?", "params": ["QA ${runId} x"], "one": true } }` | a read-only query, rows stored under `name` (`one` stores the first row or `null`). Needs `withDB` |
| `expect` | `{ "expect": { "name": "ids", "equals": ["P-101", "P-103"] } }` | an assertion; decides the verdict |

**Targets** for click, fill and friends are either a Playwright selector string (`"#apply"`, `"text=Apply"`, `".toolbar >> nth=1"`) or one object out of `{ "role", "name" }`, `{ "text" }`, `{ "label" }`, `{ "placeholder" }`, `{ "testId" }`, `{ "selector", "nth" }`. Roles and labels are what a user sees, so they survive a CSS refactor; reach for `selector` when nothing else names the element. `--inspect` lists the roles, names and ids the page actually has.

**`awaitResponse`** on an action ties it to the HTTP response it causes: `{ "name", "url" (substring, or `/regex/`), "method"?, "status"?, "timeout"? }`. The listener is registered *before* the click, so a fast response cannot be missed, and the step errors when nothing matching arrives in time. What is stored under `name` — `{ status, ok, url, method, json | text }` — is a value like any other: `${save.status}` in a caption, `"name": "save", "path": "json.id"` in an expect.

A URL written by the app through `URLSearchParams` has its brackets encoded (`type%5B%5D=villa`), while one typed into a `goto` keeps them literal. A `wait.url` or `matches` on such a parameter should accept both: `"type(%5B%5D|\\[\\])=villa"`.

## Checks

`expect` and `given` take **exactly one source** — `js` (an expression run in the page), `name` (a value stored earlier), or `db` (a query, as in the `db` step) — and **exactly one comparator**: `equals`, `notEquals`, `matches` (regex), `contains`, `gt`, `gte`, `lt`, `lte`, `truthy`, `falsy`. Optional: `path` (dot path into the value: `"json.id"`, `"0.n"`, `"length"`), `as` (convert the actual value), `expectedAs` (convert the expected one), `desc` (the sentence in the results; the runner makes one otherwise), and `within`.

The comparisons are strict:

- `equals` compares arrays and objects by content, element by element. Primitives compare by value, with one concession: a number equals the string that spells it, because the DOM hands back `"11"` where the file says `11`. `null` is not `"null"`, `true` is not `"true"`, `0` is not `""`
- `contains` is a substring on a string, an element (by `equals`) on an array, a key on an object. `["P-101"]` does not contain `"P-10"`
- `matches` reads a string (or a number); on an array or `null` it fails with a reason saying so
- `gt`/`gte`/`lt`/`lte` need a number on both sides — a `"twelve"` fails with a reason rather than comparing `NaN`

Where the DOM gives text that means a number or a boolean, say so where it is read: `"as": "number"` turns `"1 234,50 zł"` into `1234.5`, `"as": "boolean"` turns `"yes"` into `true`, `"as": "trim"` collapses whitespace, `"as": "json"` parses. That is the deliberate normalisation; nothing else is coerced. A failed check records `reason` and `actualType` next to `actual` and `expected`, so the results file says *why* — "expected array, got string" is a different bug from "expected 6, got 5".

**`within`** re-reads and re-compares until the condition holds or the milliseconds are up (`every` sets the interval, default 200 ms). It goes on a `js` or `db` check that waits for a refresh or an asynchronous write; it is refused on a `name` check, since a stored value does not change by being looked at again. The action that caused the change is never repeated. The result carries `waitedMs`, `attempts`, the last `actual` and `timedOut`, so a slow save and a save that never happened are told apart. Without `within` a check runs once, as before.

The right-hand side may be a `${name}` or `${name.path}` reference to a stored value: `"equals": "${total}"`, `"contains": "${alpha.json.id}"`.

## Values and captions

`read`, `db`, `awaitResponse` and the `name` on a setup step store values in one map shared across the run, so a scenario can compare against what an earlier one saw and a caption can quote it. `${runId}` is always there. A scenario that uses a value read by an earlier scenario declares that scenario in `requires`, or a `--only` re-run stops before the browser with the name and the scenario that reads it. Values stored by a setup are available to every scenario that `uses` it.

In `d`, `${name}` and `${name.path}` are substituted on the picture with HTML escaping, so a record name containing `<` is shown as a name containing `<` — the template's own `<b>` and `<code>` stay. Put the value that decides pass or fail inside `<b>`: that is what makes the caption readable at thumbnail size and lets a reviewer check the claim against the picture.

## Verdict

- every `expect` passed → PASS
- any `expect` failed → FAIL; the failing assertion, its source (`ui`, `db`, `http`), the actual value and the reason are in the results
- `manual: true` → CHECK, no assertions run
- a setup in `uses` failed, a `given` did not hold, or a scenario in `requires` did not finish this run → `blocked`: no steps, no screenshot, the reason recorded. A QA result — BLOCKED under Not run — not a tooling failure
- a step threw — selector matched nothing, a wait or an `awaitResponse` timed out, the database could not be read → `error`. Not a result yet: the screenshot goes to `NN-slug.error.jpg`, which `check-evidence.js` rejects, until somebody has established why. A database that cannot be reached is an error of that scenario, never a quiet fall back to UI only

The file is validated before the first click, all problems at once: two operations in one step, two comparators or two sources in a check, `within` on a stored value, a `${ref}` nothing stores, a `requires` pointing forward, a `uses` naming no setup, a `db` step without `withDB`, a caption without `target`, a scenario with neither `expect` nor `manual`. Under `--only`, a value read by a scenario outside the selection is reported by name with the scenario to add to `requires`.

## Identity of a scenario

The runner hashes what a scenario checks — `given`, `steps`, `manual`, `requires`, `uses` and the content of the setups it uses — and keeps that hash with every result. A changed comparator, a changed fixture or a new dependency is a rewrite; the runner compares against the previous `results.json` and names every rewritten scenario at the end of the run, and says when its `revision` was written for an earlier version of the steps. A rewritten scenario is expected to carry `revision` — the file keeps no history, so the sentence and the report's "Changes" section are the only record of what the earlier check got wrong. The title is not part of the hash.

## Ordering

Sequence scenarios so each leaves the app where the next one starts, and prefer short chains with a shared setup over one long chain: a broken link then blocks two rows rather than thirty, and a single scenario can be re-run on a setup and one predecessor. Every scenario runs in the same page in one session, so 02 opens the drawer that 03 uses; say so with `"requires": ["02"]`. A dependency has to be earlier in the file. Put a `goto` at the start of a scenario only when it genuinely needs a clean state.
