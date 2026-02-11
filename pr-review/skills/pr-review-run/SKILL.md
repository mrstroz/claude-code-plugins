---
name: pr-review-run
description: Run a comprehensive multi-agent PR review on code changes. Use when the user asks to review a PR, review code changes, review a branch, run a code review, or check code before merging. Supports git diff comparisons, specific file review, and directory-level review. Orchestrates 7 specialized agents (architecture, code quality, bugs, security, tests, performance, acceptance) in parallel and produces an aggregated report with verdict.
---

# PR Review Orchestrator

## Workflow

### Step 1: Gather Review Context

Collect the review target from `$ARGUMENTS`.

**Supported input modes:**
1. **Git diff** — branch comparison (e.g. `main..HEAD`)
2. **Specific files** — list of file paths
3. **Directory** — all source files in a directory

If no arguments provided, use `AskUserQuestion` to ask:
- What branch or files to review
- Whether there is a task/ticket with requirements (needed for Acceptance Checker agent)

### Step 2: Collect Code Changes

**Git diff mode:**
```bash
git diff <base-branch>..HEAD --name-only  # changed file list
git diff <base-branch>..HEAD              # full diff
```

**Specific files:** Read each file directly.

**Directory:** List and read source files, excluding `node_modules`, `dist`, `build`, `.git`, etc.

### Step 3: Select Agents

**Core agents (always run):**
- `pr-review:code-cleaner`
- `pr-review:bug-smasher`

**Conditional agents:**

| Agent | Trigger Condition |
|-------|-------------------|
| `pr-review:architect-visioner` | New files > 2 OR lines changed > 100 OR new module/class |
| `pr-review:acceptance-checker` | Task requirements provided by user |
| `pr-review:security-guard` | Files contain: auth, login, password, token, api, input, form, sql, query, env, secret, key |
| `pr-review:test-guardian` | Test files in diff (*.test.*, *.spec.*, __tests__/*) |
| `pr-review:performance-scout` | Files contain: database, query, loop, map, filter, reduce, fetch, api, cache |

After auto-selection, show the user which agents are selected and which are skipped (with reasons). Use `AskUserQuestion` with `multiSelect` to let the user override the selection.

### Step 4: Run Agents in Parallel

**CRITICAL:** Run ALL selected agents in a SINGLE message using multiple Task tool calls.

For each agent, read its full definition from `agents/{agent-name}.md` and include it in the prompt. The agent definitions contain scope boundaries, review methodology, and output format — without them the agents cannot perform a proper review.

Provide each agent with this prompt structure:

```
Review the following code changes:

## Files Changed
[list of files]

## Code Diff
[full diff or file contents]

## Project Context
[CLAUDE.md content if it exists]

## Agent Definition
[Full content of agents/{agent-name}.md — includes role, scope boundaries, methodology, and output format]
```

For `pr-review:acceptance-checker`, also include the task requirements from step 1.

### Step 5: Aggregate Results

1. Collect all findings from completed agents
2. Deduplicate overlapping issues (apply deduplication rules from [references/output-format.md](references/output-format.md))
3. Sort by severity: Critical → High → Medium → Low
4. Calculate totals for the summary table
5. Determine verdict using the decision matrix from [references/output-format.md](references/output-format.md)

### Step 6: Format Report

Format the aggregated findings using the report template and rules from [references/output-format.md](references/output-format.md). See [references/example-report.md](references/example-report.md) for a complete example.

### Step 7: Save Report

Save the formatted report to:
```
docs/pr-reviews/{branch-name}-{YYYY-MM-DD}.md
```

Create the `docs/pr-reviews/` directory if it does not exist.

### Step 8: Present Results and Offer Actions

Display the executive summary (verdict + severity counts + report path).

Use `AskUserQuestion` to offer:
1. **View full report** — display the complete report
2. **Apply suggested fixes** — for Critical/High issues
3. **Done** — no further action

If "Apply suggested fixes" is selected:
- Show each Critical/High issue with its suggested fix
- Let the user pick which fixes to apply
- Apply selected fixes to the code

## Error Handling

- If an agent fails, continue with the remaining agents and note the failure in the report
- If `git diff` fails, fall back to asking the user for specific file paths
- If no code changes are found, inform the user and exit gracefully
