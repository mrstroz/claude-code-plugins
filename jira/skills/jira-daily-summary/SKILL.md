---
name: jira-daily-summary
description: Generate a daily JIRA summary with intelligent triage and ABCDE priority classification. Groups tasks into Action Needed, Ready to Proceed, and Info categories with actionable summaries. Creates optional Claude Code todo lists for follow-up. Use when the user wants a daily standup summary, task triage, daily review, morning briefing, sprint check-in, or wants to know what needs attention in JIRA today. Triggers on any request mentioning daily summary, standup prep, triage, daily review, morning briefing, what needs my attention, sprint status check, or daily JIRA report.
model: opus
---

# JIRA Daily Summary & Triage

Generate a prioritized daily summary of JIRA tasks with intelligent triage into three action groups and Brian Tracy ABCDE classification. Uses the `jira-fetch` script to pull all data via REST API in one call — no MCP overhead, no subagents, no token waste.

## Workflow

1. **Initial setup** — Ask language and time frame via `AskUserQuestion`
2. **Resolve JIRA project** — Get domain and project key from CLAUDE.md or ask user
3. **Fetch data** — Run `jira-fetch` script to get all issues with descriptions and comments
4. **Triage into 3 groups** — Classify each task as Action Needed, Ready to Proceed, or Info
5. **ABCDE classification** — Assign priority letter A-E to each task and sort within groups
6. **Generate summary** — Produce text overview and three prioritized tables
7. **Todo list creation** — Optionally create Claude Code todos for follow-up
8. **Process tasks** — Work through todos one by one: show expanded summary, ask for action, propose and send a JIRA comment

---

## Initial Setup (Step 1)

Use a single `AskUserQuestion` call with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Time frame** (header: "Time frame"): Active sprint tasks assigned to me (Recommended) | All tasks updated or commented today | All tasks updated or commented yesterday or today | All tasks updated or commented in last 3 days

Use the selected language for the entire output. Translate section headers according to the translations in [references/format.md](references/format.md).

---

## Resolve JIRA Project (Step 2)

Look for a JIRA configuration block in the project's CLAUDE.md:

```
## JIRA
- Domain: mycompany.atlassian.net
- Project key: PROJ
```

If found, use that domain and project key. If not found, ask via `AskUserQuestion` (header: "JIRA Configuration"):
- Domain (e.g., mycompany.atlassian.net)
- Project key (e.g., PROJ)

Store the resolved `domain`, `projectKey`, and base URL (`https://{domain}`) for the rest of the session. The base URL is needed for clickable task links in the output.

---

## Fetch Data (Step 3)

This single step replaces the old search + subagent extraction pattern. The `jira-fetch` script fetches all issues with full descriptions and comments in one call, returning a minimal JSON file with plaintext data ready for triage.

### Build JQL

Map the selected time frame to a JQL query:

| Time Frame | JQL |
|------------|-----|
| Active sprint assigned to me | `project = {projectKey} AND sprint in openSprints() AND assignee = currentUser() ORDER BY priority DESC` |
| Updated/commented today | `project = {projectKey} AND updated >= startOfDay() ORDER BY updated DESC` |
| Updated/commented yesterday + today | `project = {projectKey} AND updated >= startOfDay(-1d) ORDER BY updated DESC` |
| Last 3 days | `project = {projectKey} AND updated >= startOfDay(-3d) ORDER BY updated DESC` |

### Locate and Run Script

Find the fetch script via Glob:

```
pattern: **/jira-fetch/scripts/fetch-issues.mjs
```

Run the script:

```bash
node "${SCRIPT_PATH}" \
  --domain "${DOMAIN}" \
  --jql "${JQL}" \
  --output "/tmp/jira-daily-summary-$(date +%Y%m%d-%H%M%S).json"
```

If the script fails, show the error and stop. Common issues: missing `JIRA_EMAIL` or `JIRA_API_TOKEN` env vars.

### Read and Parse

Read the output JSON file. The data contains per issue: `key`, `type`, `status`, `priority`, `assignee`, `reporter`, `labels`, `fixVersions`, `summary`, `created`, `updated`, `description` (plaintext), `comments[]` (with `author`, `created`, `body` as plaintext).

Store the file path — it will be used again in Step 8 for task processing.

---

## Triage into 3 Groups (Step 4)

Classify every task into exactly one of three groups. The groups represent different levels of urgency — getting this right matters because it determines what the user focuses on first.

Use the full issue data from the JSON file (description, comments with author and dates, assignee, reporter, status, priority) for accurate triage.

### Action Needed

Tasks requiring my immediate action. These represent blocked work or situations where the team is waiting on me. Delaying these has a multiplier effect because other people cannot proceed.

Before classifying, perform a directionality analysis on each comment: identify (1) who is speaking, (2) who is being asked to act (the target — tagged person, named person, or implied addressee), and (3) what action is requested. Only classify as Action Needed when **I am the target** of the request, not merely mentioned as context.

Classify a task as Action Needed when any of these apply:
- Recent comments tag or mention me directly **as the person asked to act**
- Task has Blocker status or is flagged as blocked **and** is assigned to me
- Task is assigned to me and recent comments contain unresolved questions from team members **addressed to me**
- Comments include phrases like "waiting for", "need input from", "blocked by", "can you review" **where I am the named/tagged target of the request**
- Team explicitly cannot proceed without my action

Do NOT classify as Action Needed when:
- A comment tags or names **another person** as the requested actor (e.g., "@jan can you review this" — Jan is the target, not me)
- Generic status phrases mention a role or team without naming me (e.g., "waiting for QA", "blocked by backend" — unless I am specifically the QA person or backend owner in context)
- I am mentioned as background context but not as the person expected to act (e.g., "Mariusz implemented this last sprint, Jan please verify")

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
- Comments where another person (not me) is tagged or named as the action target — these are someone else's Action Needed, not mine
- All remaining tasks not matching the above two groups

When in doubt between groups, classify into Info rather than Action Needed — false urgency is worse than missing a low-priority item.

---

## ABCDE Classification (Step 5)

Assign each task a priority letter A through E using the Brian Tracy method. The letter determines the order in which tasks appear within their triage group (A first, E last).

| Letter | Meaning | Typical Signals |
|--------|---------|-----------------|
| A | Must do | Blocker/Critical priority, team blocked, imminent release, production issue |
| B | Should do | Major priority, upcoming release, someone waiting but not fully blocked |
| C | Nice to do | Normal priority, no dependencies, no time pressure |
| D | Delegate | Assigned to me but better suited for someone else |
| E | Eliminate | Can be dropped, deferred, or is no longer relevant |

### Classification Factors (in priority order)

1. **Comments and team obligations directed at me** — if someone is waiting for my input in comments addressed to me, that is the strongest signal. A person blocked on my response makes the task at least B, often A.
2. **Release proximity** — tasks in the nearest unreleased fixVersion outrank tasks in future versions. No fixVersion means lower urgency unless other signals override.
3. **Task priority field** — Blocker/Critical → A, Major → B, Normal → C, Minor → C or below.
4. **Task type** — Hotfix → always A. Bug → B-C depending on severity. Story/Task → neutral.
5. **Assignee/reporter** — if someone else reported and assigned to me, higher urgency than self-reported tasks.

### Override Rules

- Blocker priority → always A
- Hotfix type → always A
- Someone explicitly blocked waiting for my response (in comments addressed to me) → at least B

For the full methodology with edge cases and sorting rules, see [references/abcde-methodology.md](references/abcde-methodology.md).

Sort tasks within each triage group: A first, then B, C, D, E. Within the same letter, sort by priority descending, then by release proximity, then by last-updated descending.

---

## Generate Summary (Step 6)

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
| Task |   | Title | Summary |
```

Column rules:
- **Task**: clickable JIRA link — `[PROJ-123](https://{domain}/browse/PROJ-123)`
- (empty header): single letter A-E
- **Title**: issue summary, truncated with `...` if over 70 characters
- **Summary**: starts with metadata prefix `{Ver} · {Status} · {Assignee} —` followed by narrative summary (~30-50 words). Ver is fixVersion or `—` if missing. Status uses color emoji prefix (⚪ To Do/Open/Backlog/New, 🔵 In Progress/In Review/Reviewed/Testing/QA/Code Review/In Development, 🟢 Done/Ready to Deploy/Deployed/Closed/Resolved/Released). Assignee is the person's first name. The narrative portion names specific people and who-to-whom dynamics rather than using passive voice.

### Condensation

If any group has more than 15 tasks, show individual rows only for A and B items. Summarize C/D/E as a single row:

```
| — | C-E | {count} additional tasks | No immediate action required. |
```

Action Needed is never condensed — every item there deserves individual attention.

---

## Todo List Creation (Step 7)

After presenting the summary, use `AskUserQuestion` with header "Todo list":

- **Create todos for Action Needed** (Recommended)
- **Create todos for Ready to Proceed**
- **Create todos for both groups**
- **Skip**

If the user selects a group, use `TaskCreate` for each task in the selected group(s):

- **subject**: `{ABCDE} — {PROJ-KEY}: {title}` (e.g., `A — SF-234: Fix payment callback timeout`)
- **description**: Include the task key, title, full summary from the table, and: "Full issue data (description + comments) is available in the fetched JSON file — no need to re-fetch from JIRA."
- **activeForm**: `Working on {PROJ-KEY}` (e.g., `Working on SF-234`)

After creating todos, confirm how many were created and for which group(s). Then proceed to Step 8.

---

## Process Tasks (Step 8)

Work through the todo list one task at a time. For each task, repeat the following cycle:

### 8a. Load Issue Data

Read the issue data from the JSON file fetched in Step 3. The file contains full description and up to 50 comments in plaintext — sufficient for task processing without additional API calls.

Find the issue by its `key` in the `issues` array.

### 8b. Display Task Card

Present the task as a heading with the expanded summary below it:

**[PROJ-123](https://{domain}/browse/PROJ-123) — {title}**

{expanded summary}

The expanded summary should be 2-3x more detailed than the table summary (~60-90 words). Include:
- Current situation and status
- Key recent comments (who said what, when)
- Blockers or dependencies if any
- Context from the description that is relevant to the next action

### 8c. Ask for Action

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

### 8d. Propose JIRA Comment

Based on the user's chosen action, draft a JIRA comment in the language selected in Step 1. Present the draft as plain text:

**JIRA Comment Draft — please review:**

{comment content}

Confirm to send, or let me know what to change.

Writing rules:
- Use the language selected in Step 1 for the entire comment
- Be direct — state the decision or response, not the process of arriving at it
- Use domain terminology from the JIRA issue
- Match tone to context — urgent issues get direct language, discussions get collaborative tone

### 8e. Send Comment and Advance

After the user confirms (or edits and confirms) the comment:

1. Resolve `cloudId` if not yet known — call `getAccessibleAtlassianResources` MCP tool once per session to get the cloud instance ID. Cache it for subsequent comments.
2. Use `addCommentToJiraIssue` MCP tool with `cloudId`, `issueKey`, and `body` to post the comment.
3. Mark the current todo as completed via `TaskUpdate` (status: `completed`)
4. Move to the next task in the todo list and repeat from Step 8a

If the user chose "Skip" in Step 8c, mark the todo as completed without sending a comment and move to the next task.
