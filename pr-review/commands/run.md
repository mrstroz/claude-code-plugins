---
description: Comprehensive PR review using specialized agents for architecture, code quality, bugs, security, tests, and performance
---

# PR Review Orchestrator

This command orchestrates multiple specialized review agents to provide comprehensive code review.

## Workflow

### Step 1: Gather Review Context

Collect information about what to review from `$ARGUMENTS`:

**Supported input modes:**
1. **Git diff (local):** `git diff main..HEAD` or specific branch comparison
2. **Specific files:** List of file paths to review
3. **Directory:** Review all files in a directory

If no arguments provided, ask the user:
- What branch/files to review?
- Is there a task/ticket with requirements? (for Acceptance Checker)

**CRITICAL:** Use the `AskUserQuestion` tool to gather this information.

### Step 2: Collect Code Changes

Based on input mode, gather the code to review:

**For git diff:**
```bash
git diff <base-branch>..HEAD --name-only  # Get changed files
git diff <base-branch>..HEAD              # Get full diff
```

**For specific files:**
Read each specified file.

**For directory:**
List and read relevant source files (exclude node_modules, dist, etc.).

### Step 3: Analyze Scope and Select Agents

Determine which agents to run based on the changes:

**ALWAYS RUN (Core Agents):**
- `pr-review:code-cleaner` - Always needed
- `pr-review:bug-smasher` - Always needed

**CONDITIONAL AGENTS:**

| Agent | Trigger Condition |
|-------|-------------------|
| `pr-review:architect-visioner` | New files > 2 OR lines changed > 100 OR new module/class |
| `pr-review:acceptance-checker` | Task requirements provided by user |
| `pr-review:security-guard` | Files contain: auth, login, password, token, api, input, form, sql, query, env, secret, key |
| `pr-review:test-guardian` | Test files in diff (*.test.*, *.spec.*, __tests__/*) |
| `pr-review:performance-scout` | Files contain: database, query, loop, map, filter, reduce, fetch, api, cache |

**User Override:**
After auto-selection, show the user which agents will run and ask if they want to modify:

```
Selected agents based on changes:
✅ Code Cleaner (always)
✅ Bug Smasher (always)
✅ Security Guard (detected: auth-related code)
⬜ Architect Visioner (small change)
⬜ Acceptance Checker (no requirements provided)
⬜ Test Guardian (no test files)
⬜ Performance Scout (no performance-sensitive code)

Would you like to modify this selection?
```

**CRITICAL:** Use `AskUserQuestion` tool with multiSelect to let user override.

### Step 4: Run Selected Agents in Parallel

**CRITICAL:** You MUST run all selected agents in PARALLEL using multiple Task tool calls in a SINGLE message.

For each selected agent, invoke it with:
- The code diff/files to review
- Context about the project (from CLAUDE.md if exists)
- Task requirements (for Acceptance Checker only)

Example parallel invocation:
```
Task 1: pr-review:code-cleaner - Review code for: [files/diff]
Task 2: pr-review:bug-smasher - Review code for: [files/diff]
Task 3: pr-review:security-guard - Review code for: [files/diff]
[All in single message]
```

**Agent Prompts:**

Each agent should receive:
```
Review the following code changes:

## Files Changed
[list of files]

## Code Diff
[full diff or file contents]

## Project Context
[CLAUDE.md content if exists]

## Your Scope
You are the [Agent Name]. Focus ONLY on [agent scope].
Do NOT comment on issues outside your scope - other agents handle those.

Provide your findings in the format specified in your agent definition.
```

### Step 5: Aggregate Results

Once all agents complete, combine their reports:

1. **Collect all findings** from each agent
2. **Deduplicate** overlapping issues (same location, similar description)
3. **Sort by severity** (Critical → High → Medium → Low)
4. **Calculate totals** for summary table
5. **Determine verdict** based on severity matrix:

| Critical | High | Verdict |
|----------|------|---------|
| > 0 | any | ❌ Blocked |
| 0 | > 3 | 🔶 Changes Requested |
| 0 | 1-3 | ⚠️ Approved with Comments |
| 0 | 0 | ✅ Approved |

### Step 6: Format Final Report

Use the `pr-review:pr-review-output` skill to format the aggregated report.

The report must include:
- Executive summary with verdict
- All Critical and High issues in detail
- Medium/Low issues in summary tables
- Positive observations from each agent
- Full agent reports in collapsible sections
- Actionable checklist

### Step 7: Save Report

Save the formatted report to:
```
docs/pr-reviews/{branch-name}-{YYYY-MM-DD}.md
```

Create the `docs/pr-reviews/` directory if it doesn't exist.

### Step 8: Present Results and Offer Actions

Display the executive summary to the user and ask:

```
PR Review Complete!

Verdict: [verdict]
Critical: X | High: X | Medium: X | Low: X

Full report saved to: docs/pr-reviews/[filename].md

Would you like to:
1. View full report
2. Apply suggested fixes (for Critical/High)
3. Done - no further action
```

**CRITICAL:** Use `AskUserQuestion` tool for this.

If user selects "Apply suggested fixes":
- Show each Critical/High issue with its fix
- Ask which fixes to apply
- Apply selected fixes to the code

## Important Notes

1. **Parallel Execution is Critical** - Always run agents in parallel for efficiency
2. **Respect Agent Scope** - Each agent prompt must emphasize staying in their lane
3. **User Control** - Always allow user to override agent selection
4. **Actionable Output** - Every issue must have a concrete fix recommendation
5. **Save Reports** - Always save the full report for future reference

## Error Handling

- If an agent fails, continue with other agents and note the failure
- If git diff fails, fall back to asking for specific files
- If no code changes found, inform user and exit gracefully
