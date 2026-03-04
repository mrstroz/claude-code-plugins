# Example: Daily Summary

**Project:** ShopFlow (e-commerce SaaS platform)
**Jira project key:** SF
**Time frame:** Active sprint tasks assigned to me
**Language:** English

---

## Generated Output

# Daily JIRA Summary — 2026-03-04
**Project:** SF | **Time frame:** Active sprint | **Tasks:** 11

## Overview

You have 2 tasks needing immediate action, 4 tasks ready to proceed, and 5 informational updates. Focus first on SF-234 (payment timeout blocker — QA team is blocked) and SF-289 (Maria is waiting for your API review) before moving to the code reviews in Ready to Proceed.

## Action Needed (2)

| Task | ABCDE | Release | Title | Summary |
|------|-------|---------|-------|---------|
| [SF-234](https://shopflow.atlassian.net/browse/SF-234) | A | 4.2.0 | Fix payment callback timeout | Blocker since yesterday — QA team blocked on checkout testing. Deploy hotfix to staging. |
| [SF-289](https://shopflow.atlassian.net/browse/SF-289) | B | 4.2.0 | Order API rate limiting | Maria asked for review of rate limit config in comments 2h ago. Review and respond. |

## Ready to Proceed (4)

| Task | ABCDE | Release | Title | Summary |
|------|-------|---------|-------|---------|
| [SF-301](https://shopflow.atlassian.net/browse/SF-301) | B | 4.2.0 | Mobile storefront optimization | Code review approved by Jan. Merge to main and deploy to staging. |
| [SF-315](https://shopflow.atlassian.net/browse/SF-315) | B | 4.2.0 | CSV export date formatting | Fix verified in QA. Move to Done and schedule for next production deploy. |
| [SF-342](https://shopflow.atlassian.net/browse/SF-342) | C | 4.3.0 | Customer cohort analysis dashboard | Backend complete. Start frontend integration when 4.2.0 items are clear. |
| [SF-356](https://shopflow.atlassian.net/browse/SF-356) | C | 4.3.0 | Marketing email triggers | Spec approved. Begin implementation after SF-342. |

## Info (5)

| Task | ABCDE | Release | Title | Summary |
|------|-------|---------|-------|---------|
| [SF-102](https://shopflow.atlassian.net/browse/SF-102) | C | 4.2.0 | Multi-currency support | Jan pushed currency conversion fixes. On track, no action needed. |
| [SF-203](https://shopflow.atlassian.net/browse/SF-203) | C | 4.2.0 | Product performance insights | Anna completed dashboard widgets. Testing in progress. |
| [SF-401](https://shopflow.atlassian.net/browse/SF-401) | C | 4.2.0 | Shipping provider API integration | Piotr integrated DHL carrier. UPS integration next. |
| [SF-502](https://shopflow.atlassian.net/browse/SF-502) | D | 4.2.0 | PCI compliance updates | Compliance review assigned to you but better suited for security team. Consider reassigning. |
| [SF-604](https://shopflow.atlassian.net/browse/SF-604) | E | 4.1.0 | Email notification language fix | Already released in 4.1.0. Close the ticket. |

---

## Example Todo List Output

If the user selects "Create todos for Action Needed", two todos are created:

**Todo 1:**
- Subject: `A — SF-234: Fix payment callback timeout`
- Description: `Blocker since yesterday — QA team blocked on checkout testing. Deploy hotfix to staging. Re-read the full JIRA task via getJiraIssue before starting work.`
- ActiveForm: `Working on SF-234`

**Todo 2:**
- Subject: `B — SF-289: Order API rate limiting`
- Description: `Maria asked for review of rate limit config in comments 2h ago. Review and respond. Re-read the full JIRA task via getJiraIssue before starting work.`
- ActiveForm: `Working on SF-289`
