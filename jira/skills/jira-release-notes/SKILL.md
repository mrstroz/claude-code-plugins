---
name: jira-release-notes
description: Generate detailed release notes for a single Jira version. Transforms technical issues into a professional, business-facing feature overview with categorized items. Use when the user wants release notes, a version summary, a release plan, or a feature overview for a specific version. Triggers on any request mentioning release notes, version summary, release plan, or feature overview.
argument-hint: "[version number]"
---

# JIRA Release Notes Generator

Generate professional, client-facing release notes from Jira version data. Produces a detailed feature-by-feature overview for a single release version with categorized items. Uses the `jira-fetch` script to pull all issue data via REST API in one call — no MCP overhead, no subagents, no token waste.

## Workflow

1. **Initial setup** — Ask language and output format via `AskUserQuestion`
2. **Resolve JIRA project** — Get domain and project key from CLAUDE.md or ask user
3. **Fetch issue data** — Run `jira-fetch` script to get all issues for the version
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

## Resolve JIRA Project (Step 2)

Look for a JIRA configuration block in the project's CLAUDE.md:

```
## JIRA
- Domain: mycompany.atlassian.net
- Project key: PROJ
```

If found, use that domain and project key. If not found, ask via `AskUserQuestion` (header: "JIRA Configuration"):
- Domain (e.g., mycompany.atlassian.net)
- Project key (e.g., PROJ)

Store the resolved `domain`, `projectKey`, and base URL (`https://{domain}`) for the rest of the session. The base URL is needed for clickable task links in the output.

---

## Fetch Issue Data (Step 3)

This single step replaces the old search + subagent extraction pattern. The `jira-fetch` script fetches all issues with full descriptions and comments in one call, returning a minimal JSON file with plaintext data ready for transformation into release notes.

### Locate Script

Find the fetch script via Glob:

```
pattern: **/jira-fetch/scripts/fetch-issues.mjs
```

### Determine Version and Fetch

**If a version was extracted from `$ARGUMENTS`**, run a targeted fetch:

```bash
node "${SCRIPT_PATH}" \
  --domain "${DOMAIN}" \
  --jql "project = ${PROJECT_KEY} AND fixVersion = \"${VERSION}\" ORDER BY priority DESC, issuetype ASC" \
  --output "/tmp/jira-release-notes-${VERSION}-$(date +%Y%m%d-%H%M%S).json"
```

**If no version was provided**, discover available versions first:

```bash
node "${SCRIPT_PATH}" \
  --domain "${DOMAIN}" \
  --jql "project = ${PROJECT_KEY} AND fixVersion IS NOT EMPTY ORDER BY fixVersion DESC" \
  --output "/tmp/jira-release-versions-$(date +%Y%m%d-%H%M%S).json"
```

Read the JSON output and extract unique version names from the `fixVersions` field across all issues. Present discovered versions to the user via `AskUserQuestion` (header: "Version") as selectable options. Allow free text input for a version not in the list.

After the user selects a version, filter the already-fetched data to keep only issues where `fixVersions` includes the selected version. No second fetch needed — the discovery data already contains full issue details.

If the script fails, show the error and stop. Common issues: missing `JIRA_EMAIL` or `JIRA_API_TOKEN` env vars.

### Read and Parse

The JSON output contains per issue: `key`, `type`, `status`, `priority`, `assignee`, `reporter`, `labels`, `fixVersions`, `components`, `summary`, `created`, `updated`, `description` (plaintext), `comments[]` (with `author`, `created`, `body` as plaintext).

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

**Keyword exclusion** — skip issues whose summary contains any of these terms (case-insensitive): `refactor`, `chore`, `cleanup`, `ci/cd`, `pipeline`, `dependency update`, `bump`, `internal`, `tech debt`, `lint`, `formatting`.

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

Confluence publishing requires a `cloudId`. Resolve it now by calling `getAccessibleAtlassianResources` MCP tool — this is the only MCP call in this skill, and only when Confluence output was selected.

Use the available Confluence MCP tools to publish:

- If the user provided an **existing page URL** — update that page with the release notes content
- If no page URL was provided — create a new page titled `[Project] Release Notes — Version X.Y.Z` in the project's Confluence space

If no Confluence MCP tools are found, fall back to markdown output and inform the user.

After publishing, suggest adding a link from the product roadmap page to this release notes page.
