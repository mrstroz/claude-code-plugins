# Main Roadmap Document Format

Reference document defining the structure, formatting rules, and writing guidelines for project-wide roadmaps that provide a condensed overview of all versions.

> For detailed per-version release notes with feature lists, see the `jira-release-notes` skill.

## Document Structure

```
# [Project Name] — Product Roadmap

## Overview
[2-3 sentences about overall product direction and strategy.]

---

## Version X.Y.Z — [Theme Name]
**Status:** Released | **Date:** Q4 2025

[2-3 sentence summary of key focus areas and business value.]

**Highlights:**
- Highlight 1
- Highlight 2
- Highlight 3

[→ Release notes](link-to-release-notes-page)

---

## Version X.Y+1.0 — [Theme Name]
**Status:** In Progress | **Target:** Q1 2026

[2-3 sentence summary]

**Highlights:**
- Highlight 1
- Highlight 2
- Highlight 3

[→ Release notes](link-to-release-notes-page)

---

## Version X.Y+2.0 — [Theme Name]
**Status:** Planned | **Target:** Q2 2026

[2-3 sentence summary]

**Highlights:**
- Highlight 1
- Highlight 2
- Highlight 3

[→ Release notes](link-to-release-notes-page)
```

## Version Card Format

Each version section contains:

| Element | Description |
|---------|-------------|
| **Theme Name** | 2-4 words capturing the release theme (e.g., "Checkout & Analytics") |
| **Status Badge** | One of: Released, In Progress, Planned (see below) |
| **Date** | Quarter or date — "Date" for released versions, "Target" for upcoming |
| **Summary** | 2-3 sentences describing key focus areas and business value |
| **Highlights** | 3-5 bullet points of the most impactful features |
| **Link** | Link to the detailed release notes page |

## Status Badges

| Badge | Meaning | Derivation |
|-------|---------|------------|
| **Released** | All or nearly all issues are Done/Closed | >90% of issues in Done/Closed/Resolved status |
| **In Progress** | Work is actively underway | Mix of Done and In Progress issues |
| **Planned** | Work has not started yet | Most issues in To Do/Open/Backlog status |

## Writing Guidelines

- **Condensed** — max 3 sentences per version summary, max 5 highlights
- **Business value** — describe what users and stakeholders gain, not technical implementation
- **Active voice** — "Merchants can now track revenue in real time" not "Real-time revenue tracking was implemented"
- **No jargon** — replace technical terms with user-facing outcomes
- **Confident tone** — no hedging words ("might", "should", "could possibly")
- **No internal references** — remove story points, sprint names, assignees, component names
- **Highlights from top priorities** — derive from Epics/Stories with highest priority

### Summary Transformation

| Technical | Business Summary |
|-----------|------------------|
| Implemented caching + DB indexes | Faster page loads and instant search results |
| Migrated to OAuth 2.0 with PKCE flow | More secure sign-in with single sign-on support |
| Added WebSocket notifications + async PDF | Real-time updates and background report generation |

## Version Ordering

- **Default**: Most recent/current version first, then upcoming, then past releases
- Versions within the same status group are ordered by version number (descending)

## Cross-Linking

### From Main Roadmap → Release Notes
Use a link at the end of each version card:
```markdown
[→ Release notes](link)
```

### From Release Notes → Main Roadmap
Add a back-link at the bottom of each release notes page:
```markdown
[← Back to Product Roadmap](link)
```

### Link Formats
- **Confluence**: Use the full page URL (e.g., `https://mycompany.atlassian.net/wiki/spaces/PROJ/pages/123456`)
- **Markdown**: Use relative file paths (e.g., `release-notes-4.2.0.md`, `roadmap-main.md`)

## Section Header Translations

| Section | EN | ES | PL | DE |
|---------|----|----|----|----|
| Product Roadmap | Product Roadmap | Hoja de ruta del producto | Mapa drogowa produktu | Produkt-Roadmap |
| Overview | Overview | Vision general | Przeglad | Uberblick |
| Released | Released | Publicado | Wydane | Veroffentlicht |
| In Progress | In Progress | En progreso | W trakcie | In Bearbeitung |
| Planned | Planned | Planificado | Planowane | Geplant |
| Release notes | Release notes | Notas de la version | Informacje o wydaniu | Versionshinweise |
| Highlights | Highlights | Aspectos destacados | Najwazniejsze zmiany | Highlights |
