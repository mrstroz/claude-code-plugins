---
name: commit
description: Create clean conventional commits. Use when the user wants to commit changes, make a commit, save progress, or says "commit". Offers three message variants (short, descriptive, multi-line) with live preview, automatic task number detection from branch names, and conventional commit prefixes. Never adds Co-Authored-By lines.
model: haiku
---

# Commit

Create clean conventional commits with automatic task number detection. Offer the user three message variants and let them pick with a live preview.

## Rules (strictly enforced)

1. **Never** include `Co-Authored-By` or any trailer lines in the commit
2. **Always** use a conventional commit type prefix
3. Include task number after the colon when available: `type: TASK-123 summary`
4. The subject line stays single-line and lowercase; only the multi-line variant adds a body

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

### Step 5 — Generate three commit message variants

Based on the diff, determine:

1. The conventional commit **type** (see table below)
2. The task/issue prefix to embed after the colon (Jira `TASK-123`, GitHub `#456`, or none)

Then craft **three** variants of the message. All three share the same `type:` and task prefix; they differ in length and shape:

- **Variant 1 — Short:** the current concise style. One short lowercase summary in imperative mood, no period. Aim for ≤ 72 characters total.
- **Variant 2 — Descriptive:** a longer single-line subject that names the key change(s) more explicitly. Useful for larger or multi-faceted commits where the short summary loses important nuance. Still one line, still lowercase, no period.
- **Variant 3 — Multi-line:** a short subject line (same shape as Variant 1) followed by a blank line and a body. The body uses 1–5 short bullet points (`- `) describing what changed and why, in plain language. Use this for substantial changes that benefit from explanation.

Examples:

```
# Variant 1 — Short
feat: PROJ-123 add avatar upload endpoint

# Variant 2 — Descriptive
feat: PROJ-123 add avatar upload endpoint with size validation and S3 storage

# Variant 3 — Multi-line
feat: PROJ-123 add avatar upload endpoint

- accept multipart uploads up to 5 MB
- validate mime type and reject non-image payloads
- store files in S3 under user-scoped prefixes
- return signed URL in the response
```

### Step 6 — Let the user pick a variant

Use `AskUserQuestion` to present the three variants. The picker shows the option label on the left and the option **description** as a live preview on the right as the user moves between options — put the full commit message into each option's description so the user sees exactly what will be committed.

- **Header:** "Pick commit message"
- **Options (in this order):**
  1. **Label:** "Short" — **Description:** the full Variant 1 message
  2. **Label:** "Descriptive" — **Description:** the full Variant 2 message
  3. **Label:** "Multi-line" — **Description:** the full Variant 3 message (subject + blank line + bullets)
  4. **Label:** "Edit message" — **Description:** "Provide your own message"

If the user picks "Edit message", ask them for the corrected message and then commit it directly without re-confirming. If the user cancels the picker (Esc), stop without committing.

### Step 7 — Commit

For single-line variants (Short, Descriptive, or a single-line edited message):

```
git commit -m "the commit message"
```

For the multi-line variant (or a multi-line edited message), use a HEREDOC so newlines are preserved:

```
git commit -m "$(cat <<'EOF'
type: TASK-123 subject line

- first bullet
- second bullet
EOF
)"
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
