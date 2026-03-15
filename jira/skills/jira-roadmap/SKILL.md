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
4. **Collect version data** — Fetch aggregate stats per version (lightweight metadata only)
5. **Extract top issue data** — Fetch and condense descriptions for top issues via subagents
6. **Check for existing release notes pages** — Find links to detailed release notes
7. **Generate version summaries** — Produce theme, summary, and highlights per version
8. **Compose main roadmap document** — Assemble using the main roadmap format
9. **Present draft for review** — Show the roadmap and ask for confirmation
10. **Output** — Deliver as markdown or publish to Confluence

---

## Initial Setup (Step 1)

Before anything else, use a single `AskUserQuestion` call with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Output format** (header: "Output"): Markdown document | Confluence page

If Confluence output is selected, immediately follow up with one more `AskUserQuestion` (header: "Confluence URL") asking for the target Confluence page URL (the full URL, e.g. `https://mycompany.atlassian.net/wiki/spaces/PROJ/pages/123456`).

If `$ARGUMENTS` contains a project name or key (e.g., `SF`, `ShopFlow`), extract it for use in Step 2 to skip project discovery.

Use the selected language for the entire document. Translate section headers according to the translations in the respective format reference file.

## Resolve JIRA Project (Step 2)

Auto-discover the JIRA project — do not ask the user for cloudId or projectKey.

1. Call `getAccessibleAtlassianResources` to get the available cloud instances. Use the first (or only) instance as the cloudId.
2. Call `getVisibleJiraProjects` to list all projects in the instance.
3. If a project name or key was extracted from `$ARGUMENTS`, match it against the project list and use it directly. If no match is found, fall through to the steps below.
4. If only one project exists, use it automatically.
5. If multiple projects exist, pick the most likely match based on context (Confluence page content if available) or present them via `AskUserQuestion` (header: "Project").

Store the resolved cloudId and projectKey for the rest of the session.

---

## Discover Versions (Step 3)

Use JQL to find all versions with issues in the project:

```
project = {projectKey} AND fixVersion IS NOT EMPTY ORDER BY fixVersion DESC
fields: ["summary", "fixVersion"]
maxResults: 100
```

If more than 100 issues exist, use the `nextPageToken` to paginate through all results.

Extract unique `fixVersion` values from the results. Present them to the user via `AskUserQuestion` (header: "Versions") to confirm which versions to include. Allow the user to deselect versions they want to exclude.

## Collect Version Data (Step 4)

For each selected version, run a single optimized JQL query with lightweight metadata fields only. Do not request `description` here — on versions with many issues the combined payload can exceed MCP size limits.

```
project = {projectKey} AND fixVersion = "{version}" ORDER BY priority DESC
fields: ["summary", "status", "issuetype", "priority"]
maxResults: 100
```

If more than 100 issues exist, use the `nextPageToken` to paginate through all results.

Collect aggregate stats per version:
- **Total issues**: count of all issues
- **By status**: count of Done/In Progress/Planned
- **By type**: count of Epic/Story/Bug/Task
- **Top items**: highest-priority Epics and Stories (for generating highlights)

## Extract Top Issue Data via Subagents (Step 5)

Step 4 only fetched lightweight metadata. To generate accurate, client-focused version summaries, fetch descriptions for the most impactful issues. Instead of fetching them into the main context, delegate extraction to subagents that return condensed goal summaries.

### Issue Selection

For each version, select the **top 5 issues** by priority:
1. Epics and Stories first (highest priority)
2. Remaining issues by priority descending
3. If a version has 3 or fewer issues total, select all of them

Pool all selected issues across all versions into a single flat list for batching (e.g., 6 versions x 5 issues = 30 issues).

### Subagent Extraction

Follow the orchestration pattern in [extraction pattern](../_shared/extraction-pattern.md) to batch the pooled issue keys and spawn `jira:issue-extractor` subagents.

Use this skill-specific extraction template in each agent prompt:

```
Fields to fetch: ["description"]

For each issue, determine the goal or purpose — what it achieves for the end user.
Frame from the client's perspective: what problem does this solve? How does it make their work easier?

Return format (one line per issue):
{KEY}: {one-sentence goal summary focused on business value}
```

### Using Extracted Data

The subagents return condensed goal summaries — one line per issue. Re-group these by version using the version metadata from Step 4. Use the condensed summaries in Step 7 to derive theme names, version summaries, and highlights. Issues not selected for extraction are summarized from the `summary` field collected in Step 4.

## Check for Existing Release Notes Pages (Step 6)

### If output is Confluence:
- Search Confluence for existing pages matching `[Project] Release Notes — Version {version}` pattern using `searchConfluenceUsingCql`
- Also search for the legacy pattern `[Project] Roadmap — Version {version}` for backward compatibility
- Store found page URLs for linking in the main roadmap

### If output is Markdown:
- Check if files exist at `docs/release-notes/release-notes-{version}.md`
- Also check legacy path `docs/roadmaps/roadmap-{version}.md` for backward compatibility
- Ask the user for path pattern via `AskUserQuestion` (header: "File paths") if not found

## Generate Version Summaries (Step 7)

For each version, produce:

- **Theme Name**: 2-4 words capturing the release theme (e.g., "Checkout & Analytics")
- **Status**: Released / In Progress / Planned (derived from issue status counts)
- **Summary**: 2-3 sentences describing key focus areas and client benefits
- **Highlights**: 3-5 bullet points of the most impactful features (derived from Epics/Stories with highest priority)
- **Link**: URL to release notes page (Confluence) or file path (markdown)

Prioritize the condensed goal summaries extracted in Step 5 for generating theme names, summaries, and highlights — these provide the detail needed for accurate business-value transformation. For issues not extracted individually, use the `summary` field from Step 4.

Frame every summary and highlight from the client's perspective — what problem does this solve for them? How does it make their work easier or their business better? Every highlight should answer: "What does the client gain from this?"

Apply business-value transformation rules from the writing guidelines in references/format.md (no jargon, active voice, client-benefit focus).

Reference format: [references/format.md](references/format.md)

## Compose Main Roadmap Document (Step 8)

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

## Present Draft for Review (Step 9)

Present the complete roadmap inside a clearly marked block and use `AskUserQuestion` (header: "Review"):

- **Looks good — publish** (Recommended)
- **Adjust summaries** — let me refine the version descriptions
- **Adjust versions** — let me change which versions are included
- **Start over** — discard and begin from scratch

If the user asks for adjustments, apply changes and present the updated draft again. Repeat until the user confirms.

## Output (Step 10)

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
