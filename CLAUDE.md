# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Claude Code plugin marketplace containing markdown-based skills and agents — no build system, tests, or compiled code. The focus is on creating high-quality skills that follow Claude Code and Agent Skills conventions.

## Skill Creation Rules

- Place each skill in `<plugin>/skills/<skill-name>/SKILL.md` with optional `references/`, `scripts/`, and `assets/` subdirectories
- Write YAML frontmatter with `name` and `description` as the minimum; other fields: `argument-hint`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `model`, `context`, `agent`, `hooks`
- Make `description` "pushy" — include both what the skill does AND specific contexts for when to trigger it, since skills tend to undertrigger rather than overtrigger
- Put all "when to use" information in the `description` field, not in the SKILL.md body — the body only loads after triggering
- Keep SKILL.md body under 500 lines; move detailed reference material to `references/` files and link them from SKILL.md
- Use `$ARGUMENTS` for user input, `$ARGUMENTS[N]` or `$N` for positional args, `${CLAUDE_SESSION_ID}` for session ID
- Use `!`command`` syntax to inject dynamic shell output into skill content before Claude sees it
- Set `context: fork` with `agent: Explore|Plan|general-purpose` to run a skill in an isolated subagent context
- Use `allowed-tools` to restrict tool access when the skill should be read-only or limited

## Skill Writing Style

- Write all instructions in imperative form
- Explain WHY something matters, not just WHAT to do — LLMs respond better to reasoning than rigid rules
- Avoid heavy-handed ALWAYS/NEVER in caps; reframe as explanation of reasoning instead
- Prefer concise examples over verbose explanations
- Keep the prompt lean — remove instructions that do not pull their weight
- Generalize from specific feedback rather than overfitting to narrow examples
- Use progressive disclosure: metadata (~100 words always loaded) → SKILL.md body (loaded on trigger) → bundled resources (loaded on demand)

## Plugin Structure

- Register each plugin in `.claude-plugin/marketplace.json` with `name`, `source` path, and `description`
- Place plugin metadata in `<plugin>/.claude-plugin/plugin.json` with `name`, `version`, `description`, `author`
- Define subagents as markdown files in `<plugin>/agents/<agent-name>.md` — these register as `<plugin>:<agent-name>` for use with the Task tool

## Review Architecture Patterns

This repo demonstrates two distinct patterns for multi-agent code review:

- **Subagent pattern** (`pr-review/`): invoke pre-registered agents via Task tool in parallel, aggregate independently-produced findings in the orchestrating skill
- **Agent Teams pattern** (`agent-teams-review/`): use TeamCreate, SendMessage, and shared task lists so teammates communicate during review and flag cross-domain findings with `↔️CROSS` notation; spawn teammates with Sonnet to optimize token costs

## Documentation Convention Plugin

`project-docs/` packages the spec/ADR/plan documentation method used in sibling repos (`transhans-mobile/docs/`, `tesoro-huella/docs/`) as three cooperating skills:

- `docs-init` scaffolds `docs/{spec,adr,plan}`, `docs-task` runs a plan task and closes the documentation loop, `docs-style` holds the writing rules
- `docs-init` and `docs-task` invoke `project-docs:docs-style` rather than restating its rules, so the style guide has one home
- Doc skeletons live in `docs-init/references/templates.md` with their rules adjacent, not in `assets/` — they are read and adapted per project, and each one needs its constraints ("never renumber, append", the length budget) in view while it is filled in. Use `assets/` instead when a file is copied verbatim into the user's repo for them to fill in by hand, as `utils:humanize-content` does with `assets/humanize.template.md`
- The tree is language-neutral: one set of skeletons plus a PL/EN vocabulary table in `docs-init/references/headings.md`; a third language is a new column, not a second skeleton set

## Payload CMS Plugin

`payload-cms/` moves content in and out of Payload CMS projects over REST, as two skills that share one set of scripts and references:

- `payload-content` writes (create/update/delete, media, rich text, translations); `payload-query` reads only and passes `--read-only` to the client, which refuses any non-GET request
- Scripts and references live under `payload-content/`; `payload-query` reaches them by glob (`**/payload-content/scripts/payload-api.mjs`), the same cross-skill pattern `docs-style` uses. Discovery is one file with a "stop after step 4 for read-only work" marker rather than two copies that drift
- The split is not read-vs-write for its own sake — most writes begin with a read, and a read that precedes a write belongs in `payload-content`. It exists so the write skill's guard rails are not competing for attention with `where`-operator syntax
- Nothing about a project's content model is hardcoded. Two real Payload projects shared three collection slugs and one block slug whose fields differed entirely, so the skills discover collections, blocks and locales at runtime and treat the live API as the schema oracle (`?locale=all` reveals which fields are localized, at any nesting depth)
- Safety lives in `payload-api.mjs`, not in prose: writes to a non-localhost host refuse without `--yes`, `update`/`delete` snapshot the document to `.payload-backups/` first, and `whoami` exits non-zero when credentials resolve to no user. An instruction the model can forget is not a safeguard

## Conventions

- Save review reports to `docs/pr-reviews/` or `docs/reviews/` as `{branch}-{YYYY-MM-DD}.md`, replacing branch slashes with hyphens
- Prefix reviewer issue IDs by role: VM-, BE-, FE-, QA-, SC-, DV-
- Select reviewers/agents conditionally based on file patterns and content keywords, then confirm with the user via `AskUserQuestion`
- All JIRA skills use `jira-fetch` for data retrieval via REST API v3 (`fetch-issues.mjs`); MCP tools are only needed for write operations (`addCommentToJiraIssue`, `createJiraIssue`) and Confluence publishing — exception: `jira-feedback` uses `getJiraIssue` MCP for single-issue thread context
- `jira-fetch` requires `JIRA_EMAIL` and `JIRA_API_TOKEN` env vars for JIRA REST API authentication
- Use single-line conventional commit format with auto-detected task numbers from branch names
- Bump `version` in `<plugin>/.claude-plugin/plugin.json` after each change — patch for bug fixes and small tweaks, minor for new features or significant behavior changes
