# Daily Summary Format

This defines the table structure, column rules, and writing guidelines for the daily summary output.

---

## Document Structure

```markdown
# Daily JIRA Summary — {YYYY-MM-DD}
**Project:** {projectKey} | **Time frame:** {selected option} | **Tasks:** {total count}

## Overview
{2-4 sentences: counts per group, overall focus recommendation}

## Action Needed ({count})
| Task |   | Info | Title | Summary |
|------|---|------|-------|---------|
| [PROJ-123](https://{cloudBaseUrl}/browse/PROJ-123) | A | 2.1.0 · Jan · 🔵 In Progress | Fix payment timeout | Blocker — team waiting on hotfix. Deploy to staging for QA. |

## Ready to Proceed ({count})
| Task |   | Info | Title | Summary |
|------|---|------|-------|---------|

## Info ({count})
| Task |   | Info | Title | Summary |
|------|---|------|-------|---------|
```

---

## Table Column Definitions

| Column | Content | Format |
|--------|---------|--------|
| Task | Clickable JIRA link | `[PROJ-123](https://{cloudBaseUrl}/browse/PROJ-123)` |
|   | Priority letter | Single character: A, B, C, D, or E |
| Info | Release + assignee + status | `{fixVersion} · {assignee} · {status}` with status color: ⚪ for To Do, 🔵 for in-progress, 🟢 for done |
| Title | Issue summary | Truncate with `...` if over 70 characters |
| Summary | Situation + proposed action | ~20-30 words (see writing rules below) |

---

## Summary Column Writing Rules

The Summary column is the most valuable part of the table — it tells the user what is happening and what to do next. Structure each summary as:

**`{situation}. {proposed action}.`**

- **Situation**: what happened or what state the task is in (1 sentence)
- **Proposed action**: a concrete next step the user should take (1 sentence)

Keep summaries factual and actionable. Do not hedge with "maybe" or "consider" — state what should be done.

### Transformation Examples

| Triage Group | Raw JIRA Data | Summary |
|-------------|---------------|---------|
| Action Needed | Blocker priority, 2 comments asking for fix, QA team mentioned | Blocker since yesterday — QA blocked on checkout testing. Deploy hotfix to staging. |
| Action Needed | Comment: "@me can you review the rate limit config?" | Maria asked for rate limit config review 2h ago. Review and respond. |
| Ready to Proceed | Status: In Review, code review approved | Code review approved by Jan. Merge to main and deploy to staging. |
| Ready to Proceed | Status: Done in QA, bug fix verified | Fix verified in QA. Move to Done and schedule for next production deploy. |
| Info | Teammate pushed UI fixes, normal progress | Maria pushed UI fixes for the storefront. On track, no action needed. |
| Info | Task assigned to me, outside my domain | Compliance review assigned to you but better suited for security team. Consider reassigning. |

---

## Overview Section Writing Rules

The Overview section gives a quick morning-briefing snapshot. Follow these rules:

- **First sentence**: raw counts per group (e.g., "You have 2 tasks needing immediate action, 4 ready to proceed, and 5 informational updates.")
- **Second sentence**: focus recommendation — what the user should tackle first and why
- If there are A-classified items in Action Needed, call them out by task key explicitly
- Keep to 2-4 sentences total
- Tone: helpful morning briefing, not a robotic status report

---

## Condensation Rules

For large result sets, keep the output scannable:

- If any group has **more than 15 tasks**, show individual rows only for A and B items
- Summarize C/D/E items as a single row: `| — | C-E | — | {count} additional tasks | No immediate action required. |`
- If the total summary exceeds **80 table rows** across all groups, apply condensation to Info first, then Ready to Proceed
- Action Needed is never condensed — every item there deserves individual attention

---

## Section Header Translations

Use the selected language for all section headers. Translate using this table:

| Section | EN | ES | PL | DE |
|---------|----|----|----|----|
| Daily JIRA Summary | Daily JIRA Summary | Resumen diario de JIRA | Podsumowanie dzienne JIRA | JIRA-Tageszusammenfassung |
| Overview | Overview | Resumen | Przegląd | Überblick |
| Action Needed | Action Needed | Acción necesaria | Wymagane działanie | Handlungsbedarf |
| Ready to Proceed | Ready to Proceed | Listo para avanzar | Gotowe do realizacji | Bereit zum Fortfahren |
| Info | Info | Información | Informacje | Info |
| Task | Task | Tarea | Zadanie | Aufgabe |
| (empty) | (empty) | (empty) | (empty) | (empty) |
| Info | Info | Info | Info | Info |
| Title | Title | Título | Tytuł | Titel |
| Summary | Summary | Resumen | Podsumowanie | Zusammenfassung |
