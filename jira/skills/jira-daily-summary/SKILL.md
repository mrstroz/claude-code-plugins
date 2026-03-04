---
name: jira-daily-summary
description: Generate a daily JIRA summary with intelligent triage and ABCDE priority classification. Groups tasks into Action Needed, Ready to Proceed, and Info categories with actionable summaries. Creates optional Claude Code todo lists for follow-up. Use when the user wants a daily standup summary, task triage, daily review, morning briefing, sprint check-in, or wants to know what needs attention in JIRA today. Triggers on any request mentioning daily summary, standup prep, triage, daily review, morning briefing, what needs my attention, sprint status check, or daily JIRA report.
---

# JIRA Daily Summary & Triage

Generate a prioritized daily summary of JIRA tasks with intelligent triage into three action groups and Brian Tracy ABCDE classification.

## Workflow

1. **Initial setup** — Ask language and time frame via `AskUserQuestion`
2. **Resolve JIRA project** — Auto-discover the project via MCP tools
3. **Fetch tasks** — Search JIRA issues using optimized JQL based on selected time frame
4. **Read issue details** — Fetch full details for tasks needing comment context
5. **Triage into 3 groups** — Classify each task as Action Needed, Ready to Proceed, or Info
6. **ABCDE classification** — Assign priority letter A-E to each task and sort within groups
7. **Generate summary** — Produce text overview and three prioritized tables
8. **Todo list creation** — Optionally create Claude Code todos for follow-up
9. **Process tasks** — Work through todos one by one: re-read from JIRA, show expanded summary, ask for action, propose and send a JIRA comment

---

## Initial Setup (Step 1)

Use a single `AskUserQuestion` call with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Time frame** (header: "Time frame"): Active sprint tasks assigned to me (Recommended) | All tasks updated or commented today | All tasks updated or commented yesterday | All tasks updated or commented in last 3 days

Use the selected language for the entire output. Translate section headers according to the translations in [references/format.md](references/format.md).

---

## Resolve JIRA Project (Step 2)

Auto-discover the JIRA project — do not ask the user for cloudId or projectKey.

1. Call `getAccessibleAtlassianResources` to get the available cloud instances. Use the first (or only) instance as the cloudId.
2. Call `getVisibleJiraProjects` to list all projects in the instance.
3. If only one project exists, use it automatically.
4. If multiple projects exist, pick the most likely match based on context or present them via `AskUserQuestion` (header: "Project").

Store the resolved `cloudId`, `projectKey`, and the cloud base URL (e.g., `https://mycompany.atlassian.net`) for the rest of the session. The base URL is needed for clickable task links in the output.

---

## Fetch Task List (Step 3)

Map the selected time frame to a JQL query. Always include the project filter.

| Time Frame | JQL |
|------------|-----|
| Active sprint assigned to me | `project = {projectKey} AND sprint in openSprints() AND assignee = currentUser() ORDER BY priority DESC` |
| Updated/commented today | `project = {projectKey} AND updated >= startOfDay() ORDER BY updated DESC` |
| Updated/commented yesterday | `project = {projectKey} AND updated >= startOfDay(-1d) ORDER BY updated DESC` |
| Last 3 days | `project = {projectKey} AND updated >= startOfDay(-3d) ORDER BY updated DESC` |

This step is purely a discovery phase — collect the list of issue keys and lightweight metadata. Do NOT request `comment` or `description` fields here because they cause the response to exceed MCP size limits on active projects.

```
fields: ["summary", "status", "issuetype", "priority", "fixVersions", "assignee", "reporter"]
maxResults: 50
```

If more than 50 issues exist, use `nextPageToken` to paginate. From each result, collect: `key`, `summary`, `status`, `issuetype`, `priority`, `fixVersions`, `assignee`, `reporter`.

---

## Read Full Issue Details (Step 4)

For every task returned by the JQL search, call `getJiraIssue` individually to get the full `description` and `comments`. This is the main data-fetching step — comments are the strongest triage signal (mentions, questions, blockers) and skipping them risks misclassifying urgent tasks into Info.

Process in batches of 10 to avoid context overload.

If the JQL returned more than 30 tasks, prioritize individual fetches in this order:
1. Blocker/Critical priority tasks (always fetch — likely Action Needed)
2. Tasks assigned to me (potential Action Needed or Ready to Proceed)
3. Remaining tasks by priority descending

Skip individual fetches beyond the 30 cap — triage those tasks using metadata only from Step 3 and classify them into Info unless metadata clearly indicates otherwise (e.g., Blocker priority assigned to me).

---

## Triage into 3 Groups (Step 5)

Classify every task into exactly one of three groups. The groups represent different levels of urgency — getting this right matters because it determines what the user focuses on first.

Tasks with full details from Step 4 (description + comments) get the most accurate triage. Tasks beyond the 30-fetch cap are triaged from metadata only — classify these into Info unless metadata clearly indicates Action Needed (e.g., Blocker priority assigned to me).

### Action Needed

Tasks requiring my immediate action. These represent blocked work or situations where the team is waiting on me. Delaying these has a multiplier effect because other people cannot proceed.

Classify a task as Action Needed when any of these apply:
- Recent comments mention or tag me directly
- Task has Blocker status or is flagged as blocked
- Task is assigned to me and recent comments contain unresolved questions from team members
- Comments include phrases like "waiting for", "need input from", "blocked by", "can you review", or similar requests directed at me
- Team explicitly cannot proceed without my action

### Ready to Proceed

Tasks assigned to me that are ready for the next step. These are opportunities to move work forward — no blockers, just needs my processing.

Classify a task as Ready to Proceed when:
- Task is assigned to me and status indicates waiting for testing, QA, or code review
- Task is ready for deployment or production release
- Another developer completed their part and the task needs my processing to advance
- Task is in a "done" or "review" state but not yet closed/deployed

### Info

Everything that does not fit Action Needed or Ready to Proceed. This is context that helps the user stay informed about team progress without requiring action.

- Tasks worked on by team members where I am not mentioned in comments
- General progress updates and status changes
- All remaining tasks not matching the above two groups

When in doubt between groups, classify into Info rather than Action Needed — false urgency is worse than missing a low-priority item.

---

## ABCDE Classification (Step 6)

Assign each task a priority letter A through E using the Brian Tracy method. The letter determines the order in which tasks appear within their triage group (A first, E last).

| Letter | Meaning | Typical Signals |
|--------|---------|-----------------|
| A | Must do | Blocker/Critical priority, team blocked, imminent release, production issue |
| B | Should do | Major priority, upcoming release, someone waiting but not fully blocked |
| C | Nice to do | Normal priority, no dependencies, no time pressure |
| D | Delegate | Assigned to me but better suited for someone else |
| E | Eliminate | Can be dropped, deferred, or is no longer relevant |

### Classification Factors (in priority order)

1. **Comments and team obligations** — if someone is waiting for my input, that is the strongest signal. A person blocked on my response makes the task at least B, often A.
2. **Release proximity** — tasks in the nearest unreleased fixVersion outrank tasks in future versions. No fixVersion means lower urgency unless other signals override.
3. **Task priority field** — Blocker/Critical → A, Major → B, Normal → C, Minor → C or below.
4. **Task type** — Hotfix → always A. Bug → B-C depending on severity. Story/Task → neutral.
5. **Assignee/reporter** — if someone else reported and assigned to me, higher urgency than self-reported tasks.

### Override Rules

- Blocker priority → always A
- Hotfix type → always A
- Someone explicitly blocked on me → at least B

For the full methodology with edge cases and sorting rules, see [references/abcde-methodology.md](references/abcde-methodology.md).

Sort tasks within each triage group: A first, then B, C, D, E. Within the same letter, sort by priority descending, then by release proximity, then by last-updated descending.

---

## Generate Summary (Step 7)

Produce the summary following the format defined in [references/format.md](references/format.md). Full example: [references/example.md](references/example.md).

### Text Overview

Start with a 2-4 sentence overview:
- First sentence: counts per group (e.g., "You have 2 tasks needing immediate action, 4 ready to proceed, and 5 informational updates.")
- Second sentence: focus recommendation — what to tackle first and why
- If there are A-classified tasks in Action Needed, call them out by task key

### Three Tables

Generate one table per triage group: Action Needed, Ready to Proceed, Info.

All tables use the same columns:

```
| Task |   | Info | Title | Summary |
```

Column rules:
- **Task**: clickable JIRA link — `[PROJ-123](https://{cloudBaseUrl}/browse/PROJ-123)`
- (empty header): single letter A-E
- **Info**: three lines combined with `<br>` — `{fixVersion}<br>{assignee}<br>{status}`. Use `—` if fixVersion is missing. Prefix status with color emoji: ⚪ for To Do/Open/Backlog/New, 🔵 for In Progress/In Review/Testing/QA/Code Review/In Development, 🟢 for Done/Ready to Deploy/Deployed/Closed/Resolved/Released.
- **Title**: issue summary, truncated with `...` if over 70 characters
- **Summary**: situation + proposed action in ~20-30 words. This is the most important column — it tells the user what is happening and what to do. Be specific and actionable, not vague.

### Condensation

If any group has more than 15 tasks, show individual rows only for A and B items. Summarize C/D/E as a single row:

```
| — | C-E | — | {count} additional tasks | No immediate action required. |
```

Action Needed is never condensed — every item there deserves individual attention.

---

## Todo List Creation (Step 8)

After presenting the summary, use `AskUserQuestion` with header "Todo list":

- **Create todos for Action Needed** (Recommended)
- **Create todos for Ready to Proceed**
- **Create todos for both groups**
- **Skip**

If the user selects a group, use `TaskCreate` for each task in the selected group(s):

- **subject**: `{ABCDE} — {PROJ-KEY}: {title}` (e.g., `A — SF-234: Fix payment callback timeout`)
- **description**: Include the task key, title, full summary from the table, and: "Re-read the full JIRA task via getJiraIssue before starting work — the summary above is a triage snapshot, not the complete picture."
- **activeForm**: `Working on {PROJ-KEY}` (e.g., `Working on SF-234`)

The re-read instruction matters because the daily summary intentionally condenses information for quick scanning. When actually working on a task, the full JIRA issue with all comments, description, and history provides essential context.

After creating todos, confirm how many were created and for which group(s). Then proceed to Step 9.

---

## Process Tasks (Step 9)

Work through the todo list one task at a time. For each task, repeat the following cycle:

### 9a. Re-read from JIRA

Call `getJiraIssue` for the current task's issue key to get fresh, complete data — description, all comments, status, and history. The triage summary from Step 7 is intentionally condensed; processing a task requires the full picture.

### 9b. Display Task Card

Present the task in a clearly marked block:

> **[PROJ-123](https://{cloudBaseUrl}/browse/PROJ-123) — {title}**
>
> {expanded summary}

The expanded summary should be 2-3x more detailed than the table summary (~60-90 words). Include:
- Current situation and status
- Key recent comments (who said what, when)
- Blockers or dependencies if any
- Context from the description that is relevant to the next action

### 9c. Ask for Action

Use `AskUserQuestion` (header: "Action") with options contextual to the task's triage group and status. Examples:

**Action Needed tasks:**
- Review and respond to the team's question
- Unblock — provide the requested input
- Reassign to someone better suited
- Skip — handle later

**Ready to Proceed tasks:**
- Approve and move forward (merge, deploy, close)
- Request changes before proceeding
- Reassign to someone else
- Skip — handle later

Adapt options based on what the task actually needs — these are examples, not a fixed list.

### 9d. Propose JIRA Comment

Based on the user's chosen action, draft a JIRA comment in the language selected in Step 1. Present the draft in a marked block:

> **JIRA Comment Draft — please review:**
>
> {comment content}
>
> Confirm to send, or let me know what to change.

Writing rules:
- Use the language selected in Step 1 for the entire comment
- Be direct — state the decision or response, not the process of arriving at it
- Use domain terminology from the JIRA issue
- Match tone to context — urgent issues get direct language, discussions get collaborative tone

### 9e. Send Comment and Advance

After the user confirms (or edits and confirms) the comment:

1. Use `addJiraComment` MCP tool with `cloudId` (resolved in Step 2), `issueKey`, and `body`
2. Mark the current todo as completed via `TaskUpdate` (status: `completed`)
3. Move to the next task in the todo list and repeat from Step 9a

If the user chose "Skip" in Step 9c, mark the todo as completed without sending a comment and move to the next task.
