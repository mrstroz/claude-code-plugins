---
name: jira-task
description: Create well-structured JIRA tasks for any software project. Use when the user describes a feature, bug, improvement, or any work item that needs to become a JIRA ticket. Analyzes the project codebase to provide accurate technical details. Always drafts the task for user review before sending to JIRA. Triggers on any request to create a task, ticket, story, bug report, or JIRA issue.
---

# JIRA Task Creator

Create well-structured JIRA tasks by analyzing the project codebase and drafting tickets for user approval.

## Workflow

1. **Initial setup** — Ask language and task type via `AskUserQuestion` (see below)
2. **Parse the request** — Identify what the user wants done and which subsystem(s) are affected
3. **Search the codebase** — Find relevant files, patterns, and existing implementations
4. **Clarify architectural decisions** — Before drafting, ask the user about any ambiguities or open design questions discovered during codebase analysis (see below)
5. **Draft the task** — Write the JIRA task in the chosen language and type
6. **Present for review** — Show the draft to the user and wait for confirmation
7. **Resolve JIRA configuration** — After user confirms the draft, resolve `cloudId` and `projectKey` (see below)
8. **Send to JIRA** — Only after configuration is resolved

## Initial Setup (Step 1)

Before anything else, use `AskUserQuestion` with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Task type** (header: "Task type"): Task — general dev work | Bug — something broken | Hotfix — critical production fix | Story — user-facing feature

Use the selected language for the entire draft. Use the selected type in the `**Type:**` field.

## Architectural Clarification (Step 4)

After analyzing the codebase but **before** drafting the task, identify anything that is not explicitly specified in the user's request and could be implemented in more than one way. Ask concise, focused questions about:

- **Data modeling** — Where should new data live? New collection/table vs. extending existing model? Embedded document vs. reference?
- **API design** — New endpoint vs. extending existing one? Which module owns this logic?
- **UI placement** — Which page/section/component should host the new feature? Modal vs. inline vs. new page?
- **Scope boundaries** — Should this affect related entities? Does the change need to appear in search, exports, or API responses?
- **Edge cases** — What happens with existing data? Migration needed? Backward compatibility?
- **Integration impact** — Does this touch external services? Any rate limits or sync concerns?

**Rules:**
- Only ask about genuinely ambiguous points — skip entirely if the request is fully clear
- **Always use the `AskUserQuestion` tool** to present questions with selectable options — never ask as plain text
- Each question MUST have 2-4 concrete options derived from codebase analysis; the user can always pick "Other" for a custom answer
- Keep headers short (max 12 chars), e.g., "Data model", "UI placement", "Scope"
- Max 4 questions per `AskUserQuestion` call (tool limit)

## Subsystem Identification

Determine affected subsystem(s) by analyzing the project structure:

1. Look for monorepo indicators — `workspaces` in `package.json`, multiple directories with their own `package.json`, `docker-compose.yml` services, or similar markers
2. Identify logical subsystems from the directory layout (e.g., `backend/`, `frontend/`, `api/`, `admin/`, `worker/`)
3. If the project is a single application, treat the top-level modules or directories as subsystems
4. If unclear, ask the user which parts of the system are affected via `AskUserQuestion`

Use the discovered subsystem names consistently throughout the task draft.

## Codebase Analysis

Before drafting, search the affected subsystem(s) to understand:

- Existing implementations of similar features (grep for related keywords)
- File structure and naming patterns in the relevant module
- Related services, models, or components that will be touched
- Any enums, constants, or configurations relevant to the task

Use findings to write accurate **Technical Details** in the task. Keep searches focused — find the specific files and patterns, not exhaustive code reviews.

## Task Formats

Every task MUST be written in the **language chosen in Step 1**. The structure varies by type. After selecting the type in Step 1, read the corresponding example file for a full reference.

### Format: Task

Standard format for general development work.

```
## [Task Title]

**Type:** Task
**Subsystem(s):** [discovered subsystems]

### Description
[1-2 sentences. What and why.]

### Acceptance Criteria
- [ ] [3-5 non-obvious checkpoints]

### Technical Details *(optional)*
- `path/to/file` — one-line hint

### Links *(optional)*
```

Example: [references/example-task.md](references/example-task.md)

### Format: Bug / Hotfix

Same as Task but with an optional **Steps to Reproduce** section between Description and Acceptance Criteria. Include it when the reproduction path is non-obvious or involves multiple steps. For Hotfix, prefix the title with `[HOTFIX]`.

```
## [Bug Title] / [HOTFIX] [Bug Title]

**Type:** Bug | Hotfix
**Subsystem(s):** [discovered subsystems]

### Description
[1-2 sentences. What is broken and what is the expected behavior.]

### Steps to Reproduce *(optional — include when repro is non-obvious)*
1. [Step 1]
2. [Step 2]
3. [Observed result vs. expected result]

### Acceptance Criteria
- [ ] [3-5 non-obvious checkpoints]

### Technical Details *(optional)*
- `path/to/file` — one-line hint

### Links *(optional)*
```

Examples: [references/example-bug.md](references/example-bug.md) | [references/example-hotfix.md](references/example-hotfix.md)

### Format: Story

More descriptive format. Stories group related functionality into numbered **Features** — each feature is a logical unit of work that could become a subtask. Keep it scannable: short feature titles, bullet points for details.

```
## [Story Title — user-centric, describes the capability]

**Type:** Story
**Subsystem(s):** [discovered subsystems]

### Description
[As a {role}, I want {capability}, so that {benefit}. 2-3 sentences expanding context.]

### Features

**1. [Feature name]**
- [Key behavior or requirement]
- [Key behavior or requirement]

**2. [Feature name]**
- [Key behavior or requirement]
- [Key behavior or requirement]

**3. [Feature name]**
- [Key behavior or requirement]

### Acceptance Criteria
- [ ] [High-level criteria covering the whole story, 3-5 items]

### Technical Details *(optional)*
- `path/to/file` — one-line hint

### Links *(optional)*
```

Example: [references/example-story.md](references/example-story.md)

## Writing Rules

- Description: 1-2 sentences, WHAT and WHY, use the project's domain language
- Acceptance Criteria: 3-5 items, non-obvious checkpoints only, checkbox format `- [ ]`
- Technical Details: only from codebase analysis, format `path/to/file` — short hint, skip if trivial
- Links: only if user provides them, never fabricate
- Prefer concrete over abstract (say "product listing page" not "the relevant page")

## Presentation

Always present the draft inside a clearly marked block and ask:

> **JIRA Task Draft — please review:**
>
> [task content]
>
> Confirm to send, or let me know what to change.

Do NOT send to JIRA until the user explicitly confirms.

## JIRA Configuration (Step 7)

After the user confirms the draft, resolve the JIRA connection before sending.

The skill needs a JIRA `cloudId` (e.g. `mycompany.atlassian.net`) and `projectKey` (e.g. `PROJ`).

**Resolution order:**

1. Check the project's `CLAUDE.md` for a JIRA config block:
   ```
   ## JIRA
   - Cloud: mycompany.atlassian.net
   - Project key: PROJ
   ```
2. If not found, ask the user via `AskUserQuestion` (header: "JIRA config") for both values.

Store the resolved values for the rest of the session.

## Sending to JIRA (Step 8)

After configuration is resolved, use the `createJiraIssue` MCP tool:

- **cloudId**: resolved in Step 7
- **projectKey**: resolved in Step 7
- **issueTypeName**: map from task type — `Task`, `Bug`, `Story` (use `Bug` for Hotfix too)
- **summary**: task title (without `##` prefix)
- **description**: full markdown body (everything below the title line — Description, Acceptance Criteria, Technical Details, Steps to Reproduce, Features, Links)

Reference format for related issues: `[{projectKey}-1234](https://{cloudId}/browse/{projectKey}-1234)`
