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

| Task |   | Info | Title | Summary |
|------|---|------|-------|---------|
| [SF-234](https://shopflow.atlassian.net/browse/SF-234) | A | 4.2.0 · Mariusz · 🔵 In Progress | Fix payment callback timeout | Blocker since yesterday — Anna and Piotr on QA are blocked on checkout regression testing, waiting for your hotfix. Deploy fix branch to staging so QA can resume. |
| [SF-289](https://shopflow.atlassian.net/browse/SF-289) | B | 4.2.0 · Mariusz · 🔵 In Review | Order API rate limiting | Maria asked you to review the rate limit config changes 2h ago. She needs your sign-off before merging to main. Review and respond. |

## Ready to Proceed (4)

| Task |   | Info | Title | Summary |
|------|---|------|-------|---------|
| [SF-301](https://shopflow.atlassian.net/browse/SF-301) | B | 4.2.0 · Mariusz · 🔵 In Review | Mobile storefront optimization | Jan approved your code review on the mobile optimization PR — no blockers remain. Merge to main and deploy to staging for QA verification. |
| [SF-315](https://shopflow.atlassian.net/browse/SF-315) | B | 4.2.0 · Mariusz · 🟢 Done | CSV export date formatting | Anna verified the CSV date formatting fix in QA — all test cases pass. Move to Done and schedule for next production deploy. |
| [SF-342](https://shopflow.atlassian.net/browse/SF-342) | C | 4.3.0 · Mariusz · ⚪ To Do | Customer cohort analysis dashboard | Piotr completed the backend API for cohort data. Frontend integration is ready to start once your 4.2.0 items are clear. |
| [SF-356](https://shopflow.atlassian.net/browse/SF-356) | C | 4.3.0 · Mariusz · ⚪ To Do | Marketing email triggers | Product team approved the email trigger spec. Begin implementation after SF-342 cohort dashboard is done — no external dependencies. |

## Info (5)

| Task |   | Info | Title | Summary |
|------|---|------|-------|---------|
| [SF-102](https://shopflow.atlassian.net/browse/SF-102) | C | 4.2.0 · Jan · 🔵 In Progress | Multi-currency support | Jan pushed currency conversion fixes for EUR and GBP. On track for 4.2.0 release, no action needed from you. |
| [SF-203](https://shopflow.atlassian.net/browse/SF-203) | C | 4.2.0 · Anna · 🔵 Testing | Product performance insights | Anna completed the dashboard widgets and moved to testing. Maria asked Jan to review the chart component — not directed at you. No action needed. |
| [SF-401](https://shopflow.atlassian.net/browse/SF-401) | C | 4.2.0 · Piotr · 🔵 In Progress | Shipping provider API integration | Piotr integrated the DHL carrier API and is starting UPS next. Anna asked Piotr to add tracking webhooks — not your action item. No action needed. |
| [SF-502](https://shopflow.atlassian.net/browse/SF-502) | D | 4.2.0 · Mariusz · ⚪ Open | PCI compliance updates | PCI compliance review assigned to you but Anna on the security team has more context on the requirements. Consider reassigning to Anna. |
| [SF-604](https://shopflow.atlassian.net/browse/SF-604) | E | 4.1.0 · Mariusz · 🟢 Released | Email notification language fix | Already released in 4.1.0 — Jan confirmed the fix is live in production. Close the ticket. |

---

## Example Todo List Output

If the user selects "Create todos for Action Needed", two todos are created:

**Todo 1:**
- Subject: `A — SF-234: Fix payment callback timeout`
- Description: `Blocker since yesterday — Anna and Piotr on QA are blocked on checkout regression testing, waiting for your hotfix. Deploy fix branch to staging so QA can resume. Re-read the full JIRA task via getJiraIssue before starting work.`
- ActiveForm: `Working on SF-234`

**Todo 2:**
- Subject: `B — SF-289: Order API rate limiting`
- Description: `Maria asked you to review the rate limit config changes 2h ago. She needs your sign-off before merging to main. Review and respond. Re-read the full JIRA task via getJiraIssue before starting work.`
- ActiveForm: `Working on SF-289`

---

## Example Task Processing (Step 9)

Processing starts with the first todo (SF-234):

### Task Card

> **[SF-234](https://shopflow.atlassian.net/browse/SF-234) — Fix payment callback timeout**
>
> The payment callback from Stripe is timing out after 30 seconds on high-traffic orders. This has been a Blocker since yesterday — the QA team (Anna, Piotr) cannot complete checkout regression testing for release 4.2.0. Jan investigated and confirmed the issue is in the webhook handler's retry logic. Maria commented 3h ago: "QA is fully blocked on this, can you deploy the fix to staging today?" The fix branch `fix/SF-234-callback-timeout` is ready but needs your review before merge.

### AskUserQuestion — Action

- Review the fix branch and approve for merge (Recommended)
- Request changes on the fix branch
- Reassign to Jan to deploy directly
- Skip — handle later

*User selects: "Review the fix branch and approve for merge"*

### JIRA Comment Draft

> **JIRA Comment Draft — please review:**
>
> Reviewed the fix in `fix/SF-234-callback-timeout`. The retry logic change looks correct — increasing the timeout to 60s and adding exponential backoff should resolve the issue. Merging to main and deploying to staging now. QA can resume checkout testing within the hour.
>
> Confirm to send, or let me know what to change.

*User confirms → comment sent via `addJiraComment` → todo marked completed → move to SF-289*
