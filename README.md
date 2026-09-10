# Claude Code Plugins

A personal marketplace of Claude Code plugins. Everything here is markdown: skills, references and a few Node scripts. There is no build step and nothing to compile.

## Install

```
/plugin marketplace add mrstroz/claude-code-plugins
/plugin install jira@mrstroz-marketplace
```

Swap `jira` for whichever plugin you want. Installed skills trigger on their own when the conversation matches, or you can call them by name with `/<skill>`.

## Plugins

### jira

JIRA over the REST API v3, from ticket creation to release paperwork.

| Skill | What it does |
| --- | --- |
| `jira-task` | Turns a described feature, bug or improvement into a well-structured ticket, drafted for review before it is sent |
| `jira-feedback` | Writes and posts a comment on an existing issue, in whatever language the thread is already using |
| `jira-fetch` | Downloads issues into minimal JSON so other skills read them without burning tokens on MCP |
| `jira-daily-summary` | Morning triage: what needs action, what is ready to go, what is only information |
| `jira-release-notes` | Business-facing feature overview for a single version |
| `jira-roadmap` | Condensed multi-version roadmap for the whole project |
| `jira-testing-release` | Test scenarios for a release, built from issue descriptions plus a git diff |

Needs `JIRA_EMAIL` and `JIRA_API_TOKEN` in the environment.

### project-docs

The spec/ADR/plan documentation method, packaged so a new project gets it in one command and an old one stops drifting away from its code.

| Skill | What it does |
| --- | --- |
| `docs-init` | Scaffolds `docs/spec`, `docs/adr` and `docs/plan`, greenfield from a brief or by reading an existing codebase |
| `docs-task` | Runs a task from the plan and then updates spec, ADR, checkbox and roadmap so the docs still match the code |
| `docs-summary` | Reads the plan back as one table ordered by priority. Read-only, writes nothing |
| `docs-sync` | Mirrors the plan's tasks to GitHub Issues and reads the closings back. Opt-in per project |
| `docs-style` | The writing rules the others follow: short, checkable, scannable, with hard length ceilings |

Works in Polish and English trees. GitHub mirroring is off until a project adds `docs/docs.config.json`, and needs the `gh` CLI logged in.

### utils

Small helpers for everyday work.

| Skill | What it does |
| --- | --- |
| `commit` | Conventional commits with the task number picked up from the branch name, offered at two lengths |
| `claude-md` | Proposes CLAUDE.md updates after conventions or tooling change |
| `declutter` | Cuts filler and repetition from a document without losing a single fact or caveat |
| `humanize-content` | Final language pass in Polish or English that strips the AI tells before publishing |
| `grill-me` | Interrogates a plan or architecture until every branch of the decision tree is resolved |

### payload-cms

Content in and out of Payload CMS projects over REST. Nothing about the content model is hardcoded: collections, blocks and locales are discovered at runtime from the live API.

| Skill | What it does |
| --- | --- |
| `payload-content` | Creates, updates and deletes documents, uploads media, composes blocks and rich text, fills in translations |
| `payload-query` | Reads and audits only. It passes `--read-only` to the client, which then refuses any non-GET request |

Writes are guarded in the script rather than in prose: a non-localhost host refuses without `--yes`, and every update or delete snapshots the document to `.payload-backups/` first.

Auth comes from `PAYLOAD_API_KEY`, `PAYLOAD_TOKEN`, or `PAYLOAD_EMAIL` and `PAYLOAD_PASSWORD`, in that order. The host is taken from `PAYLOAD_BASE_URL` when set, otherwise from what discovery finds in the project.

### dataforseo

`seo-research` pulls keyword volume and difficulty, competitor and domain analysis, live SERP positions and backlink profiles from the DataForSEO API v3, routing each question to the right endpoint through one generic client script.

Needs `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`.

### personas

Three consultation skills that answer from inside a specific person's experience instead of giving balanced expert advice: `fryderyk` on B2B SaaS sold to SMB hospitality, `piotr` on marketplaces, HR tech and bootstrapped Polish software, `stanislaw` on venture math and defence tech investing.

### qa

Manual QA of a feature, done in a real browser rather than described.

| Skill | What it does |
| --- | --- |
| `ui-test-report` | Derives the scenarios from the ticket and the diff, writes them down as `docs/qa/<TASK>/scenarios.json` with the test data they need, runs every one in a browser, captions each screenshot with what it proves and a frame around the element that shows it, optionally checks the saved data in the local database (withDB), and reports a pass/fail/blocked table with reproduction steps |

Two drivers, chosen at the start of a run: Playwright in a QA window that stays open between runs (default — Chromium or Brave on a profile of its own, logged in once by hand, one command runs the whole file, `--fast` for a re-run), or the user's own Chrome through the Claude in Chrome extension when the app needs their real session. Playwright is installed once per machine under `~/.cache/qa-ui-test`; the runner prints the command when it is missing. A task directory holds one `scenarios.json`, one `results.json` (the latest run's metadata and, per scenario, the last result with the id of the run that produced it), one `report.md` and one `screenshots/`; a re-run overwrites in place and the repository's history is the archive between builds. Test data is prepared by named setups (HTTP, a project command, or SQL when the database is configured), recorded with the run id and removed by cleanup; `--keep-data` keeps it for diagnosis. withDB reads the database through the running Docker container's own client (MySQL/MariaDB) or `node:sqlite`, read-only, configured in `docs/qa/qa.config.json` without secrets. Posting a report to a ticket is `jira:jira-feedback`.

### pair

Pair programming, or a three-agent team, across separate Claude Code tabs in the same directory, talking through cross-session messages.

| Skill | What it does |
| --- | --- |
| `driver` | Does the task: assembles the team, records the repository baseline, writes the plan with acceptance criteria and gates, keeps the shared state file, sends every review request with a revision and quoted evidence, integrates everybody's changes and reports to the user |
| `navigator` | The one reviewing tab of a pair: holds the architect's and the tester's responsibilities together |
| `architect` | Guards the shape of the change, the interfaces, the dependencies and the consequences; approves the gated items, reviews the rest asynchronously. Picks the profiles it weighs especially, and a team may hold several architects with different ones |
| `tester` | Turns the criteria into checks, writes tests and reproductions in parallel with the implementation, runs the verification and reports command, result and the lines that matter. A team may hold several, each with its own area, files and review artifacts |

**Compositions.** A pair is one driver and one navigator: `/pair:navigator` in tab B, then `/pair:driver <task>` in tab A. A team is one driver, at least one architect and at least one tester, with no upper bound on either — the smallest is `/pair:architect` in tab B, `/pair:tester` in tab C, then `/pair:driver <task>` in tab A. A five-tab run looks like this:

| tab | skill | rename to | covers |
| --- | --- | --- | --- |
| A | `/pair:driver <task>` | — | does the work, integrates, coordinates, reports |
| B | `/pair:architect` → picks **Project Architect** | `pair-architect-[project]` | that the change follows what this repository already does |
| C | `/pair:architect` → picks **Code Quality** + **Pragmatist** | `pair-architect-[code-quality]-[pragmatist]` | responsibilities and abstractions, and whether each of them earns its place |
| D | `/pair:tester` | `pair-tester-[api]` | the API contract and its error cases |
| E | `/pair:tester` | `pair-tester-[e2e]` | the checkout flow end to end, and the integration run |

Start every reviewing tab before the driver; each waits for the driver's first message. There is exactly one driver, and a driver session belonging to another task is never taken over.

**Architect profiles.** An architect (and a navigator) asks the user once, before it starts waiting, what to weigh especially: Default, Code Quality, Project Architect, Pragmatist, any combination. The standing duties — placement, interfaces, dependencies, compatibility, reversibility — apply either way and are not a profile; Default means nothing added and is neutral when ticked alongside others. The definitions live in `pair/references/architect-profiles/`. Two architects can hold the same profiles, different ones or none, and the plan gives each a scope of its own.

**Names.** Renaming a reviewing tab lets the driver find it without asking: `pair-nav`, `pair-architect`, `pair-tester`, or the same with a suffix — `pair-architect-[project]-[code-quality]`, `pair-tester-[e2e]`, brackets optional. A suffix is a suggestion the driver reads into the question and the plan, never a configuration by itself, and a name that merely looks similar (`pair-architectural`, `pair-testers`, `my-pair-architect`) matches no role.

The sessions are real tabs, not subagents; the protocol lives in `pair/references/protocol.md`, and the task's state (goal, members with their profiles and scopes, plan, decisions, open blockers, pending reviews) in `~/.cache/claude-pair/<repo>-<hash>/<run>.md`, written by the driver only. Every review request points at a snapshot of the working tree, taken by `pair/scripts/snap.sh` as an immutable ref under `refs/pair/<run>/` without touching the index, so a reviewer reads the revision and not whatever the driver has typed since. Every verdict is recorded against one member, one item, one revision and one sha: a gate opens when every required reviewer has approved that exact revision, one reviewer's `FIX` is not answered by another's `OK`, and a reviewer is never dropped from the required list to get past either. Approval is required where the plan says so — the plan itself, interfaces, schema, and any deployment, migration or push before it runs — and asynchronous elsewhere; `--strict` gates every step.

## Repository layout

```
<plugin>/
  .claude-plugin/plugin.json     name, version, description, author
  skills/<skill-name>/SKILL.md   frontmatter plus the instructions
    references/                  detail loaded only when needed
  references/                    files shared by several skills of one plugin
    scripts/                     Node helpers the skill shells out to
```

`.claude-plugin/marketplace.json` in the repository root registers every plugin. `CLAUDE.md` holds the conventions for working on the skills themselves, including why several of them are shaped the way they are.

## Contributing

Issues and pull requests are welcome. Bump the plugin `version` with every change, patch for fixes and small tweaks, minor for new features or a real change in behaviour.
