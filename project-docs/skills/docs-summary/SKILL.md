---
name: docs-summary
description: Read docs/plan/ back as one short table — every task as a row with its id, priority marker and a plain-language line saying what has to happen, ordered by priority rather than by file. Answers "what is left" without anybody opening the milestone files and counting checkboxes by eye. Asks for the scope first — all open tasks, the ten that matter most, the current milestone, or the full picture with finished and rejected work included. Use when the user says "co jest do roboty", "pokaż zadania", "wypisz zadania", "lista zadań", "podsumowanie zadań", "co zostało do zrobienia", "ile jeszcze zostało", "status planu", "na czym stoimy", "jak idzie projekt", "co jest najważniejsze", "pokaż 10 najważniejszych", "co jest zablokowane", "które zadania odrzuciliśmy", "what's left", "show me the tasks", "list the tasks", "task summary", "plan status", "where are we", "what's most important", "top 10 tasks", "what's blocked", "which tasks did we drop" — and any time somebody wants an overview of a project that has docs/plan/. This skill only reads; it prints the table into the conversation and writes no file. Do NOT use it to actually run a task or to update the documentation after work landed — "co teraz", "weź następne zadanie" and "next task" mean do the work, and that is project-docs:docs-task. Do NOT use it to create the documentation tree — that is project-docs:docs-init.
argument-hint: "[scope, e.g. 'wszystkie otwarte', 'top 10', 'bieżący etap']"
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# Reading the plan back

`docs/plan/` is written to be edited one task at a time, which makes it a poor thing to *read*. Answering "what is left" means opening the roadmap, then every milestone file, and counting checkboxes. This skill does that once and prints the answer as a table short enough to take in at a glance.

It reads and reports. It writes no file: a generated snapshot committed next to the plan goes stale the moment the next checkbox is ticked, and then there are two versions of the truth.

## 1. Find the tree

`Glob docs/plan/*.md`. Nothing there means this project does not use this documentation system — say so, point at `project-docs:docs-init`, and stop. Do not go hunting for a TODO file to summarise instead.

## 2. The language

The documentation language is recorded in `docs/README.md` under Conventions. Read it. If the line is missing, take the language of the plan's own headings. Every heading, column name and status word in the output comes from the vocabulary table, so a Polish plan gets a Polish table:

`${CLAUDE_PLUGIN_ROOT}/skills/docs-init/references/headings.md` → read the **Plan**, **Roadmap** and **Summary table** sections. If that variable is not set, glob `**/docs-init/references/headings.md` and take the highest version number in the path — the plugin cache keeps old copies alongside the current one, and an old one predates half the vocabulary.

The markers themselves — `(^)`, `(=)`, `(v)`, `[-]`, the `P` column header, the task id prefix — never translate. The milestone label does: this project's own is in `docs/README.md` under Conventions, `M1` in one tree and `E1` in another.

## 3. The scope

If the request already names it ("pokaż 10 najważniejszych", "co zostało w M2"), take it and skip the question. Otherwise one `AskUserQuestion`, four options:

| Option | What it shows |
|---|---|
| **All open tasks** (recommended) | Everything unticked, across every milestone |
| **Top 10 by priority** | The ten that matter most, ready work before blocked |
| **Current milestone only** | Just the milestone named in "State today" |
| **Full picture** | Open, done and rejected, with the state in its own column |

## 4. Read the plan

**`roadmap.md`** — "State today" gives the current milestone; the milestones table gives the files and the progress counters. Treat the counters as a claim, not as data: derive the real counts from the task lines and say so if they disagree, because a wrong counter in the one place everyone starts is worth naming.

**Each `NN-*.md`** — task lines have the shape:

```
- [<state>] (<priority>) **<PREFIX>-NN** <title>
      Spec: … · Depends on: <PREFIX>-NN · Blocker: <XX-N>
      Done when: …
```

`<state>` is ` ` open, `x` done, `-` rejected. `<priority>` is `^` high, `=` normal, `v` low, and **a missing token reads as `=`** — older plans predate the marker and are not wrong.

A task is **blocked** when a "Depends on" entry is still unticked, or when its "Blocker" has not cleared. Blockers resolve in one place per project and `docs/plan/README.md` says which: the status column of the cross-repo dependencies table, or the open-questions table in `spec/00` for a project waiting on a person rather than another repository. Both statuses are vocabulary words — a Polish tree's cleared value is `gotowe`, not `done`. A single-repo project has no dependencies document and its blockers still resolve, so read `plan/README.md` before looking for a file.

Blocked is worth surfacing but not worth a column: put it in the title cell as a suffix, `(blocked: BI-2)`.

## 5. Order it

`^` first, then `=`, then `v`. Within a priority: milestone order, then ready work before blocked work, then id. Milestone order stays the outer key — a `(v)` in the current milestone is still nearer than a `(v)` two milestones out, and a table that reorders across milestones stops matching the plan it came from.

Rejected tasks appear only in the full picture. They are history, and history in a list of open work reads as work.

## 6. Print it

```markdown
| Nr     | P | What needs doing                       | Milestone |
|--------|---|----------------------------------------|-----------|
| APP-15 | ^ | Retrying failed deliveries             | M2 |
| APP-12 | ^ | The /webhooks endpoint accepts events  | M2 |
| APP-13 | = | Event inspection panel (blocked: BI-2) | M2 |
| APP-21 | v | Delivery latency metrics in Grafana    | M3 |

17 open, 9 done, 2 rejected. Current milestone M2 — 4 of 6.
```

- **One row per task, one line per row.** The title cell is rewritten short — around sixty characters — not truncated mid-word. The plan's own title says what comes into existence; here it only has to be recognisable.
- **The footer is three facts**: the counts, the current milestone, its progress. Rejected tasks are counted separately and left out of the milestone denominator, so `4 of 6` stays reachable. `M2` above is only this example's label — use the plan's own, whatever it is.
- **The full picture adds a state column** before the title: `●` open, `x` done, `-` rejected.
- **No prose around the table.** If something needs saying — a counter that disagrees, a milestone with no ready work left — it is one line under the footer.

**Cap the table at 25 rows.** Past that, cut from the bottom priority up and say what was cut: `12 more (v) tasks not shown.` A table that silently stops reads as a complete list, and then somebody plans around work they never saw.

**When no task in the plan carries a priority token**, drop the `P` column entirely and keep plan order. Say once, under the footer, that priorities are unassigned and `project-docs:docs-task` sets them as it goes. A column of identical `=` is worse than no column.

## 7. Hand back

Offer the obvious next step: run the top task with `project-docs:docs-task`. One sentence, not a menu.
