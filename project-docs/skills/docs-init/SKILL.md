---
name: docs-init
description: Set up the spec/ADR/plan documentation system in a project — creates docs/spec/ (what the system does, in numbered sections), docs/adr/ (why each decision was made, one file per decision, with a template and a register), docs/plan/ (milestones and PREFIX-NN tasks that link to spec sections instead of restating them), and docs/README.md as the map. Works greenfield from a brief or PRD, and on an existing codebase by reading the code first and writing down what is already true plus the decisions already visible in it. Use when the user says "załóż dokumentację", "ustaw dokumentację w tym projekcie", "zrób docs jak w innych projektach", "chcę mieć spec, ADR i plan", "udokumentuj ten projekt", "potrzebuję planu z etapami", "opisz ten projekt zanim zaczniemy kodzić", "set up the docs", "bootstrap the documentation", "add a spec/ADR/plan structure here", "document this codebase properly", "I want a roadmap with milestones and tasks", or starts a new project and wants it documented this way from the beginning. Also use when a project has scattered documentation and the user wants it migrated into this structure. Do NOT use when docs/spec, docs/adr and docs/plan already exist — to run a task or bring them up to date, use project-docs:docs-task.
argument-hint: "[path to a brief or PRD, or nothing to read the codebase]"
---

# Setting up docs/

Three folders, three questions, no overlap:

- **`spec/`** — what the system does, and how it connects to everything else.
- **`adr/`** — why each solution was chosen, and what was rejected.
- **`plan/`** — when, and what now.

The separation is what makes this survive. A plan task never describes behaviour; it links to the spec section that does. So a spec correction needs no plan edit, and moving a task around never touches the spec. Links run one way — `plan/` into `spec/` and `adr/`, never back.

Invoke `project-docs:docs-style` before writing the first paragraph. Fixing a finished draft costs more than drafting it right, and the length budgets there are what keep this readable.

## 1. Four parameters

Ask all four in one `AskUserQuestion` batch. Come with proposals, not blanks.

| Parameter | How to propose a default |
|---|---|
| **Documentation language** | The language the user is writing in right now. Do not infer it from the code — Polish teams write English identifiers. If sibling repositories already have `docs/`, match them |
| **Task id prefix** | Two to four letters from the project name (`transhans-mobile` → `APP`, `tesoro-huella` → `HUE`, a webhook worker → `WH`). Never guess silently: every task, commit and cross-reference carries it forever |
| **Source material** | A brief or PRD path, the existing codebase, or both. If the repository has source files, say so and propose reading them |
| **Cross-repo dependencies** | Only if this project depends on work in other repositories. If it does not, skip the dependencies document entirely — creating an empty one teaches the wrong lesson |

Record the language choice in `docs/README.md` under Conventions. Every other skill reads it from there. `CLAUDE.md` stays English regardless, because it is read from sibling repositories.

Heading and status vocabulary for the chosen language: [references/headings.md](references/headings.md). Follow it literally — one term per concept across the whole tree, or `spec/`, `plan/` and `adr/` stop looking like one document.

## 2. Gather the material

**From a brief.** Read it, then fill the gaps by asking. A spec needs: the purpose, the one guiding principle everything else follows from, what is in scope, what is deliberately out of scope and why, who the users are, the environments, the vocabulary, and the questions still open. A thin brief is normal. Inventing the missing half is not — ask.

**From an existing codebase.** Read the code first, then write down what is already true. Three rules hold this honest:

- Every sentence about behaviour cites a file you actually opened, with a line number where it helps.
- Areas you could not read do not get documented. List them instead, as open questions.
- An ADR is backfilled only for a real decision — one where an alternative was available and something was chosen. If the storage engine is what the template shipped with, that is not a decision; record it as an open question in `spec/00` rather than inventing a rationale nobody had.

## 3. Write the tree, in dependency order

Each file points at the ones before it, so write them in this order. The map goes last because it indexes everything else.

| Order | File | Content |
|---|---|---|
| 1 | `docs/spec/00-overview.md` | Document info, purpose, guiding principle, scope, out of scope, users, environments, glossary, open questions |
| 2 | `docs/spec/NN-*.md` | One document per area, `## N. Title` sections |
| 3 | `docs/spec/NN-dependencies.md` | Only when other repositories are involved: a table with "Blocks release" and "Status" columns |
| 4 | `docs/adr/template.md` | Copied as-is from the template below |
| 5 | `docs/adr/NNNN-*.md` | One file per decision |
| 6 | `docs/adr/README.md` | The rules and the register table |
| 7 | `docs/plan/README.md` | Task format, identifiers, definition of done, how to assign work |
| 8 | `docs/plan/NN-*.md` | One file per milestone |
| 9 | `docs/plan/roadmap.md` | State today, milestones table, why this order, risks |
| 10 | `docs/README.md` | The map: how to use, the three tables, conventions |

Skeletons for all ten: [references/templates.md](references/templates.md).

### Do not write the whole plan

Write the **current milestone in full** — every task, with its spec links and done-conditions. Write later milestones as a goal and an end-of-milestone line only, with their tasks left for when they are next.

A task written six weeks early is written against a spec that will have changed by then, so it gets rewritten or, worse, followed. The roadmap's milestones table still lists them all, so nothing is lost from the overview.

### The definition of done is mostly project-specific

Two items are universal and go in every project:

1. If the work changed behaviour relative to the specification: **the specification is corrected first, then the code.**
2. The checkbox is ticked by whoever finished the task, in the same commit as the code.

Everything else has to come from this project's real toolchain. Read `package.json`, `pubspec.yaml`, `Makefile`, CI config — whatever exists — and derive the rest: the test command, the type check, the linter, the conventions this repository already enforces. A copied list naming tools the project does not use is worse than a short one, because the first item nobody can run teaches people to skip the list.

### Risks: generalize the rule, not the table

A risk that could invalidate a decision gets a task in an early milestone, so it fires before work is built on the assumption. Fill the "Risks pulled ahead of the queue" table from this project's actual risks — an external dependency someone else owns, an API whose behaviour is assumed rather than measured, a platform limit nobody has hit yet. Leave the table out if there are none; three invented risks are worse than an absent section.

## 4. Fill the roadmap

"State today" has three mandatory rows: the current milestone, the last completed task, and what is next. On a fresh tree that reads "M0, nothing completed, start with the first task" — which is correct and useful.

Add a fourth row only for something needed at the start of *every* session that lives nowhere else: a deployed URL, a standing blocker, something you are waiting on from the user.

Then the milestones table with progress counters (`0/6`), "Why this order" as prose explaining the real constraints, and "What is not in the plan" pointing at the out-of-scope section rather than repeating it.

## 5. Hand back

Report what was created and where the entry point is: `docs/plan/roadmap.md`, section "State today". Name the first task and offer to run it with `project-docs:docs-task`.

Say plainly what you could not verify — spec sections built on the brief rather than on code, decisions recorded as open questions, areas of the codebase you did not read. That list is the most useful thing in a fresh documentation tree, because it is the part somebody has to fix.
