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
| `ui-test-report` | Derives the scenarios from the ticket and the diff, writes them down as `qa-scenarios.json`, runs every one in a browser, captions each screenshot with what it proves, and reports a pass/fail table with reproduction steps |

Three drivers, chosen at the start of a run: Playwright in a visible window on a dedicated QA profile (default — one command runs the whole file), Playwright headless for re-runs, or the user's own Chrome through the Claude in Chrome extension when the app needs their real session. Playwright is installed once per machine under `~/.cache/qa-ui-test`; the runner prints the command when it is missing. Results stay local; posting them to a ticket is `jira:jira-feedback`.

## Repository layout

```
<plugin>/
  .claude-plugin/plugin.json     name, version, description, author
  skills/<skill-name>/SKILL.md   frontmatter plus the instructions
    references/                  detail loaded only when needed
    scripts/                     Node helpers the skill shells out to
```

`.claude-plugin/marketplace.json` in the repository root registers every plugin. `CLAUDE.md` holds the conventions for working on the skills themselves, including why several of them are shaped the way they are.

## Contributing

Issues and pull requests are welcome. Bump the plugin `version` with every change, patch for fixes and small tweaks, minor for new features or a real change in behaviour.
