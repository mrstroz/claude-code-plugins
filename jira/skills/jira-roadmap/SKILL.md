---
name: jira-roadmap
description: Generate a condensed project-wide product roadmap from Jira version data. Produces a multi-version overview with theme summaries, highlights, and links to detailed release notes pages. Use when the user wants a product roadmap, project overview, or version overview. Triggers on any request mentioning roadmap, product roadmap, project overview, or version overview.
argument-hint: "[project name or key]"
---

# JIRA Product Roadmap Generator

Generate a professional, client-facing product roadmap from Jira version data. Produces a condensed project-wide overview with version summaries, highlights, and links to individual release notes pages. Uses the `jira-fetch` script to pull issue data via REST API — no MCP overhead, no subagents, no token waste.

## Workflow

1. **Initial setup** — Ask language and output format via `AskUserQuestion`
2. **Resolve JIRA project** — Get domain and project key from CLAUDE.md or ask user
3. **Discover versions and fetch data** — Run `jira-fetch` to discover versions, then fetch per-version data
4. **Check for existing release notes pages** — Find links to detailed release notes
5. **Generate version summaries** — Produce theme, summary, and highlights per version
6. **Compose main roadmap document** — Assemble using the main roadmap format
7. **Present draft for review** — Show the roadmap and ask for confirmation
8. **Output** — Deliver as markdown or publish to Confluence

---

## Initial Setup (Step 1)

Before anything else, use a single `AskUserQuestion` call with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Output format** (header: "Output"): Markdown document | Confluence page

If Confluence output is selected, immediately follow up with one more `AskUserQuestion` (header: "Confluence URL") asking for the target Confluence page URL (the full URL, e.g. `https://mycompany.atlassian.net/wiki/spaces/PROJ/pages/123456`).

If `$ARGUMENTS` contains a project name or key (e.g., `SF`, `ShopFlow`), extract it for use in Step 2 to skip project discovery.

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

## Discover Versions and Fetch Data (Step 3)

This step discovers available versions, lets the user select which ones to include, and then fetches full issue data per version. Uses the `jira-fetch` script for all data retrieval — no MCP tools needed.

### Locate Script

Find the fetch script via Glob:

```
pattern: **/jira-fetch/scripts/fetch-issues.mjs
```

### Discover Versions

Run jira-fetch to get all issues with version assignments:

```bash
node "${SCRIPT_PATH}" \
  --domain "${DOMAIN}" \
  --jql "project = ${PROJECT_KEY} AND fixVersion IS NOT EMPTY ORDER BY fixVersion DESC" \
  --output "/tmp/jira-roadmap-versions-$(date +%Y%m%d-%H%M%S).json"
```

Read the JSON output and extract unique version names from the `fixVersions` field across all issues. Present discovered versions to the user via `AskUserQuestion` (header: "Versions") to confirm which versions to include. Allow the user to deselect versions they want to exclude.

If the script fails, show the error and stop. Common issues: missing `JIRA_EMAIL` or `JIRA_API_TOKEN` env vars.

### Fetch Per-Version Data

The discovery data already contains full issue details. Filter it by each selected version — for each version, extract the subset of issues where `fixVersions` includes that version.

For each selected version, compute aggregate stats:
- **Total issues**: count of all issues
- **By status**: count of Done/In Progress/Planned
- **By type**: count of Epic/Story/Bug/Task
- **Top items**: highest-priority Epics and Stories (for generating highlights)

Descriptions are available directly from the JSON data for the top 5 issues per version (by priority: Epics and Stories first, then remaining by priority descending). Having descriptions available enables accurate client-focused version summaries without subagent extraction.

---

## Check for Existing Release Notes Pages (Step 4)

### If output is Confluence:
- Search Confluence for existing pages matching `[Project] Release Notes — Version {version}` pattern using `searchConfluenceUsingCql`
- Also search for the legacy pattern `[Project] Roadmap — Version {version}` for backward compatibility
- Store found page URLs for linking in the main roadmap

### If output is Markdown:
- Check if files exist at `docs/release-notes/release-notes-{version}.md`
- Also check legacy path `docs/roadmaps/roadmap-{version}.md` for backward compatibility
- Ask the user for path pattern via `AskUserQuestion` (header: "File paths") if not found

## Generate Version Summaries (Step 5)

For each version, produce:

- **Theme Name**: 2-4 words capturing the release theme (e.g., "Checkout & Analytics")
- **Status**: Released / In Progress / Planned (derived from issue status counts)
- **Summary**: 2-3 sentences describing key focus areas and client benefits
- **Highlights**: 3-5 bullet points of the most impactful features (derived from Epics/Stories with highest priority)
- **Link**: URL to release notes page (Confluence) or file path (markdown)

Use descriptions from the JSON data for the top issues to generate theme names, summaries, and highlights — these provide the detail needed for accurate business-value transformation. For issues not among the top 5, use the `summary` field.

Frame every summary and highlight from the client's perspective — what problem does this solve for them? How does it make their work easier or their business better? Every highlight should answer: "What does the client gain from this?"

Apply business-value transformation rules from the writing guidelines in references/format.md (no jargon, active voice, client-benefit focus).

Reference format: [references/format.md](references/format.md)

## Compose Main Roadmap Document (Step 6)

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

## Present Draft for Review (Step 7)

Present the complete roadmap inside a clearly marked block and use `AskUserQuestion` (header: "Review"):

- **Looks good — publish** (Recommended)
- **Adjust summaries** — let me refine the version descriptions
- **Adjust versions** — let me change which versions are included
- **Start over** — discard and begin from scratch

If the user asks for adjustments, apply changes and present the updated draft again. Repeat until the user confirms.

## Output (Step 8)

### Markdown Output

Present the final roadmap in a code block and suggest saving to a file:

> Your roadmap is ready. Want me to save it to `docs/roadmaps/roadmap-main.md`?

If the user confirms, write the file.

### Confluence Output

Confluence publishing requires a `cloudId`. Resolve it now by calling `getAccessibleAtlassianResources` MCP tool — this is the only MCP call in this skill, and only when Confluence output was selected.

Use the available Confluence MCP tools to publish:

- If the user provided an **existing page URL** — update that page with the roadmap content
- If no page URL was provided — create a new page titled `[Project] — Product Roadmap` in the project's Confluence space

Add links to existing release notes pages within each version section. If no Confluence MCP tools are found, fall back to markdown output and inform the user.

After publishing, provide the page URL to the user.
