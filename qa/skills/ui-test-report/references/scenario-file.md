# The scenario file

`scenarios.json` is the approved scenario table written down as data. It is produced in every run, whichever driver clicks: with Playwright it is the runner's input, with the Chrome extension it is the script the model follows one batch at a time. Either way it means a run can be repeated (`--only 07`), handed to a colleague, or moved from one driver to the other without redesigning anything.

It is data rather than code because a wrong selector in a JSON file is a one-line fix and a re-run, while a wrong selector in a script the model wrote is a debugging session. The runner owns the control flow; the file owns what to click and what must be true afterwards.

## Shape

```json
{
  "feature": "Property type filter, TES-8147",
  "scenarios": [
    {
      "n": "01",
      "slug": "baseline",
      "title": "Baseline — all 11 properties listed, no filter",
      "steps": [
        { "goto": "/properties" },
        { "read": { "name": "total", "js": "document.querySelectorAll('tbody tr').length" } },
        { "expect": { "name": "total", "equals": 11, "desc": "the 11 properties in the seed data are listed" } },
        { "expect": { "js": "location.search", "equals": "", "desc": "no filter in the URL" } }
      ],
      "caption": { "t": "Baseline", "d": "All <b>${total}</b> properties, no filter." }
    },
    {
      "n": "03",
      "slug": "apply-villa-chip-url",
      "title": "Apply — exactly the six villas remain, chip shown, URL updated",
      "requires": ["01"],
      "given": [
        { "name": "total", "equals": 11, "desc": "the unfiltered list had 11 rows" },
        { "js": "location.search", "equals": "", "desc": "no filter applied yet" }
      ],
      "steps": [
        { "select": { "selector": "#type", "value": "villa" } },
        { "click": { "role": "button", "name": "Apply" } },
        { "wait": { "url": "type(%5B%5D|\\[\\])=villa" } },
        { "wait": { "js": "document.querySelectorAll('tbody tr').length < 11" } },
        { "read": { "name": "ids", "js": "Array.from(document.querySelectorAll('tbody td.id')).map(td => td.innerText.trim())" } },
        { "read": { "name": "chip", "js": "document.querySelector('.chip')?.innerText.trim()" } },
        { "expect": { "name": "ids", "equals": ["P-101", "P-103", "P-104", "P-107", "P-109", "P-111"], "desc": "the six villas in the seed data — no other row, none missing" } },
        { "expect": { "name": "chip", "equals": "Property type: Villa", "desc": "chip names the applied filter" } }
      ],
      "caption": {
        "t": "Apply — six villas, chip, URL",
        "d": "The condition surfaces as a chip: <b>${chip}</b>. Of ${total} properties the <b>six villas</b> remain and the URL carries <code>?type[]=villa</code>.",
        "hl": [".chip"],
        "pins": [[".chip", "Applied filter, removable", 0, -38]]
      }
    }
  ]
}
```

A bare array of scenarios is accepted too.

The second scenario is the shape most rows take. Its expected value is a list of ids known **before the run** — read from the seed data, the database, or the unfiltered page during reconnaissance — and the assertion says the list is exactly that. "Fewer rows than before" would pass a filter that drops the wrong rows; "every visible row says Villa" would pass an empty list. Content and completeness together are what a filter has to prove, and the same holds for a sort, a search, or a permission check: name what has to be there and what must not.

## Scenario fields

| Field | Meaning |
| --- | --- |
| `n` | zero-padded number, `"01"`… — it is the key joining the report row to the screenshot file, so it never changes once the table is approved |
| `slug` | lowercase letters, digits, dashes; the file becomes `NN-slug.jpg` |
| `title` | the row text in the report table |
| `requires` | numbers of earlier scenarios whose state this one builds on: a filter applied, a record created, a value `read` into `${…}`. Under `--only` they are pulled in and run first; a dependency that did not finish in this run — error, blocked — blocks this one instead of letting it run on the wrong state |
| `given` | preconditions checked before the first step, each in the shape of an `expect`. One that does not hold makes the scenario `blocked`, with the check and the value it saw |
| `steps` | run in order; see below |
| `caption` | what is drawn onto the screenshot: `t` title, `d` one or two sentences (inline HTML allowed), `hl` selectors outlined in red, `pins` `[selector, text, dx, dy]` callouts, `top: true` to move the card up |
| `manual` | `true` marks a scenario the tooling cannot verify. The runner takes the screenshot with a CHECK badge and runs no verdict |
| `revision` | one sentence, added when the steps or assertions were rewritten after a run: what the earlier version checked and why it was wrong. It is tied to the steps as they are now — rewrite them again and it needs rewriting too. The runner keeps the earlier entry in `results.json`; this line is what lets the report tell a corrected check from a fixed bug |

## Steps

| Step | Example | Notes |
| --- | --- | --- |
| `goto` | `{ "goto": "/properties" }` | relative to `--base-url`; waits for network idle |
| `reload` | `{ "reload": true }` | hard reload; the overlay survives it |
| `click` / `dblclick` / `hover` | `{ "click": { "role": "button", "name": "Apply" } }` | see targets |
| `fill` | `{ "fill": { "selector": "#price", "value": "600000" } }` | replaces the field's value |
| `type` | same shape as `fill` | key by key, for inputs that react per keystroke |
| `select` | `{ "select": { "selector": "#type", "value": "villa" } }` | native `<select>` |
| `check` / `uncheck` | `{ "check": { "label": "Auto apply" } }` | checkbox or radio |
| `press` | `{ "press": "Enter" }` or `{ "press": "Escape", "selector": "#q" }` | keyboard |
| `wait` | `{ "wait": 350 }`, `{ "wait": "networkidle" }`, `{ "wait": ".drawer.open" }`, `{ "wait": { "url": "type=villa" } }`, `{ "wait": { "js": "!document.querySelector('.spinner')" } }` | milliseconds, load state, a selector to become visible, a URL regex, or a JS condition |
| `read` | `{ "read": { "name": "after", "js": "…" } }` | evaluates the expression and stores it under `name` |
| `expect` | `{ "expect": { "name": "ids", "equals": ["P-101", "P-103"] } }` | an assertion; decides the verdict |

**Targets** for click, fill and friends are either a Playwright selector string (`"#apply"`, `"text=Apply"`, `".toolbar >> nth=1"`) or one object out of `{ "role", "name" }`, `{ "text" }`, `{ "label" }`, `{ "placeholder" }`, `{ "testId" }`, `{ "selector", "nth" }`. Roles and labels are what a user sees, so they survive a CSS refactor; reach for `selector` when nothing else names the element. `--inspect` lists the roles, names and ids the page actually has — write targets from that list rather than from memory.

A URL written by the app through `URLSearchParams` has its brackets encoded (`type%5B%5D=villa`), while one you typed into a `goto` keeps them literal (`type[]=villa`). A `wait.url` or `expect … matches` on such a parameter should accept both: `"type(%5B%5D|\\[\\])=villa"`.

**Expect** and **given** take what to evaluate — `js` (an expression run in the page) or `name` (a value stored by `read`) — and exactly one comparator: `equals`, `notEquals`, `matches` (regex), `contains`, `gt`, `gte`, `lt`, `lte`, `truthy`, `falsy`. `equals` compares arrays and objects by content, element by element, so a list of ids read from the page can be held against the list in the file; a number and its string form are equal, since the DOM hands back `"11"` where the file says `11`. The right-hand side may be a `${name}` reference to a stored value. Add `desc` so the results file reads as a sentence; without it the runner makes one from the expression.

## Values and captions

`read` stores values in one map shared across the whole run, so a scenario can compare against what an earlier one saw (`"equals": "${total}"`) and the caption of scenario 04 can quote a number read in 03. A scenario that uses a value read by an earlier one declares that scenario in `requires`, or a `--only` re-run has nothing to compare against. Read the value before writing the caption that uses it; a `${name}` nothing has stored is left as-is in the caption, which is visible on the screenshot and is meant to be.

Put the value that decides pass or fail inside `<b>` in `d`. That is what makes the caption readable at thumbnail size and lets a reviewer check the claim against the picture.

## Preconditions and expected values

Say in `given` what has to be true before the scenario makes sense: the row count the baseline read, a URL with no filter in it, the record created two scenarios ago still there. A check costs nothing to run; a scenario that runs on the wrong state produces a FAIL about nothing, or a PASS about nothing, and either one costs a person the time to find out which.

Expected values come from the data and are decided before the run: the ids of the six villas in the seed, the count a `SELECT` returns, the option values `--inspect` listed, the sort order the database's own `ORDER BY` gives. Reading the filtered table and asserting what it shows is not a check — it is the table agreeing with itself.

## Verdict

- every `expect` in the scenario passed → PASS
- any `expect` failed → FAIL, and the failing assertion with its actual value is in `results.json`
- `manual: true` → CHECK, no assertions run
- a `given` did not hold, or a scenario in `requires` did not finish this run → `blocked`: no steps run, no screenshot, the reason and the number recorded. This is a QA result — the report shows it as BLOCKED under Not run — and not a failure of the tooling
- a step threw — selector matched nothing, a wait timed out — → `error`. This is not a result yet. The screenshot goes to `NN-slug.error.jpg`, which `check-evidence.js` rejects, so the run cannot be handed over until somebody has established why. A wrong step is fixed with a `revision` and re-run; a missing element the criterion requires becomes a FAIL through `--verdict`. The sequence is in [playwright-driver.md](playwright-driver.md)

The file is validated before the first click: a scenario with no `expect` and no `manual`, an unknown step, a `${ref}` nothing reads, a `requires` pointing forward — each stops the run with every problem listed. A PASS nobody asserted is the row a reviewer cannot trust, so the runner does not produce one.

## Ordering

Sequence scenarios so each leaves the app where the next one starts — the same rule as in [scenario-design.md](scenario-design.md). Every scenario runs in the same page in one session, so 02 opens the drawer that 03 uses; say so with `"requires": ["02"]`, which is what makes `--only 03` re-run on the right state. A dependency has to be earlier in the file. Put a `goto` at the start of a scenario only when it genuinely needs a clean state.
