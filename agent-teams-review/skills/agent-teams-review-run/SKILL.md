---
name: agent-teams-review-run
description: Run a collaborative Agent Teams code review with cross-reviewer communication, AI Slop detection, and a unified professional report. Use when the user asks to review a PR, review code changes, or run a code review. Spawns a team of independent reviewer teammates (Virtual Mariusz, Backend Solidifier, Frontend Virtuoso, Quality Purist, Security Sentinel, Devil's Advocate) that can communicate with each other and share findings. Produces a professional report with executive summary, AI Slop score, cross-reviewer findings, and verdict.
argument-hint: "[branch-comparison or file-paths]"
---

# Agent Teams Code Review Orchestrator

Run a collaborative code review using Agent Teams. Unlike subagent-based reviews, teammates can communicate with each other, producing cross-reviewer findings that single-pass reviews cannot achieve.

## Workflow

### Step 1: Gather Review Context

Collect the review target from `$ARGUMENTS`.

**Supported input modes:**
1. **Git diff** — branch comparison (e.g. `main..HEAD`, `develop..feature/my-branch`)
2. **Specific files** — list of file paths
3. **Directory** — all source files in a directory

If no arguments provided, use `AskUserQuestion` to ask:
- What branch or files to review
- The base branch to compare against (default: `main`)

### Step 2: Collect Code Changes

**Git diff mode:**
```bash
git diff <base-branch>..HEAD --name-only  # changed file list
git diff <base-branch>..HEAD              # full diff
```

**Specific files:** Read each file directly.

**Directory:** List and read source files, excluding `node_modules`, `dist`, `build`, `.git`, `vendor`, `storage`, etc.

Also read `CLAUDE.md` if it exists in the project root — this contains project conventions that reviewers need.

### Step 3: Analyze Files & Select Reviewers

**Virtual Mariusz (VMR-) — ALWAYS RUNS.** No condition needed.

**Conditional reviewers:**

| Reviewer | Trigger Condition |
|----------|-------------------|
| Backend Solidifier (BCK-) | Files match: `*.php`, `composer.json`, `config/*.php`, `migrations/*`, `database/*` |
| Frontend Virtuoso (FRO-) | Files match: `*.vue`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `nuxt.config.*`, `*.css`, `*.scss` |
| Quality Purist (QAL-) | When Backend Solidifier OR Frontend Virtuoso is selected |
| Security Sentinel (SEC-) | Any file content contains: `auth`, `login`, `password`, `token`, `api`, `form`, `session`, `secret`, `key`, `middleware`, `guard`, `policy` |
| Devil's Advocate (EDG-) | New classes/functions >30 lines, complex conditionals (>3 nesting levels), financial/payment logic detected, OR total lines changed >150 |

After auto-selection, show the user which reviewers are selected and which are skipped (with reasons).

Use `AskUserQuestion` with `multiSelect: true` to let the user override the selection. Present all 6 reviewers with their auto-selected state, allowing the user to add or remove reviewers.

### Step 4: Read Reviewer Profiles

Read each selected reviewer's profile from `references/`:

| Reviewer | Profile File |
|----------|-------------|
| Virtual Mariusz | [references/virtual-mariusz.md](references/virtual-mariusz.md) |
| Backend Solidifier | [references/backend-solidifier.md](references/backend-solidifier.md) |
| Frontend Virtuoso | [references/frontend-virtuoso.md](references/frontend-virtuoso.md) |
| Quality Purist | [references/quality-purist.md](references/quality-purist.md) |
| Security Sentinel | [references/security-sentinel.md](references/security-sentinel.md) |
| Devil's Advocate | [references/devils-advocate.md](references/devils-advocate.md) |

### Step 5: Spawn Agent Team

**CRITICAL:** This step uses the **Agent Teams** feature, NOT the Task tool with subagents.

Instruct Claude to create an Agent Team with the selected reviewers. For each reviewer:

1. Use the reviewer profile content (read in Step 4) as the **spawn prompt** for that teammate
2. Append the following context to each teammate's prompt:

```
## Review Context

### Files Changed
[list of changed files from Step 2]

### Code Diff
[full diff or file contents from Step 2]

### Project Conventions
[CLAUDE.md content if it exists]

## Team Communication

You are part of a review team. You can message other active teammates:
[List active teammate names and their roles]

When you find something in another reviewer's domain:
- Message them directly with the file, line number, and your concern
- They will investigate and report if it's a real issue
- These cross-reviewer findings are especially valuable

When you receive a message from a teammate:
- Investigate the flagged concern within your expertise
- Report findings with the CROSS- prefix if confirmed
- Acknowledge if you've already covered it
```

3. Spawn all teammates simultaneously so they can communicate during review

### Step 6: Wait & Collect Results

As teammates finish their reviews, collect their findings. Each teammate will produce:
- A list of issues with their prefix (VMR-, BCK-, FRO-, QAL-, SEC-, EDG-)
- Cross-reviewer findings with CROSS- prefix
- Positive observations
- Summary assessment

Wait for all teammates to complete before proceeding.

### Step 7: Aggregate Results

1. Collect all findings from all completed reviewers
2. Apply deduplication rules from [references/output-format.md](references/output-format.md)
3. Group findings by file path (for "Why — Findings By File" section)
4. Within each file, sort by severity: Critical -> High -> Medium -> Low
5. Tag cross-reviewer findings inline with `↔️CROSS` and attribution (do NOT create a separate section)
6. Extract the AI Slop Score from Virtual Mariusz's assessment
7. Determine verdict using the decision matrix from [references/output-format.md](references/output-format.md)
8. Apply AI Slop Score impact on verdict (score 0-3 adds Critical, 4-5 adds High)
9. Build the action checklist sorted by urgency (Required -> Recommended -> Optional)

### Step 8: Format Report

Format the aggregated findings using the **Action-First** report template from [references/output-format.md](references/output-format.md).

See [references/example-report.md](references/example-report.md) for a complete example of the expected output.

Key sections (in order):
- **Verdict & Score** — compact block with verdict, risk, AI Slop score, severity counts table
- **What You Need To Do** — action checklist grouped by urgency (Before Merge Required, Before Merge Recommended, Post-Merge Optional). Each item: checkbox, [ID], description, severity badge, CROSS tag if applicable, location, reviewer
- **Why — Findings By File** — all issues grouped by file path. Critical/High: full description + code example + fix. Medium/Low: 1-2 line summary. Cross-reviewer findings inline with ↔️CROSS tag
- **AI Slop Report** — score table + notable examples
- **Reviewer Verdicts** — compact table: Reviewer, Verdict, Issues count, Summary
- **What's Good** — bullet list of positive observations

### Step 9: Save Report

Save the formatted report to:
```
docs/reviews/{branch-name}-{YYYY-MM-DD}.md
```

Create the `docs/reviews/` directory if it does not exist.

If the branch name contains slashes (e.g. `feature/user-auth`), replace them with hyphens in the filename (e.g. `feature-user-auth-2026-03-02.md`).

### Step 10: Present Results and Offer Actions

Display the executive summary to the user:
- Overall verdict with emoji
- Risk level
- AI Slop Score
- Issue counts by severity
- Top 3 key findings
- Path to saved report

Use `AskUserQuestion` to offer:
1. **View full report** — display the complete report
2. **Apply suggested fixes** — for Critical/High issues with code fixes
3. **Done** — no further action

If "Apply suggested fixes" is selected:
- Show each Critical/High issue with its suggested fix
- Let the user pick which fixes to apply using `AskUserQuestion` with `multiSelect: true`
- Apply selected fixes to the code

## Error Handling

- If a teammate fails or times out, continue with the remaining teammates and note the failure in the report
- If `git diff` fails, fall back to asking the user for specific file paths
- If no code changes are found, inform the user and exit gracefully
- If no reviewers are selected (user deselected all), warn and require at least Virtual Mariusz
