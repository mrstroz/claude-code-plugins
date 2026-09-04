---
name: jira-release-notes
description: Generate detailed release notes for a single Jira version. Transforms technical issues into a professional, business-facing feature overview with categorized items. Use when the user wants release notes, a version summary, a release plan, or a feature overview for a specific version. Triggers on any request mentioning release notes, version summary, release plan, or feature overview.
argument-hint: "[version number]"
---

# JIRA Release Notes Generator

Generate professional, client-facing release notes from Jira version data. Produces a detailed feature-by-feature overview for a single release version with categorized items. Pulls every issue in one call through the `jira-api` script, so the data arrives as one JSON file rather than through MCP round trips or subagents.

## Workflow

1. **Initial setup** — Ask language and output format via `AskUserQuestion`
2. **Configuration** — The script reads the site and project key from `.ai/jira.config.json`; ask only when it reports none
3. **Fetch issue data** — Run `export-issues` to get all issues for the version
4. **Filter issues** — Remove internal, technical-only, and low-priority items
5. **Categorize into themes** — Group issues into 3-7 business-facing categories
6. **Generate business-value summaries** — Transform technical descriptions into user-outcome language
7. **Compose release notes document** — Assemble the final document using the reference format
8. **Present draft for review** — Show the release notes and ask for confirmation
9. **Output** — Deliver as markdown or publish to Confluence

---

## Initial Setup (Step 1)

Before anything else, use a single `AskUserQuestion` call with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Output format** (header: "Output"): Markdown document | Confluence page

If Confluence output is selected, immediately follow up with one more `AskUserQuestion` (header: "Confluence URL") asking for the target Confluence page URL (the full URL, e.g. `https://mycompany.atlassian.net/wiki/spaces/PROJ/pages/123456`).

If `$ARGUMENTS` contains version number(s) (e.g., `2.1.0`, `v3.0`), extract them for use in Step 3.

Use the selected language for the entire document. Translate section headers according to the translations in the respective format reference file.

## Configuration (Step 2)

Every tracker call goes through `${CLAUDE_PLUGIN_ROOT}/skills/jira-api/scripts/jira.mjs`, which reads the site and the project key itself from `.ai/jira.config.json`, found by walking up from the working directory (falling back to the `tracker` block of `.ai/tesoro.config.json`). When it exits with code 2 saying `no .ai/jira.config.json found`, ask once via `AskUserQuestion` (header: "JIRA config") for the site (e.g. `mycompany.atlassian.net`) and the project key, offer to write the file, and continue. Details: `${CLAUDE_PLUGIN_ROOT}/skills/jira-api/SKILL.md#setup`.

Every exported issue carries its own `url`, so no base URL has to be built for links in the output.

---

## Fetch Issue Data (Step 3)

This single step replaces the old search + subagent extraction pattern. `export-issues` fetches all issues with full descriptions and comments in one call, returning a minimal JSON file with Markdown text ready for transformation into release notes.

### Determine Version and Fetch

**If a version was extracted from `$ARGUMENTS`**, run a targeted export. Write only the predicate — the script composes the project scope around it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/jira-api/scripts/jira.mjs" export-issues \
  --jql "fixVersion = \"${VERSION}\" ORDER BY priority DESC, issuetype ASC" \
  --output "/tmp/jira-release-notes-${VERSION}-$(date +%Y%m%d-%H%M%S).json"
```

**If no version was provided**, list the project's versions first. This reads them from the project itself rather than scanning every issue for the names it carries, so it costs one request:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/jira-api/scripts/jira.mjs" list-versions
```

Present the versions to the user via `AskUserQuestion` (header: "Version") as selectable options, newest release first. Allow free text input for a version not in the list.

After the user selects a version, run the targeted export above with that version.

If the script fails, show the error and stop. Common issues: missing `JIRA_EMAIL` or `JIRA_API_TOKEN` env vars.

### Read and Parse

The JSON output contains per issue: `key`, `url`, `type`, `status`, `statusCategory`, `resolution`, `priority`, `assignee`, `reporter`, `labels`, `fixVersions`, `components`, `parent`, `summary`, `created`, `updated`, `description` (Markdown), `comments[]` (with `id`, `author`, `created`, `body` as Markdown, and `replyTo` when the comment answers another).

Descriptions and comments are the key inputs for transforming technical issues into business-value summaries in Steps 5-6. Having them available directly (instead of via subagent extraction) enables better cross-issue reasoning — detecting duplicate features, identifying themes, and producing more consistent language.

---

## Filter Issues (Step 4)

Apply these filtering rules to determine which issues appear in the release notes:

| Issue Type | Priority | Action |
|------------|----------|--------|
| Epic, Story, Feature | Any | Always include |
| Task | Major or higher | Include if user-facing (check summary/labels) |
| Task | Normal or lower | Skip (unless summary suggests a user-facing feature) |
| Bug, Hotfix | Critical, Blocker | Always include |
| Bug, Hotfix | Major | Always include |
| Bug, Hotfix | Normal | Include (skip only if purely internal/technical) |
| Bug, Hotfix | Minor, Trivial | Skip (unless it affects a visible user workflow) |
| Sub-task, Chore | Any | Skip |

**Keyword exclusion** — skip issues whose summary contains any of these terms (case-insensitive): `refactor`, `chore`, `cleanup`, `ci/cd`, `pipeline`, `dependency update`, `bump`, `internal`, `tech debt`, `lint`, `formatting`. If the summary also clearly describes a user-facing improvement (e.g., "Refactor checkout to support saved payment methods"), keep the issue — the keyword list is meant to catch routine internal work, not features that happen to mention it.

## Categorize into Themes (Step 5)

Use a two-pass approach:

### Pass 1 — Automatic Categorization

Assign each issue to a category based on labels, components, and keywords in the summary and description:

| Keywords / Labels | Category |
|-------------------|----------|
| ui, ux, frontend, design, layout, css | User Experience |
| performance, speed, cache, optimization, latency | Performance & Reliability |
| security, auth, permission, access, encryption | Security & Compliance |
| api, integration, webhook, sync, connector | Integrations |
| report, analytics, dashboard, metrics, chart | Reporting & Analytics |
| No match found | New Capabilities |

**Bug Fixes category** — All issues with type Bug or Hotfix are placed into a dedicated **Bug Fixes** section, separate from the thematic feature categories above. Do not mix bugs into feature categories. The Bug Fixes section always appears after the Features section in the final document (see Step 7).

### Pass 2 — AI Refinement

Review the automatic categorization and adjust:

- **Merge** categories with fewer than 2 items into the nearest thematic match
- **Rename** generic categories to project-specific domain names (e.g., "New Capabilities" → "Order Management" if most items relate to orders)
- **Target**: 3-7 final categories, max 10 items per category
- **Order**: highest business-impact categories first

## Generate Business-Value Summaries (Step 6)

For each issue, produce:

- **Task number**: Jira issue key (e.g. PROJ-142)
- **Name**: 3-8 words, title case, no technical jargon
- **Summary**: 2 sentences focused on user/business value, max 40 words

Use the `description` and `comments` fields from the JSON data to understand what changed from the user's perspective. Having full issue data available enables more accurate business-value transformation than working from summaries alone.

### Transformation Rules

- Frame every summary from the client's perspective — describe how the feature benefits the end user or improves their business outcomes, not just what changed in the product
- Rewrite technical descriptions as user outcomes
- "Implemented caching layer" → "Faster loading times across the application"
- "Added database index on search" → "Search results appear instantly"
- "Migrated to OAuth 2.0" → "More secure sign-in with single sign-on support"
- Remove: story points, sprint names, assignees, component names
- Active voice, confident tone — no hedging ("might", "should", "could")
- Max 40 words per summary (2 sentences)

### Bug Fix Transformation Rules

- For bugs, describe what was broken and what now works correctly
- "Fixed NPE in order service" → "Orders no longer fail during checkout when a discount code is applied"
- "Fixed CSS overflow in product grid" → "Product listings now display correctly on all screen sizes"
- "Hotfix: payment callback timeout" → "Payments are now confirmed reliably without delays or missing confirmations"
- Focus on the user-visible symptom and resolution, not the technical root cause

## Compose Release Notes Document (Step 7)

Assemble the final document following the structure defined in [references/format.md](references/format.md).

```markdown
# [Project] Release Notes — Version X.Y.Z
**Release:** X.Y.Z | **Target:** [quarter/date] | **Status:** [overall status]

## Executive Summary
[2-3 sentences highlighting how this release improves the client's experience and business outcomes.]

## Features

### [Category Name]
- **PROJ-101 — Feature Name.** Summary sentence one. Summary sentence two.
- **PROJ-205 — Feature Name.** Summary sentence one. Summary sentence two.
- **PROJ-318 — Feature Name.** Summary sentence one. Summary sentence two.

## Bug Fixes
- **PROJ-410 — Fix Name.** What was broken. What now works correctly.
- **PROJ-415 — Fix Name.** What was broken. What now works correctly.

## Key Metrics & Impact *(optional)*
[Measurable improvements if available from issue data.]
```

Full example: [references/example.md](references/example.md)

### Condensation

If a version has more than 20 features:
- Limit each summary to 1 sentence (max 20 words)
- Merge minor features into grouped items
- Keep total visible items under 25

## Present Draft for Review (Step 8)

Present the complete release notes inside a clearly marked block and use `AskUserQuestion` (header: "Review"):

- **Looks good — publish** (Recommended)
- **Adjust categories** — let me reorganize the groupings
- **Adjust summaries** — let me refine the feature descriptions
- **Start over** — discard and begin from scratch

If the user asks for adjustments, apply changes and present the updated draft again. Repeat until the user confirms.

## Output (Step 9)

### Markdown Output

Present the final release notes in a code block and suggest saving to a file:

> Your release notes are ready. Want me to save them to `docs/release-notes/release-notes-{version}.md`?

If the user confirms, write the file.

### Confluence Output

Confluence publishing is the only part of this skill that uses MCP tools, and only when Confluence output was selected. Resolve the `cloudId` first — call the `getAccessibleAtlassianResources` MCP tool once and pick the resource whose URL matches the site from `show-config`.

Use the available Confluence MCP tools to publish:

- If the user provided an **existing page URL** — update that page with the release notes content
- If no page URL was provided — create a new page titled `[Project] Release Notes — Version X.Y.Z` in the project's Confluence space

If no Confluence MCP tools are found, fall back to markdown output and inform the user.

After publishing, suggest adding a link from the product roadmap page to this release notes page.
