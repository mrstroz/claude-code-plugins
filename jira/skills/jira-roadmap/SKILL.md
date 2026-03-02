---
name: jira-roadmap
description: Generate a condensed project-wide product roadmap from Jira version data. Produces a multi-version overview with theme summaries, highlights, and links to detailed release notes pages. Use when the user wants a product roadmap, project overview, or version overview. Triggers on any request mentioning roadmap, product roadmap, project overview, or version overview.
argument-hint: "[project name or key]"
---

# JIRA Product Roadmap Generator

Generate a professional, client-facing product roadmap from Jira version data. Produces a condensed project-wide overview with version summaries, highlights, and links to individual release notes pages.

## Workflow

1. **Initial setup** — Ask language and output format via `AskUserQuestion`
2. **Resolve JIRA project** — Auto-discover the project via MCP tools
3. **Discover versions** — Find all versions with issues in the project
4. **Collect version data** — Fetch aggregate stats per version
5. **Check for existing release notes pages** — Find links to detailed release notes
6. **Generate version summaries** — Produce theme, summary, and highlights per version
7. **Compose main roadmap document** — Assemble using the main roadmap format
8. **Present draft for review** — Show the roadmap and ask for confirmation
9. **Output** — Deliver as markdown or publish to Confluence

---

## Initial Setup (Step 1)

Before anything else, use a single `AskUserQuestion` call with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Output format** (header: "Output"): Markdown document | Confluence page

If Confluence output is selected, immediately follow up with one more `AskUserQuestion` (header: "Confluence URL") asking for the target Confluence page URL (the full URL, e.g. `https://mycompany.atlassian.net/wiki/spaces/PROJ/pages/123456`).

Use the selected language for the entire document. Translate section headers according to the translations in the respective format reference file.

## Resolve JIRA Project (Step 2)

Auto-discover the JIRA project — do not ask the user for cloudId or projectKey.

1. Call `getAccessibleAtlassianResources` to get the available cloud instances. Use the first (or only) instance as the cloudId.
2. Call `getVisibleJiraProjects` to list all projects in the instance.
3. If only one project exists, use it automatically.
4. If multiple projects exist, pick the most likely match based on context (Confluence page content if available) or present them via `AskUserQuestion` (header: "Project").

Store the resolved cloudId and projectKey for the rest of the session.

---

## Discover Versions (Step 3)

Use JQL to find all versions with issues in the project:

```
project = {projectKey} ORDER BY fixVersion DESC
fields: ["summary", "status", "fixVersion"]
```

Extract unique `fixVersion` values from the results. Present them to the user via `AskUserQuestion` (header: "Versions") to confirm which versions to include. Allow the user to deselect versions they want to exclude.

## Collect Version Data (Step 4)

For each selected version, run a single optimized JQL query:

```
project = {projectKey} AND fixVersion = "{version}" ORDER BY priority DESC
fields: ["summary", "status", "issuetype", "priority"]
```

Collect aggregate stats per version:
- **Total issues**: count of all issues
- **By status**: count of Done/In Progress/Planned
- **By type**: count of Epic/Story/Bug/Task
- **Top items**: highest-priority Epics and Stories (for generating highlights)

## Check for Existing Release Notes Pages (Step 5)

### If output is Confluence:
- Search Confluence for existing pages matching `[Project] Release Notes — Version {version}` pattern using `searchConfluenceUsingCql`
- Also search for the legacy pattern `[Project] Roadmap — Version {version}` for backward compatibility
- Store found page URLs for linking in the main roadmap

### If output is Markdown:
- Check if files exist at `docs/release-notes/release-notes-{version}.md`
- Also check legacy path `docs/roadmaps/roadmap-{version}.md` for backward compatibility
- Ask the user for path pattern via `AskUserQuestion` (header: "File paths") if not found

## Generate Version Summaries (Step 6)

For each version, produce:

- **Theme Name**: 2-4 words capturing the release theme (e.g., "Checkout & Analytics")
- **Status**: Released / In Progress / Planned (derived from issue status counts)
- **Summary**: 2-3 sentences describing key focus areas and business value
- **Highlights**: 3-5 bullet points of the most impactful features (derived from Epics/Stories with highest priority)
- **Link**: URL to release notes page (Confluence) or file path (markdown)

Use same business-value transformation rules as single version (no jargon, active voice, user-outcome focus).

Reference format: [references/format.md](references/format.md)

## Compose Main Roadmap Document (Step 7)

Assemble the document following the structure in [references/format.md](references/format.md):

```markdown
# [Project] — Product Roadmap

## Overview
[2-3 sentences about overall product direction and strategy]

---

## Version X.Y.Z — [Theme Name]
**Status:** In Progress | **Target:** Q1 2026

[2-3 sentence summary]

**Highlights:**
- Highlight 1
- Highlight 2
- Highlight 3

[→ Release notes](link)
```

**Version ordering**: most recent/current version first, then upcoming, then past releases.

Full example: [references/example.md](references/example.md)

## Present Draft for Review (Step 8)

Present the complete roadmap inside a clearly marked block and use `AskUserQuestion` (header: "Review"):

- **Looks good — publish** (Recommended)
- **Adjust summaries** — let me refine the version descriptions
- **Adjust versions** — let me change which versions are included
- **Start over** — discard and begin from scratch

If the user asks for adjustments, apply changes and present the updated draft again. Repeat until the user confirms.

## Output (Step 9)

### Markdown Output

Present the final roadmap in a code block and suggest saving to a file:

> Your roadmap is ready. Want me to save it to `docs/roadmaps/roadmap-main.md`?

If the user confirms, write the file.

### Confluence Output

Use the available Confluence MCP tools to publish:

- If the user provided an **existing page URL** — update that page with the roadmap content
- If no page URL was provided — create a new page titled `[Project] — Product Roadmap` in the project's Confluence space

Add links to existing release notes pages within each version section. If no Confluence MCP tools are found, fall back to markdown output and inform the user.

After publishing, provide the page URL to the user.
