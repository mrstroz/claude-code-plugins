# Release Notes Format

Reference document defining the structure, formatting rules, and writing guidelines for per-version release notes.

> This format is for release notes covering a specific version. For the project-wide overview, see the `jira-roadmap` skill.

## Document Structure

```
# [Project Name] Release Notes — Version X.Y.Z
**Release:** X.Y.Z | **Target:** Q1 2026 | **Status:** In Progress

## Executive Summary
[2-3 sentences highlighting how this release improves the client's experience and business outcomes.]

## Features

### [Category Name]
- [x] **TASK-101 — Feature Name.** Summary sentence one. Summary sentence two.
- [~] **TASK-205 — Feature Name.** Summary sentence one. Summary sentence two.
- [ ] **TASK-318 — Feature Name.** Summary sentence one. Summary sentence two.

### [Category Name]
- [x] **TASK-401 — Feature Name.** Summary sentence one. Summary sentence two.
- [~] **TASK-502 — Feature Name.** Summary sentence one. Summary sentence two.

## Bug Fixes
- [x] **TASK-601 — Fix Name.** What was broken. What now works correctly.
- [x] **TASK-602 — Fix Name.** What was broken. What now works correctly.
- [~] **TASK-603 — Fix Name.** What was broken. What is being resolved.

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

## Bug Fixes Section

The **Bug Fixes** section is a dedicated, standalone section placed after Features and before Key Metrics & Impact. Bug and Hotfix issues are never mixed into the feature categories.

### Bug Fix Entry Format

```
[status] **TASK-KEY — Fix Name.** What was broken. What now works correctly.
```

| Element | Description |
|---------|-------------|
| **Status** | Status indicator prefix (same as features) |
| **Task Key** | Jira issue key (e.g. PROJ-601) |
| **Fix Name** | 3-8 words, title case, describes what was fixed |
| **Summary** | 2 sentences: first describes the problem, second describes the resolution. Max 40 words. |

### Bug Fix Writing Guidelines

- Describe the **user-visible symptom**, not the technical root cause
- First sentence: what was broken (past tense)
- Second sentence: what now works correctly (present tense)
- "Fixed null pointer in OrderService" → "Orders occasionally failed during checkout when applying discount codes. Checkout now completes reliably with all discount types."
- If the version has more than 8 bug fixes, group minor ones as "Additional fixes" with a count

## Categorization Rules

- Target **3-7 categories** per release notes document (for the Features section)
- Each category must have **at least 2 items**
- Each category should have **no more than 10 items**
- Merge categories with fewer than 2 items into the nearest thematic match
- Category names should be business-domain terms, not technical labels
- Order categories by impact: highest-value categories first

## Writing Guidelines

- **Client-benefit focus** — every summary should answer: "What does the client gain from this?" Describe how features solve client problems, make their work easier, or improve their business outcomes
- **No jargon** — replace technical terms with user-facing outcomes
- **Active voice** — "Users can now filter by date" not "Date filtering has been implemented"
- **Confident tone** — no hedging words ("might", "should", "could possibly")
- **Consistent tense** — Done items in past/present, In Progress in present, Planned in future
- **No internal references** — remove story points, sprint names, assignees, component names

### Client-Benefit Transformation Examples

| Technical Description | Client-Benefit Summary |
|-----------------------|------------------|
| Implemented Redis caching layer | Your pages load faster, saving time on every interaction |
| Added composite database index on orders table | Find what you need instantly — search results appear without delay |
| Migrated auth to OAuth 2.0 with PKCE | Sign in more securely with single sign-on across all your tools |
| Refactored PDF generation to async queue | Generate reports in the background and keep working — no more waiting |
| Added WebSocket support for notifications | Stay informed in real time without refreshing the page |
| Added bulk import for product catalog | Upload your entire catalog at once instead of adding items one by one |

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
| Release Notes | Release Notes | Notas de la versión | Informacje o wydaniu | Versionshinweise |
| Executive Summary | Executive Summary | Resumen ejecutivo | Podsumowanie | Zusammenfassung |
| Features | Features | Funcionalidades | Funkcjonalności | Funktionen |
| Bug Fixes | Bug Fixes | Correcciones de errores | Poprawki błędów | Fehlerbehebungen |
| Key Metrics & Impact | Key Metrics & Impact | Métricas clave e impacto | Kluczowe wskaźniki i wpływ | Kennzahlen & Auswirkungen |
| Done | Done | Completado | Gotowe | Fertig |
| In Progress | In Progress | En progreso | W trakcie | In Bearbeitung |
| Planned | Planned | Planificado | Planowane | Geplant |
