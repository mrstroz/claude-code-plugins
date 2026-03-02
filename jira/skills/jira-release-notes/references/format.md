# Release Notes Format

Reference document defining the structure, formatting rules, and writing guidelines for per-version release notes.

> This format is for release notes covering a specific version. For the project-wide overview, see the `jira-roadmap` skill.

## Document Structure

```
# [Project Name] Release Notes — Version X.Y.Z
**Release:** X.Y.Z | **Target:** Q1 2026 | **Status:** In Progress

## Executive Summary
[2-3 sentences describing the release theme and key benefits for end users.]

## Features

### [Category Name]
- [x] **TASK-101 — Feature Name.** Summary sentence one. Summary sentence two.
- [~] **TASK-205 — Feature Name.** Summary sentence one. Summary sentence two.
- [ ] **TASK-318 — Feature Name.** Summary sentence one. Summary sentence two.

### [Category Name]
- [x] **TASK-401 — Feature Name.** Summary sentence one. Summary sentence two.
- [~] **TASK-502 — Feature Name.** Summary sentence one. Summary sentence two.

## Key Metrics & Impact *(optional)*
[Brief section highlighting measurable improvements, e.g., performance gains, new capabilities count.]
```

## Feature List Format

Each category contains a bulleted list. Each item follows this format:

```
[status] **TASK-KEY — Feature Name.** Summary sentence one. Summary sentence two.
```

| Element | Description |
|---------|-------------|
| **Status** | Status indicator prefix (see below) |
| **Task Key** | Jira issue key (e.g. PROJ-142) |
| **Feature Name** | 3-8 words, title case, no technical jargon |
| **Summary** | 2 sentences, user-outcome focused, max 40 words |

## Status Indicators

| Indicator | Meaning | Mapping |
|-----------|---------|---------|
| `[x]` Done | Feature is complete and verified | Jira status: Done, Closed, Resolved |
| `[~]` In Progress | Feature is actively being worked on | Jira status: In Progress, In Review, Testing |
| `[ ]` Planned | Feature is scoped but not yet started | Jira status: To Do, Open, Backlog |

## Categorization Rules

- Target **3-7 categories** per release notes document
- Each category must have **at least 2 items**
- Each category should have **no more than 10 items**
- Merge categories with fewer than 2 items into the nearest thematic match
- Category names should be business-domain terms, not technical labels
- Order categories by impact: highest-value categories first

## Writing Guidelines

- **No jargon** — replace technical terms with user-facing outcomes
- **Active voice** — "Users can now filter by date" not "Date filtering has been implemented"
- **User-outcome focus** — describe what the user gains, not what was built
- **Confident tone** — no hedging words ("might", "should", "could possibly")
- **Consistent tense** — Done items in past/present, In Progress in present, Planned in future
- **No internal references** — remove story points, sprint names, assignees, component names

### Transformation Examples

| Technical Description | Business Summary |
|-----------------------|------------------|
| Implemented Redis caching layer | Faster loading times across the application |
| Added composite database index on orders table | Search results appear instantly |
| Migrated auth to OAuth 2.0 with PKCE | More secure sign-in with single sign-on support |
| Refactored PDF generation to async queue | Reports generate in the background without blocking your work |
| Added WebSocket support for notifications | Real-time notifications without refreshing the page |

## Condensation Rules

When a version has **more than 20 features**:

- Limit each summary to **1 sentence** (max 20 words)
- Merge minor features into grouped items (e.g., "Multiple usability improvements across dashboard views")
- Keep the total visible items under 25

When a category has **more than 10 items**:

- Show the top 8 individually
- Group remaining items as "Additional improvements" with a count

## Section Header Translations

| Section | EN | ES | PL | DE |
|---------|----|----|----|----|
| Release Notes | Release Notes | Notas de la version | Informacje o wydaniu | Versionshinweise |
| Executive Summary | Executive Summary | Resumen ejecutivo | Podsumowanie | Zusammenfassung |
| Features | Features | Funcionalidades | Funkcjonalnosci | Funktionen |
| Key Metrics & Impact | Key Metrics & Impact | Metricas clave e impacto | Kluczowe wskazniki i wplyw | Kennzahlen & Auswirkungen |
| Done | Done | Completado | Gotowe | Fertig |
| In Progress | In Progress | En progreso | W trakcie | In Bearbeitung |
| Planned | Planned | Planificado | Planowane | Geplant |
