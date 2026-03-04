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
| Task |   | Ver | Assignee | Status | Title | Summary |
|------|---|-----|----------|--------|-------|---------|
| [PROJ-123](https://{cloudBaseUrl}/browse/PROJ-123) | A | 2.1.0 | Jan | 🔵 In Progress | Fix payment timeout | Blocker since yesterday — Anna and Piotr on QA are blocked on checkout testing, waiting for your hotfix. Deploy to staging so QA can resume. |

## Ready to Proceed ({count})
| Task |   | Ver | Assignee | Status | Title | Summary |
|------|---|-----|----------|--------|-------|---------|

## Info ({count})
| Task |   | Ver | Assignee | Status | Title | Summary |
|------|---|-----|----------|--------|-------|---------|
```

---

## Table Column Definitions

| Column | Content | Format |
|--------|---------|--------|
| Task | Clickable JIRA link | `[PROJ-123](https://{cloudBaseUrl}/browse/PROJ-123)` |
|   | Priority letter | Single character: A, B, C, D, or E |
| Ver | Fix version | `{fixVersion}` or `—` if missing |
| Assignee | Person assigned | First name |
| Status | Current status | Color emoji + status name: ⚪ for To Do, 🔵 for in-progress, 🟢 for done |
| Title | Issue summary | Truncate with `...` if over 70 characters |
| Summary | Situation + proposed action | ~30-50 words (see writing rules below) |

---

## Summary Column Writing Rules

The Summary column is the most valuable part of the table — it tells the user what is happening and what to do next. Structure each summary as:

**`{situation with actors}. {proposed action}.`**

- **Situation with actors**: what happened, naming specific people and who-to-whom dynamics (1-2 sentences)
- **Proposed action**: a concrete next step the user should take (1 sentence)

Always name specific people rather than using passive voice — passive hides directionality and makes it unclear who is waiting on whom. Write "Maria asked Jan to review" not "a review was requested".

Keep summaries factual and actionable. Do not hedge with "maybe" or "consider" — state what should be done.

### Transformation Examples

| Triage Group | Raw JIRA Data | Summary |
|-------------|---------------|---------|
| Action Needed | Blocker priority, 2 comments asking for fix, QA team mentioned | Blocker since yesterday — Anna and Piotr on the QA team are blocked on checkout regression testing, waiting for your hotfix. Deploy fix branch to staging so QA can resume. |
| Action Needed | Comment: "@me can you review the rate limit config?" | Maria asked you to review the rate limit config changes 2h ago in comments. She needs your sign-off before merging to main. Review and respond. |
| Ready to Proceed | Status: In Review, code review approved | Jan approved your code review on the mobile optimization PR. No blockers remain. Merge to main and deploy to staging. |
| Ready to Proceed | Status: Done in QA, bug fix verified | Anna verified the CSV date formatting fix in QA — all test cases pass. Move to Done and schedule for next production deploy. |
| Info | Comment: "@jan can you review this", task not assigned to me | Maria asked Jan to review the search indexing changes. Not directed at you — Jan is the reviewer. No action needed. |
| Info | Teammate pushed UI fixes, normal progress | Maria pushed storefront UI fixes for the product grid layout. On track for 4.2.0 release, no action needed from you. |
| Info | Task assigned to me, outside my domain | PCI compliance review assigned to you but Anna on the security team has more context. Consider reassigning to Anna. |

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
- Summarize C/D/E items as a single row: `| — | C-E | — | — | — | {count} additional tasks | No immediate action required. |`
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
| Ver | Ver | Ver | Ver | Ver |
| Assignee | Assignee | Responsable | Osoba | Zuständig |
| Status | Status | Estado | Status | Status |
| Title | Title | Título | Tytuł | Titel |
| Summary | Summary | Resumen | Podsumowanie | Zusammenfassung |
