# Testing Scenarios Format

Reference document defining the structure, formatting rules, and writing guidelines for release testing scenarios.

## Document Structure

```
# [Project Name] Testing Scenarios — Version X.Y.Z
**Version:** X.Y.Z | **Branches:** quality vs master | **Generated:** 2026-03-09

## Summary
{X} tasks to test | {Y} files changed | {Z} uncovered changes

## Testing Scenarios

| Task | Testing Scenario |
|------|-----------------|
| [PROJ-101](url) | **Feature title** |
| Story · High · In Progress | Scenario description with bullet points. |
| [PROJ-205](url) | **Bug fix title** |
| Bug · Major · Done | Scenario description with bullet points. |

## High Risk Areas *(if applicable)*
- **Frontend / UI** — 12 files changed across 3 components. Pay extra attention to layout and responsiveness.
- **Database** — migration added. Verify data integrity after migration.

## Uncovered Changes *(if applicable)*
- **Configuration** — `docker-compose.yml`, `.env.example` updated. Verify deployment configuration is correct.
- **Other** — `README.md`, `package.json` changed. Likely safe but worth a glance.
```

## Table Format

The main testing scenarios table uses two columns. Each task occupies **two rows** — a header row and a detail row:

| Row | Task column | Testing Scenario column |
|-----|-------------|------------------------|
| **Header** | Clickable JIRA link — `[PROJ-123](https://{cloudBaseUrl}/browse/PROJ-123)` | **Bold title** — issue summary in bold, truncated with `...` if over 50 characters |
| **Detail** | `{Type} · {Priority} · {Status}` — e.g., `Story · High · In Progress` | Descriptive scenario — what changed, what to verify, edge cases. Max 60 words. Use `•` for inline bullets. |

### Inline Bullet Format

Use `•` (bullet character) to separate testing points within a single table cell:

```
Verify that the new filter works with all date formats. • Check edge cases: empty range, future dates. • Confirm saved filters still load correctly.
```

## Scenario Writing Rules

- **Descriptive, not procedural** — describe what to verify, not step-by-step instructions
- **User perspective** — frame scenarios from the end user's point of view
- **Include edge cases** — mention boundary conditions and error states worth checking
- **Risk-aware** — if many files changed, note the breadth of impact
- **Concise** — max 60 words per scenario, 2-3 bullet points

### Good Scenario Examples

| Style | Example |
|-------|---------|
| Feature | Verify that the new bulk import processes CSV files correctly. • Check validation errors for malformed rows. • Confirm large files (1000+ rows) complete without timeout. |
| Bug fix | Confirm that checkout no longer fails when applying discount codes. • Test with percentage and fixed-amount discounts. • Verify order total calculates correctly. |
| UI change | Check that the redesigned dashboard loads all widgets correctly. • Verify responsive layout on mobile and tablet. • Confirm that user preferences persist after the update. |

### Bad Scenario Examples (avoid)

- Step-by-step click instructions: "1. Open page 2. Click button 3. Enter value..."
- Too vague: "Test the feature" or "Make sure it works"
- Too technical: "Verify the Redis cache invalidation triggers on entity update events"

## High Risk Areas Section

Include this section when git analysis reveals concentrated changes. Flag areas where:
- A single directory has 5+ files changed
- A single file has 100+ lines changed
- New database migrations are present
- Configuration or infrastructure files changed

Format each entry as:
```
- **{Area Name}** — {count} files changed. {One sentence about what to watch for.}
```

## Uncovered Changes Section

Include this section when git diff contains changed files not matched to any Jira issue. Group by area and list the files:

```
- **{Area Name}** — `file1.ts`, `file2.ts` changed. {Brief note on potential impact.}
```

This section exists as a safety net — it flags code changes that might otherwise go untested because no Jira task describes them.

## Condensation Rules

When a version has **more than 20 tasks**:

- Show individual row pairs only for Epic, Story, Feature, and Major+ priority bugs
- Group remaining tasks into a summary row pair:
  ```
  | — | **{count} additional minor changes** |
  | Minor tasks | Routine fixes and minor adjustments across {areas}. Spot-check for regressions. |
  ```
- Limit each scenario to 1-2 sentences (max 40 words)
- Target no more than 25 visible row pairs total

## Section Header Translations

| Section | EN | ES | PL | DE |
|---------|----|----|----|----|
| Testing Scenarios | Testing Scenarios | Escenarios de prueba | Scenariusze testowe | Testszenarien |
| Summary | Summary | Resumen | Podsumowanie | Zusammenfassung |
| High Risk Areas | High Risk Areas | Áreas de alto riesgo | Obszary wysokiego ryzyka | Hochrisikobereiche |
| Uncovered Changes | Uncovered Changes | Cambios sin cobertura | Niezakryte zmiany | Nicht abgedeckte Änderungen |
| Task | Task | Tarea | Zadanie | Aufgabe |
| Testing Scenario | Testing Scenario | Escenario de prueba | Scenariusz testowy | Testszenario |
