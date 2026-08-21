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

`project-docs/` packages the spec/ADR/plan documentation method used in sibling repos (`transhans-mobile/docs/`, `tesoro-huella/docs/`, `ledlive/docs/`) as four cooperating skills:

- `docs-init` scaffolds `docs/{spec,adr,plan}`, `docs-task` runs a plan task and closes the documentation loop, `docs-summary` prints the plan back as one table, `docs-style` holds the writing rules
- `docs-init` and `docs-task` invoke `project-docs:docs-style` rather than restating its rules, so the style guide has one home
- `docs-summary` is read-only (`allowed-tools: Read, Glob, Grep, AskUserQuestion`) and writes no file — a generated snapshot committed next to the plan goes stale on the next ticked checkbox. Its trigger boundary against `docs-task` matters: "co teraz" / "next task" means run the work, "co jest do roboty" / "what's left" means list it
- Task state lives in the checkbox (`[ ]` open, `[x]` done, `[-]` rejected) and priority in an ASCII token after it (`(^)` `(=)` `(v)`). Both sit after the checkbox so existing greps (`^- \[x\]`) keep working, and a missing priority token reads as `(=)` so plans predating the marker stay valid. Rejected tasks are never deleted — the number is never reused — and they leave the roadmap progress denominator (`4/6, 1 rejected`). The id grep also accepts backticks (``\*\*`?WH-[0-9]+`?\*\*``) because roadmaps write ids inside links
- `(^)` means the rest of the milestone waits on this task, not that the task is important; almost every task in a milestone is necessary, so "important" sorts nothing. The one-third cap is what keeps that honest, and its denominator is the milestone's *open* tasks — counting finished ones lets a milestone drift over the cap without a single new task
- **Where a blocker resolves is per-project and recorded in `plan/README.md`**: the cross-repo dependencies table when other repositories are involved, the open-questions table in `spec/00` otherwise. `ledlive` is single-repo, has no dependencies document and still has nine blocked tasks, so a skill that resolves blockers only through that document cannot read it
- Length limits are **ceilings, not ranges**. A floor invites padding into files whose own rule is that nothing goes in that could be deleted; a short ADR is a prompt to check the Options table and Context, not to write more. One exception to the ceiling: a catalog with one entry per block or endpoint splits by entry group, not by line count
- Doc skeletons live in `docs-init/references/templates.md` with their rules adjacent, not in `assets/` — they are read and adapted per project, and each one needs its constraints ("never renumber, append", the length ceiling) in view while it is filled in. Use `assets/` instead when a file is copied verbatim into the user's repo for them to fill in by hand, as `utils:humanize-content` does with `assets/humanize.template.md`
- The tree is language-neutral: one set of skeletons plus a PL/EN vocabulary table in `docs-init/references/headings.md`; a third language is a new column, not a second skeleton set. The milestone label translates with everything else (`M1` in English, `E1` in a Polish tree using *Etap*) and is recorded in `docs/README.md` under Conventions alongside the language
- **Specification = current truth; ADR = current decision plus optional history.** A spec section is edited in place and stale content deleted, with no "changed", "correction", "previously X" annotation and no superseded value parked beside the new one — the reader has to learn how the system works now without reconstructing how it got there. The same holds for an ADR body, which is why the `## Amendment (YYYY-MM-DD)` mechanism was retired in 0.4.0: it left the body asserting something no longer true, and the real trees proved the cost — a `## Sprostowanie` on ledlive's ADR-0042 carried the *live* DMARC record while Konsekwencje above it still described the state before onboarding. An earlier decision now survives only in an optional `## Decision History` at the end, and only where it explains why the architecture looks the way it does. Context saying what held before is not history in that sense — it is what forces the decision, and it stays
- `## Decision History` is deliberately absent from the `adr/template.md` skeleton copied into projects, and lives in the rules plus the vocabulary table instead. A visible empty section in a skeleton gets filled, and this one is meant to be rare. A changed parameter, name or implementation detail is the same decision and gets an edit; a new ADR is for a new decision or one replaced outright
- Shell checks in `docs-task/references/catch-up.md` are validated against the real trees before they ship. Two of them were not, and on `ledlive` the stale-path check flagged 47 of 50 cited paths — a check that flags most of what it reads teaches the model to skip its output, which costs more than having no check

## Payload CMS Plugin

`payload-cms/` moves content in and out of Payload CMS projects over REST, as two skills that share one set of scripts and references:

- `payload-content` writes (create/update/delete, media, rich text, translations); `payload-query` reads only and passes `--read-only` to the client, which refuses any non-GET request
- Scripts and references live under `payload-content/`; `payload-query` reaches them by glob (`**/payload-content/scripts/payload-api.mjs`). That glob is the fragile form — see the cross-skill reference rule under Conventions — and `project-docs` has already moved off it. Discovery is one file with a "stop after step 4 for read-only work" marker rather than two copies that drift
- The split is not read-vs-write for its own sake — most writes begin with a read, and a read that precedes a write belongs in `payload-content`. It exists so the write skill's guard rails are not competing for attention with `where`-operator syntax
- Nothing about a project's content model is hardcoded. Two real Payload projects shared three collection slugs and one block slug whose fields differed entirely, so the skills discover collections, blocks and locales at runtime and treat the live API as the schema oracle (`?locale=all` reveals which fields are localized, at any nesting depth)
- Safety lives in `payload-api.mjs`, not in prose: writes to a non-localhost host refuse without `--yes`, `update`/`delete` snapshot the document to `.payload-backups/` first, and `whoami` exits non-zero when credentials resolve to no user. An instruction the model can forget is not a safeguard

## JIRA Comment Skill

`jira-feedback` turns rough dictated input into a JIRA comment. Its redesign settled four things that are easy to re-litigate:

- **The reference examples are the specification, so they have to obey the style themselves.** The previous version stated a plain-writing rule and then, two lines below it, showed an example whose bullets used an em dash in four cases out of five. The model copies examples harder than it follows rules, which is why the comment came out sounding generated. Only two tics are targeted — em-dash density and identical bullet rhythm — because those are the ones the user actually objected to; confident openers and closing summary sentences were explicitly kept
- **No named formats and no counts.** A format menu forces a choice before anything has read the input, and a floor like "3-8 bullets" pads two real points into three. Shape follows content, and the only length rule is that nothing stays in which could be deleted without losing information. Same principle as the docs plugin: limits are ceilings, or they are absent
- **Language comes from the thread, never from a question.** The recent comments decide it rather than the description, because the comment addresses whoever is talking now, not whoever opened the ticket. The detected language is stated in one line above the draft so a wrong guess costs a word, not a redraft
- **`post-comment.mjs` reads the comment back after posting.** API v3 takes ADF rather than markdown, so a converter bug would otherwise surface only when somebody opens the issue in a browser. The converter covers just what the skill writes (paragraph, bullet list, bold, code, link, mention) and leaves anything else as literal text, on the grounds that a stray `#` costs less than a silently dropped sentence
- **`@Name` mentions resolve only against people already on the issue** — reporter, assignee, comment authors — because `fetch-issues.mjs` keeps `displayName` and drops `accountId`, and widening it there would bill every skill that fetches in bulk for data only this one needs. `post-comment.mjs` looks the participants up itself at post time, which also means a mention cannot reach somebody outside the thread; an unresolved or ambiguous name stays plain text and warns rather than guessing which colleague to notify

## Commit Skill

`utils/skills/commit` drafts the message; the human picks how long it is. That line has been moved in both directions already, so it is worth recording where it landed and why:

- **The model picks the type, the task number and the wording. It does not pick whether there is a body.** A version that inferred the body from the diff — ADR mentioned, breaking change, migration step — put five bullets on a routine docs commit, because "will somebody want to read this in six months" is not a question a diff answers. Length is a judgement about the reader, and the reader is the user
- **Both lengths are drafted up front and shown in one picker**, rather than asked about in a round of their own. The pre-rebuild format menu (Short / Descriptive / Multi-line) forced a choice before any text existed, and a length question asked before drafting has the same defect. Two `preview` panes under one cursor cost no extra round trip and let the user compare what will actually land
- **Short is the first option every time**, including for changes that look consequential. Asking for a description that is already drafted costs one keystroke; deleting one that arrived uninvited costs every commit. The skill also does not argue for the longer option in prose — the preview is the argument
- The two options are one commit at two lengths, not two drafts: same type, same task number, same subject, body added below. A second option that also reworded the subject would turn a length choice into a writing choice

## Conventions

- Reference a sibling skill's files as `${CLAUDE_PLUGIN_ROOT}/skills/<skill>/references/<file>.md`, not by glob. A glob is scoped to the user's project, where plugin files do not live, and the plugin cache keeps old versions side by side (`project-docs/0.1.0/` and `0.2.0/`, both marked `.in_use`), so a glob that does reach it can resolve to a copy predating half the content. Where a glob is kept as a fallback, say that the highest version in the path wins
- Save review reports to `docs/pr-reviews/` or `docs/reviews/` as `{branch}-{YYYY-MM-DD}.md`, replacing branch slashes with hyphens
- Prefix reviewer issue IDs by role: VM-, BE-, FE-, QA-, SC-, DV-
- Select reviewers/agents conditionally based on file patterns and content keywords, then confirm with the user via `AskUserQuestion`
- All JIRA skills read via `jira-fetch`'s `fetch-issues.mjs` (REST API v3), including `jira-feedback`, which pulls a single issue with `--jql "key = X"` for thread context. `jira-feedback` also writes over REST (`post-comment.mjs`), so MCP is left for `createJiraIssue` and Confluence publishing
- `jira-fetch` requires `JIRA_EMAIL` and `JIRA_API_TOKEN` env vars for JIRA REST API authentication
- Use single-line conventional commit format with auto-detected task numbers from branch names
- Bump `version` in `<plugin>/.claude-plugin/plugin.json` after each change — patch for bug fixes and small tweaks, minor for new features or significant behavior changes
