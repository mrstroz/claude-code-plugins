---
name: commit
description: Create clean conventional commits. Use when the user wants to commit changes, make a commit, save progress, or says "commit". Enforces single-line conventional commit format with automatic task number detection from branch names. Never adds Co-Authored-By lines.
---

# Commit

Create clean, single-line conventional commits with automatic task number detection.

## Rules (strictly enforced)

1. **Never** include `Co-Authored-By` or any trailer lines in the commit
2. **Always** use a conventional commit type prefix
3. **Single-line only** — no body, no bullet points, no multi-line messages
4. Include task number after the colon when available: `type: TASK-123 summary`

## Commit Format

```
type: TASK-123 short lowercase summary   # Jira-style task number
type: #456 short lowercase summary       # GitHub-style issue number
type: short lowercase summary            # when no task number found
```

## Workflow

### Step 1 — Check for changes

Run `git status` to see staged and unstaged changes. If there are no changes at all, tell the user there is nothing to commit and **stop**.

### Step 2 — Detect task number

Run `git branch --show-current` to get the branch name. Try the following patterns **in order** (first match wins):

**Pattern A — Jira-style** (`[A-Z]{2,6}-\d+`):
An uppercase prefix of 2-6 letters, a hyphen, then one or more digits. Use the match as-is.

- `feature/TES-42-add-login-form` → `TES-42`
- `fix/RO-118-broken-sidebar` → `RO-118`
- `feature/PROJ-123-some-description` → `PROJ-123`
- `RO-55-update-dashboard` → `RO-55`

**Pattern B — GitHub-style** (plain number after `/`):
After the first `/`, look for a leading number followed by a hyphen (`*/digits-*`). Extract the digits and prepend `#`.

- `fix/456-bug-title` → `#456`
- `feature/123-add-login` → `#123`
- `chore/78-update-deps` → `#78`

If no pattern matches, check conversation context for a task/ticket reference. If still not found, proceed without a task number — do **not** ask the user for one.

### Step 3 — Review changes and recent style

Run these commands to understand what is being committed:

- `git diff --staged` — already staged changes
- `git diff` — unstaged changes (if any)
- `git log --oneline -5` — recent commit style for reference

### Step 4 — Stage files if needed

If there are unstaged changes and nothing is staged, ask the user via `AskUserQuestion`:

- **Header:** "Stage files"
- **Options:**
  - "Stage all changes" — run `git add -A`
  - "Only this session's changes" — stage only files that were created or modified during the current Claude Code conversation (check your tool call history for files you wrote/edited); ignore unrelated changes from other sessions
  - "Let me choose" — run `git status`, then ask the user which files to stage

If changes are already staged, skip this step.

### Step 5 — Generate commit message

Based on the diff, determine:

1. The conventional commit **type** (see table below)
2. A short lowercase **summary** describing *what* changed (imperative mood, no period)

Construct the message:
- With Jira task: `type: TASK-123 summary`
- With GitHub issue: `type: #456 summary`
- Without task: `type: summary`

### Step 6 — Confirm and commit

Present the commit message to the user and wait for explicit confirmation. Then execute:

```
git commit -m "the commit message"
```

Show the result of the commit. Do **not** push.

## Type Selection Guide

| Type       | When to use                                        |
|------------|----------------------------------------------------|
| `feat`     | New feature or capability                          |
| `fix`      | Bug fix                                            |
| `refactor` | Code restructuring without behavior change         |
| `chore`    | Maintenance, deps, config, tooling                 |
| `docs`     | Documentation only                                 |
| `style`    | Formatting, whitespace, missing semicolons         |
| `test`     | Adding or updating tests                           |
| `ci`       | CI/CD pipeline changes                             |
| `build`    | Build system or external dependency changes        |
| `perf`     | Performance improvement                            |

## Examples

```
feat: PROJ-123 add user avatar upload endpoint
fix: #456 prevent duplicate form submissions
refactor: extract validation logic into shared module
chore: update eslint config to v9
test: APP-89 add integration tests for payment flow
docs: add API rate limiting section to readme
```
