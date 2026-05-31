---
name: agent-teams-review
description: Collaborative Agent Teams code review with cross-reviewer communication, AI Slop detection, and a unified professional report. Use when the user asks to review a PR, review code changes, or run a code review. Spawns a team of independent reviewer teammates (Virtual Mariusz, Backend Solidifier, Frontend Virtuoso, Quality Purist, Security Sentinel, Devil's Advocate) that can communicate with each other and share findings. Produces a professional report with executive summary, AI Slop score, cross-reviewer findings, and verdict.
argument-hint: "[base-branch] [scope: quick|standard|full]"
---

# Agent Teams Code Review Orchestrator

Run a collaborative code review using Agent Teams. Unlike subagent-based reviews, teammates can message each other during the review, producing cross-reviewer findings that single-pass reviews cannot achieve.

This skill leaves `allowed-tools` unset on purpose: as the orchestrator it drives the whole Agent Teams machinery (`TeamCreate`, `TaskCreate`, `TaskList`, `SendMessage`, `TaskStop`, `TeamDelete`) plus git and file tools, so it needs broad access.

## Workflow

### Step 1: Gather Review Context

Collect the review target from `$ARGUMENTS`.

**Input:** The first argument is the base branch to compare against (e.g. `develop`, `main`). Default: `main` if none is given. A second optional argument is the scope keyword (`quick`, `standard`, `full`) — if present, skip the prompt in Step 2 and use it directly.

### Step 2: Select Review Scope

The scope controls how deep the review goes and how much noise reaches the final report. Ask early, because it shapes every later step. If the user already passed a scope keyword in `$ARGUMENTS`, skip the question.

Use `AskUserQuestion` to ask which scope to run:

| Scope | What it does | When to pick it |
|-------|--------------|-----------------|
| **1 — Quick** (Critical-only) | Same team reviews the diff, but the report surfaces **only Critical and High** findings. Medium/Low collapse to a one-line count. No triage offered automatically. | Fast gate before merge — "are there any showstoppers?" |
| **2 — Standard** (default) | Current behavior. Team reviews the diff, full Action-First report with every severity, AI Slop table, optional triage. | Normal PR review. |
| **3 — Full** (deep) | Team reviews the diff **plus related files** — the callers and callees of every function the PR touched, and the modules they belong to. Adds an **Impact Analysis** section judging whether the touched behavior still works end-to-end. Triage is recommended at the end. | High-risk change, refactor, or "make sure nothing downstream broke". |

The team selection itself does not change with scope (Step 4 stays the same) — scope only changes reporting threshold and how far the reviewers look. Remember the chosen scope; it feeds Steps 3, 6, 8, 9, and 11.

### Step 3: Collect Code Changes

**Git diff mode:**
```bash
git diff <base-branch>...HEAD --name-only  # changed file list
git diff <base-branch>...HEAD              # full diff
```

**Specific files:** Read each file directly.

**Directory:** List and read source files, excluding `node_modules`, `dist`, `build`, `.git`, `vendor`, `storage`, etc.

Read `CLAUDE.md` from the project root if it exists — it carries project conventions the reviewers need.

**Full scope only — collect related files.** When scope is **Full**, the touched code is not enough: a change is only safe if its callers and callees still hold. For each function/method/class the diff modifies, locate where it is used and what it depends on, and read those files too:

```bash
# find references to a touched symbol across the codebase
grep -rn "touchedFunctionName" --include=*.php --include=*.vue --include=*.ts .
```

Gather these into a "Related Files" set that you will hand to the team in Step 6 so they can reason about ripple effects, not just the diff in isolation.

### Step 4: Analyze Files & Select Reviewers

Virtual Mariusz (`VM-`) always runs — he is the digital twin and the AI-Slop gatekeeper, so every review needs his eyes. The rest are selected by what the diff actually contains:

| Reviewer | Trigger Condition |
|----------|-------------------|
| Backend Solidifier (BE-) | Files match: `*.php`, `composer.json`, `config/*.php`, `migrations/*`, `database/*` |
| Frontend Virtuoso (FE-) | Files match: `*.vue`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `nuxt.config.*`, `*.css`, `*.scss` |
| Quality Purist (QA-) | When Backend Solidifier OR Frontend Virtuoso is selected |
| Security Sentinel (SC-) | File path matches: `**/auth/**`, `**/security/**`, `**/middleware/**`, `**/guard/**`, `**/policy/**` OR file content contains: `password`, `login`, `token`, `secret`, `session`, `csrf`, `sanitize`, `encrypt`, `hash` |
| Devil's Advocate (DV-) | New classes/functions >30 lines, complex conditionals (>3 nesting levels), financial/payment logic detected, OR total lines changed >150 |

After auto-selection, show the user which reviewers are selected and which are skipped (with reasons).

Use `AskUserQuestion` with `multiSelect: true` to let the user override the selection. Present all 6 reviewers with their auto-selected state so the user can add or remove reviewers.

### Step 5: Read Reviewer Profiles

Read each selected reviewer's profile from `references/`:

| Reviewer | Profile File |
|----------|-------------|
| Virtual Mariusz | [references/virtual-mariusz.md](references/virtual-mariusz.md) |
| Backend Solidifier | [references/backend-solidifier.md](references/backend-solidifier.md) |
| Frontend Virtuoso | [references/frontend-virtuoso.md](references/frontend-virtuoso.md) |
| Quality Purist | [references/quality-purist.md](references/quality-purist.md) |
| Security Sentinel | [references/security-sentinel.md](references/security-sentinel.md) |
| Devil's Advocate | [references/devils-advocate.md](references/devils-advocate.md) |

### Step 6: Spawn the Agent Team

Use the **Agent Teams** tools here, not the `Task` subagent tool — teammates must be able to message each other during the review, which subagents cannot do. Spawn every selected reviewer with **Sonnet**; code review does not need Opus-level reasoning, and a 6-person team on Sonnet keeps cost sane.

Concrete sequence:

1. **Create the team with `TeamCreate`**, spawning all selected reviewers at once (simultaneous spawn is what lets them communicate). For each teammate provide:
   - a name (the reviewer's name, e.g. `Security Sentinel`)
   - model: `sonnet`
   - a spawn prompt = the reviewer's profile content (from Step 5) **+** the Review Context block below

2. **Append this Review Context block** to every teammate's spawn prompt:

```
## Review Context

### Review Scope: {Quick | Standard | Full}
{Scope instructions — see "Scope behavior" below}

### Files Changed
[list of changed files from Step 3]

### Code Diff
[full diff or file contents from Step 3]

### Related Files (Full scope only)
[callers/callees and related modules collected in Step 3]

### Project Conventions
[CLAUDE.md content if it exists]

## How to Report Each Finding

Tag every finding with three markers so the report and the later triage stay analyzable and you avoid crying wolf:

- **Severity:** Critical | High | Medium | Low — judged by real impact on the running app
- **Confidence:** High | Medium | Low — how sure you are it is a real issue. Low confidence means "worth a look", not a reason to inflate severity. This is how we keep false positives out.
- **Effort:** ~5min | ~30min | ~1h+ — rough fix cost, so triage does not have to guess

Write each finding's header line as:
`[PREFIX-NNN] Title — file:line — Severity · Confidence · Effort`

## Team Communication

You are part of a review team. You can message other active teammates:
[List active teammate names and their roles]

When you find something in another reviewer's domain:
- Message them directly with the file, line number, and your concern
- They investigate and report if it is a real issue
- These cross-reviewer findings are especially valuable — they are what a solo pass misses

When a teammate messages you:
- Investigate the flagged concern within your expertise
- Report findings with the CROSS- prefix if confirmed
- Acknowledge if you have already covered it
```

3. **Scope behavior** — fill the `### Review Scope` section with the matching instruction:
   - **Quick:** "Surface only Critical and High findings. For Medium and Low, do not write them up — just give a one-line count at the end of your review. Spend your effort on what could block the merge."
   - **Standard:** "Surface all severities using the normal format."
   - **Full:** "Surface all severities. You also have the Related Files above — verify the functions this PR touched still work end-to-end: trace their callers and callees, and flag any place the change could break existing behavior. Report those under an 'Impact Analysis' note so the lead can collect them."

4. **Create a shared task list with `TaskCreate`** — one review task per reviewer, plus an aggregation task owned by the lead:

| Task | Assigned To | Depends On |
|------|------------|------------|
| Review: [domain-specific files] | [Reviewer Name] | — |
| Review: [domain-specific files] | [Reviewer Name] | — |
| ... | ... | — |
| Aggregate & Format Report | Lead | All review tasks |

Each review task should name which files/areas to focus on, the reviewer's domain, and the expected deliverables (issue list with markers, cross-reviewer flags, positive observations, and — at Full scope — Impact Analysis notes). Teammates claim their tasks and mark them complete; the aggregation task unblocks once all reviews finish.

### Step 7: Wait & Collect Results

As the lead, resist reviewing the code yourself. The moment you start finding issues, you lose coordination focus, duplicate the teammates' work, and the report stops being a true multi-reviewer aggregation. Your job is to coordinate and wait.

Monitor progress with `TaskList` (or `Monitor`). As teammates finish, collect their findings. Each teammate produces:
- A list of issues with their prefix (VM-, BE-, FE-, QA-, SC-, DV-) and the Severity · Confidence · Effort markers
- Cross-reviewer findings with the CROSS- prefix
- Positive observations
- A summary assessment (and, at Full scope, Impact Analysis notes)

If a teammate looks stuck or idle without completing its task, nudge it with `SendMessage`. Proceed to Step 8 only when every review task is marked complete.

### Step 8: Aggregate Results

1. Collect all findings from all completed reviewers.
2. Apply the deduplication rules from [references/output-format.md](references/output-format.md).
3. Group findings by severity (Critical → High → Medium → Low), then by file path within each group.
4. Tag cross-reviewer findings inline with `CROSS` and attribution (do not create a separate section).
5. Extract the AI Slop Score from Virtual Mariusz's assessment.
6. Determine the verdict using the decision matrix in [references/output-format.md](references/output-format.md).
7. Apply the AI Slop Score impact on the verdict (0-3 adds a Critical, 4-5 adds a High).
8. Build the action checklist sorted by severity.
9. **Apply the scope threshold:** at **Quick** scope, keep only Critical and High in the Action Items and Findings; replace Medium/Low with a single line stating their counts. At **Standard** and **Full**, keep everything.
10. **Full scope:** collect the Impact Analysis notes from the reviewers into a single section (see Step 9).

### Step 9: Format Report

Format the aggregated findings using the **Action-First** template from [references/output-format.md](references/output-format.md). See [references/example-report.md](references/example-report.md) for a complete example.

Key sections (in order):
- **Header** — PR, date, team, **and the Review Scope used** (Quick / Standard / Full)
- **Verdict** — compact block with verdict, AI Slop score, severity counts table
- **Action Items** — checklist grouped by severity. Each item: checkbox, [ID], title, CROSS tag if applicable, location, `Severity · Confidence · Effort`, reviewer
- **Findings** — detailed issues grouped by severity, then by file. Critical/High: full description + code + fix. Medium: 1-2 line summary. Low: 1 line. Cross-reviewer findings inline with CROSS tag
- **Impact Analysis** — **Full scope only.** Whether the touched functions still work end-to-end, with the callers/callees checked and any ripple risks
- **AI Slop Report** — score table + notable examples
- **What's Good** — positive observations

At **Quick** scope, omit the detailed AI Slop table (keep just the one-line AI Slop score in the verdict block) and show Medium/Low only as counts — the point of Quick is a focused showstopper list.

### Step 10: Save Report

Save the formatted report to:
```
docs/reviews/{branch-name}-{YYYY-MM-DD}.md
```

Create the `docs/reviews/` directory if it does not exist. If the branch name contains slashes (e.g. `feature/user-auth`), replace them with hyphens in the filename (e.g. `feature-user-auth-2026-03-02.md`).

### Step 11: Present Results and Offer Actions

Display the executive summary: overall verdict, AI Slop score, issue counts by severity, scope used, top 3 key findings, and the path to the saved report.

**Action Loop** — repeat until the user selects "Done". Use `AskUserQuestion` to offer:
1. **View full report** — display the complete report
2. **Triage findings** — run smart triage to prioritize into Fix Now / Fix Later / Skip
3. **Apply suggested fixes** — for Critical/High issues with code fixes
4. **Done** — no further action

At **Full** scope, recommend triage by default — a deep review produces enough findings that prioritization pays off. At **Quick** scope, triage is usually unnecessary (the report is already just the showstoppers), so present it but do not push it.

#### If "Triage findings" is selected

Invoke the triage skill on the saved report. Use the `Skill` tool:
- skill: `agent-teams-review:triage`
- args: the saved report path from Step 10 (e.g. `docs/reviews/feature-auth-2026-03-16.md`)

The triage skill handles everything: loading the report, reading the Confidence/Effort markers, assessing each finding across its dimensions, classifying into Fix Now / Fix Later / Skip, smart grouping, and presenting results. After it completes, return to the action loop.

#### If "Apply suggested fixes" is selected

Show each Critical/High issue with its suggested fix. Let the user pick which to apply using `AskUserQuestion` with `multiSelect: true`. Apply the selected fixes.

#### If "View full report" is selected

Display the complete report.

### Step 12: Clean Up the Team

After all follow-up actions are done, release the team's shared resources so they do not linger:

1. Make sure all teammates have finished and are idle.
2. Shut down any remaining active teammates with `TaskStop`.
3. Remove the team with `TeamDelete`.

Only the lead (this session) runs cleanup — a teammate's team context may not resolve correctly.

## Error Handling

- If a teammate fails or times out, continue with the remaining teammates and note the failure in the report.
- If `git diff` fails, fall back to asking the user for specific file paths.
- If no code changes are found, inform the user and exit gracefully.
- If no reviewers are selected (user deselected all), warn and require at least Virtual Mariusz.
- If cleanup fails because teammates are still active, stop them with `TaskStop` first, then retry `TeamDelete`.
