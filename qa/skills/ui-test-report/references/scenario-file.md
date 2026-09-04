# The scenario file

`scenarios.json` is the approved scenario table written down as data. It is produced in every run, whichever driver clicks: with Playwright it is the runner's input, with the Chrome extension it is the script the model follows one batch at a time. Either way it means a run can be repeated (`--only 07`), handed to a colleague, or moved from one driver to the other without redesigning anything.

It is data rather than code because a wrong selector in a JSON file is a one-line fix and a re-run, while a wrong selector in a script the model wrote is a debugging session. The runner owns the control flow; the file owns what to click and what must be true afterwards.

## Shape

```json
{
  "feature": "Property type filter, TES-8147",
  "scenarios": [
    {
      "n": "03",
      "slug": "apply-villa-chip-url",
      "title": "Apply — chip at the top, list filtered, URL updated",
      "steps": [
        { "select": { "selector": "#type", "value": "villa" } },
        { "click": { "role": "button", "name": "Apply" } },
        { "wait": { "url": "type%5B%5D=villa" } },
        { "read": { "name": "after", "js": "document.querySelectorAll('tbody tr').length" } },
        { "read": { "name": "chip", "js": "document.querySelector('.chip')?.innerText.trim()" } },
        { "expect": { "name": "after", "lt": "${total}", "desc": "fewer rows than the baseline" } },
        { "expect": { "js": "location.search", "matches": "type%5B%5D=villa", "desc": "URL carries the filter" } }
      ],
      "caption": {
        "t": "Apply — chip at the top, list filtered, URL updated",
        "d": "The condition surfaces as a chip: <b>${chip}</b>. The list drops from ${total} to <b>${after}</b> records and the URL carries <code>?type[]=villa</code>.",
        "hl": [".chip"],
        "pins": [[".chip", "Applied filter, removable", 0, -38]]
      }
    }
  ]
}
```

A bare array of scenarios is accepted too.

## Scenario fields

| Field | Meaning |
| --- | --- |
| `n` | zero-padded number, `"01"`… — it is the key joining the report row to the screenshot file, so it never changes once the table is approved |
| `slug` | lowercase letters, digits, dashes; the file becomes `NN-slug.jpg` |
| `title` | the row text in the report table |
| `steps` | run in order; see below |
| `caption` | what is drawn onto the screenshot: `t` title, `d` one or two sentences (inline HTML allowed), `hl` selectors outlined in red, `pins` `[selector, text, dx, dy]` callouts, `top: true` to move the card up |
| `manual` | `true` marks a scenario the tooling cannot verify. The runner takes the screenshot with a CHECK badge and runs no verdict |

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
| `expect` | `{ "expect": { "js": "location.search", "matches": "villa" } }` | an assertion; decides the verdict |

**Targets** for click, fill and friends are either a Playwright selector string (`"#apply"`, `"text=Apply"`, `".toolbar >> nth=1"`) or one object out of `{ "role", "name" }`, `{ "text" }`, `{ "label" }`, `{ "placeholder" }`, `{ "testId" }`, `{ "selector", "nth" }`. Roles and labels are what a user sees, so they survive a CSS refactor; reach for `selector` when nothing else names the element.

A URL written by the app through `URLSearchParams` has its brackets encoded (`type%5B%5D=villa`), while one you typed into a `goto` keeps them literal (`type[]=villa`). A `wait.url` or `expect … matches` on such a parameter should accept both: `"type(%5B%5D|\\[\\])=villa"`.

**Expect** takes what to evaluate — `js` (an expression run in the page) or `name` (a value stored by `read`) — and exactly one comparator: `equals`, `notEquals`, `matches` (regex), `contains`, `gt`, `gte`, `lt`, `lte`, `truthy`, `falsy`. The right-hand side may be a `${name}` reference to a stored value. Add `desc` so the results file reads as a sentence; without it the runner makes one from the expression.

## Values and captions

`read` stores values in one map shared across the whole run, so a scenario can compare against what an earlier one saw (`"lt": "${total}"`) and the caption of scenario 04 can quote a number read in 03. Read the value before writing the caption that uses it; a `${name}` nothing has stored is left as-is in the caption, which is visible on the screenshot and is meant to be.

Put the number that decides pass or fail inside `<b>` in `d`. That is what makes the caption readable at thumbnail size and lets a reviewer check the claim against the picture.

## Verdict

- every `expect` in the scenario passed → PASS
- any `expect` failed → FAIL, and the failing assertion with its actual value is in `results.json`
- `manual: true` → CHECK, no assertions run
- a step threw — selector matched nothing, a wait timed out — → `error`. This is not a result. The screenshot goes to `NN-slug.error.jpg`, which `check-evidence.js` rejects, so the run cannot be handed over until the step is fixed and re-run with `--only NN`

A scenario with no `expect` and no `manual` still passes, and the runner prints a warning next to it. A PASS nobody asserted is the row a reviewer cannot trust; give it one `expect` or mark it manual.

## Ordering

Sequence scenarios so each leaves the app where the next one starts — the same rule as in [scenario-design.md](scenario-design.md). Every scenario runs in the same page in one session, so 02 opens the drawer that 03 uses. Put a `goto` at the start of a scenario only when it genuinely needs a clean state.
