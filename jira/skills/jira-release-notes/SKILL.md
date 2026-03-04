---
name: jira-release-notes
description: Generate detailed release notes for a single Jira version. Transforms technical issues into a professional, business-facing feature overview with categorized items and status tracking. Use when the user wants release notes, a version summary, a release plan, or a feature overview for a specific version. Triggers on any request mentioning release notes, version summary, release plan, or feature overview.
argument-hint: "[version number]"
---

# JIRA Release Notes Generator

Generate professional, client-facing release notes from Jira version data. Produces a detailed feature-by-feature overview for a single release version with categorized items and status tracking.

## Workflow

1. **Initial setup** — Ask language and output format via `AskUserQuestion`
2. **Resolve JIRA project** — Auto-discover the project via MCP tools
3. **Collect version info** — Determine which version to include
4. **Search Jira issues by version** — Lightweight metadata only
5. **Filter issues** — Remove internal, technical-only, and low-priority items
6. **Read full issue details** — Fetch descriptions and comments individually
7. **Categorize into themes** — Group issues into 3-7 business-facing categories
8. **Generate business-value summaries** — Transform technical descriptions into user-outcome language
9. **Compose release notes document** — Assemble the final document using the reference format
10. **Present draft for review** — Show the release notes and ask for confirmation
11. **Output** — Deliver as markdown or publish to Confluence

---

## Initial Setup (Step 1)

Before anything else, use a single `AskUserQuestion` call with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Output format** (header: "Output"): Markdown document | Confluence page

If Confluence output is selected, immediately follow up with one more `AskUserQuestion` (header: "Confluence URL") asking for the target Confluence page URL (the full URL, e.g. `https://mycompany.atlassian.net/wiki/spaces/PROJ/pages/123456`).

If `$ARGUMENTS` contains version number(s) (e.g., `2.1.0`, `v3.0`), extract them for use in Step 3.

Use the selected language for the entire document. Translate section headers according to the translations in the respective format reference file.

## Resolve JIRA Project (Step 2)

Auto-discover the JIRA project — do not ask the user for cloudId or projectKey.

1. Call `getAccessibleAtlassianResources` to get the available cloud instances. Use the first (or only) instance as the cloudId.
2. Call `getVisibleJiraProjects` to list all projects in the instance.
3. If only one project exists, use it automatically.
4. If multiple projects exist, pick the most likely match based on context (version numbers from `$ARGUMENTS`, Confluence page content if available) or present them via `AskUserQuestion` (header: "Project").

Store the resolved cloudId and projectKey for the rest of the session.

---

## Collect Version Info (Step 3)

If a version was extracted from `$ARGUMENTS`, use it directly.

If no version was provided:
1. Use JQL to discover versions with issues: `project = {projectKey} AND fixVersion IS NOT EMPTY ORDER BY fixVersion DESC` (fields: `["summary", "fixVersion"]`). Extract unique fixVersion values.
2. Present discovered versions to the user via `AskUserQuestion` (header: "Version") as selectable options.
3. Allow free text input for a version not in the list.

## Search Jira Issues by Version (Step 4)

Use the available MCP tool for JQL search with lightweight metadata fields only. Do not request `description` here — on versions with many issues the combined payload can exceed MCP size limits, causing the search to fail.

```
project = {projectKey} AND fixVersion = "{version}" ORDER BY priority DESC, issuetype ASC
fields: ["summary", "status", "issuetype", "priority", "labels", "components"]
maxResults: 100
```

If more than 100 issues exist, use the `nextPageToken` to paginate through all results.

From each result, collect: `key`, `summary`, `issuetype`, `priority`, `status`, `labels`, `components`.

## Filter Issues (Step 5)

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

**Keyword exclusion** — skip issues whose summary contains any of these terms (case-insensitive): `refactor`, `chore`, `cleanup`, `ci/cd`, `pipeline`, `dependency update`, `bump`, `internal`, `tech debt`, `lint`, `formatting`.

## Read Full Issue Details (Step 6)

Call `getJiraIssue` for **every** issue that passed filtering in Step 5. Step 4 only fetched lightweight metadata, so descriptions and comments must be retrieved individually here.

You MUST pass `fields: ["comment", "description"]` on every `getJiraIssue` call. Omitting `fields` returns the entire issue payload and can exceed MCP size limits.

**Batching:** process in batches of 10 concurrent calls.

**Prioritization (more than 30 filtered issues):**

If more than 30 issues passed filtering, fetch full details for the top 30 only, prioritized as follows:
1. Epic / Story / Feature (all priorities)
2. Blocker / Critical bugs
3. Remaining issues by priority descending

For issues beyond the 30-issue cap, skip the `getJiraIssue` call and generate summaries from the `summary` field collected in Step 4 alone.

## Categorize into Themes (Step 7)

Use a two-pass approach:

### Pass 1 — Automatic Categorization

Assign each issue to a category based on labels, components, and keywords in the summary and description (if available from Step 6 — for overflow issues beyond the 30-cap, use summary alone):

| Keywords / Labels | Category |
|-------------------|----------|
| ui, ux, frontend, design, layout, css | User Experience |
| performance, speed, cache, optimization, latency | Performance & Reliability |
| security, auth, permission, access, encryption | Security & Compliance |
| api, integration, webhook, sync, connector | Integrations |
| report, analytics, dashboard, metrics, chart | Reporting & Analytics |
| No match found | New Capabilities |

**Bug Fixes category** — All issues with type Bug or Hotfix are placed into a dedicated **Bug Fixes** section, separate from the thematic feature categories above. Do not mix bugs into feature categories. The Bug Fixes section always appears after the Features section in the final document (see Step 9).

### Pass 2 — AI Refinement

Review the automatic categorization and adjust:

- **Merge** categories with fewer than 2 items into the nearest thematic match
- **Rename** generic categories to project-specific domain names (e.g., "New Capabilities" → "Order Management" if most items relate to orders)
- **Target**: 3-7 final categories, max 10 items per category
- **Order**: highest business-impact categories first

## Generate Business-Value Summaries (Step 8)

For each issue, produce:

- **Status**: mapped from Jira status — `[x]` Done | `[~]` In Progress | `[ ]` Planned
- **Task number**: Jira issue key (e.g. PROJ-142)
- **Name**: 3-8 words, title case, no technical jargon
- **Summary**: 2 sentences focused on user/business value, max 40 words

### Transformation Rules

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

## Compose Release Notes Document (Step 9)

Assemble the final document following the structure defined in [references/format.md](references/format.md).

```markdown
# [Project] Release Notes — Version X.Y.Z
**Release:** X.Y.Z | **Target:** [quarter/date] | **Status:** [overall status]

## Executive Summary
[2-3 sentences about the release theme and key benefits.]

## Features

### [Category Name]
- [x] **PROJ-101 — Feature Name.** Summary sentence one. Summary sentence two.
- [~] **PROJ-205 — Feature Name.** Summary sentence one. Summary sentence two.
- [ ] **PROJ-318 — Feature Name.** Summary sentence one. Summary sentence two.

## Bug Fixes
- [x] **PROJ-410 — Fix Name.** What was broken. What now works correctly.
- [x] **PROJ-415 — Fix Name.** What was broken. What now works correctly.

## Key Metrics & Impact *(optional)*
[Measurable improvements if available from issue data.]
```

Full example: [references/example.md](references/example.md)

### Condensation

If a version has more than 20 features:
- Limit each summary to 1 sentence (max 20 words)
- Merge minor features into grouped items
- Keep total visible items under 25

## Present Draft for Review (Step 10)

Present the complete release notes inside a clearly marked block and use `AskUserQuestion` (header: "Review"):

- **Looks good — publish** (Recommended)
- **Adjust categories** — let me reorganize the groupings
- **Adjust summaries** — let me refine the feature descriptions
- **Start over** — discard and begin from scratch

If the user asks for adjustments, apply changes and present the updated draft again. Repeat until the user confirms.

## Output (Step 11)

### Markdown Output

Present the final release notes in a code block and suggest saving to a file:

> Your release notes are ready. Want me to save them to `docs/release-notes/release-notes-{version}.md`?

If the user confirms, write the file.

### Confluence Output

Use the available Confluence MCP tools to publish:

- If the user provided an **existing page URL** — update that page with the release notes content
- If no page URL was provided — create a new page titled `[Project] Release Notes — Version X.Y.Z` in the project's Confluence space

If no Confluence MCP tools are found, fall back to markdown output and inform the user.

After publishing, suggest adding a link from the product roadmap page to this release notes page.
