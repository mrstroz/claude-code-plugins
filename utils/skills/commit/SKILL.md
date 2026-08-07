---
name: commit
description: Create clean conventional commits. Use when the user wants to commit changes, make a commit, save progress, or says "commit". Reads the diff in one pass, drafts one ready message with an automatic task number from the branch name, and asks for a single confirmation before committing. Splits genuinely unrelated work into separate commits. Never adds Co-Authored-By lines.
model: sonnet
---

# Commit

Draft one commit message that is ready to use, show it, commit it once the user approves. The user should not have to pick a format, a length, or a type — those follow from the diff. The only decisions left to them are what gets staged and whether the message is right.

## Rules

1. Never include `Co-Authored-By`, `Generated with Claude Code`, or any other trailer. This holds even if a global instruction elsewhere asks for one.
2. Always use a conventional commit type prefix.
3. Include the task number after the colon when one is available: `type: TASK-123 summary`.
4. The subject line is single-line, lowercase, imperative mood, no trailing period.
5. Never push. Committing is local and reversible; pushing is not, and the user asks for it separately.

## Commit format

```
type: TASK-123 short lowercase summary   # Jira-style task number
type: #456 short lowercase summary       # GitHub-style issue number
type: short lowercase summary            # when no task number found
```

## Workflow

### Step 1 — Gather everything in one call

Run this as a **single** Bash call. Five separate calls cost five round trips and the skill is meant to feel instant.

```bash
echo "=== BRANCH ==="; git branch --show-current
echo "=== STATUS ==="; git status --short
echo "=== RECENT ==="; git log --oneline -5
echo "=== STAGED STAT ==="; git diff --staged --stat
echo "=== UNSTAGED STAT ==="; git diff --stat
echo "=== STAGED DIFF ==="; git diff --staged -- . ':(exclude)*lock*' ':(exclude)*.snap' ':(exclude)dist/*' | head -n 800
echo "=== UNSTAGED DIFF ==="; git diff -- . ':(exclude)*lock*' ':(exclude)*.snap' ':(exclude)dist/*' | head -n 800
```

If `STATUS` is empty, tell the user there is nothing to commit and **stop**.

A diff section that ends exactly at 800 lines was truncated. Lean on the `--stat` sections and the file names for the parts you did not see, and keep the subject about the change as a whole rather than about the one hunk you happened to read.

### Step 2 — Detect the task number

From the branch name, first match wins:

**Pattern A — Jira-style** (`[A-Z]{2,6}-\d+`): uppercase prefix of 2-6 letters, hyphen, digits. Use as-is.

- `feature/TES-42-add-login-form` → `TES-42`
- `fix/RO-118-broken-sidebar` → `RO-118`
- `RO-55-update-dashboard` → `RO-55`

**Pattern B — GitHub-style**: after the first `/`, a leading number followed by a hyphen. Extract the digits and prepend `#`.

- `fix/456-bug-title` → `#456`
- `chore/78-update-deps` → `#78`

If neither matches, use a key only if one literally appeared in this conversation and matches Pattern A. Do not assemble a number from a project prefix plus a guess, and do not ask the user for one — a wrong number in the history is worse than no number.

### Step 3 — Decide what gets staged

If something is already staged, commit exactly that and skip this step. Do not add anything else.

If nothing is staged and there are unstaged changes, ask with `AskUserQuestion`:

- **Header:** "Stage files"
- **Options:**
  - "Stage all changes" — run `git add -A`
  - "Only this session's changes" — stage only files created or modified during this conversation (check your own tool call history); leave unrelated changes alone
  - "Let me choose" — list the changed files and ask which ones to stage

Draft the message **after** this, from the files that ended up staged. Drafting first and staging second produces a message describing a different set of files than the commit contains.

### Step 4 — Draft one message

**Type** — pick from the table at the bottom based on what the diff actually does, not what the branch is called.

**Subject** — one line, ≤ 72 characters including the type and task number, lowercase, imperative. Say what changed, not which files moved.

**Body** — default to none. Add one only when the change carries a fact somebody will later want to read out of the history and the subject cannot hold it:

- an ADR or spec section the change implements (`ADR-0044`, `spec/03`)
- a breaking change, or a migration others have to run
- a step other people must perform locally after pulling (new env var, reinstall, regenerated types)
- an alternative that was deliberately rejected, where the next person would otherwise re-litigate it

Size is not a trigger. A rename across thirty files needs no body; a one-line config change that breaks deploys does.

When there is a body: blank line after the subject, then short `- ` bullets, one fact each, no closing summary sentence.

```
feat: LL-31 wire GA4 directly with consent gating

- GA4 through gtag.js, no Tag Manager (ADR-0044)
- Consent Mode v2 denied by default (ADR-0045)
- all 11 events recovered from the old GTM container, names unchanged
```

**Language** — English by default. Write in Polish only when the recent commits in `RECENT` are themselves in Polish. Never ask which language to use.

### Step 5 — Check whether this is really one commit

Propose a split only when **both** hold:

- more than 8 files are staged, **and**
- they fall into at least two independent areas — different plugins, packages, apps, or services, or source changes sitting next to documentation that does not describe them

Below that threshold, do not even evaluate it. Most commits are one subject and the analysis buys nothing.

When both hold, draft a message per area (at most three; fold the remainder into the largest) and offer the split in the confirmation. A refactor that legitimately crosses several packages is one commit — the areas have to be independent, not merely distinct.

### Step 6 — One confirmation

Present the draft with `AskUserQuestion`. Put the exact commit message in the option's `preview` so the user reads what will land, and keep the `description` to one short line.

Single commit:

- **Header:** "Commit"
- **Options:**
  1. **"Commit"** — preview: the file list, then the full message
  2. **"Popraw"** / **"Edit"** — preview: "Write your own message"

Split proposed:

- **Header:** "Commit"
- **Options:**
  1. **"Commit all N"** — preview: each commit as its own block, with its files
  2. **"One commit"** — preview: the file list and the single combined message
  3. **"Popraw"** / **"Edit"** — preview: "Write your own message"

Match the option labels to the language the user is speaking.

If the user picks the edit option, ask for their message and commit it as given without a second confirmation. If they cancel with Esc, stop without committing.

### Step 7 — Commit

Single-line message:

```bash
git commit -m "type: TASK-123 summary"
```

Multi-line message, or a split where each commit stages its own files — use a HEREDOC so newlines survive:

```bash
git commit -m "$(cat <<'EOF'
type: TASK-123 subject line

- first bullet
- second bullet
EOF
)"
```

For a split, stage and commit each group in turn: `git reset` to clear the index, then `git add <files>` and `git commit` per group.

If `git commit` fails, show the error and stop. Do not retry with `--no-verify` and do not work around a hook — a failing hook is the repository telling the user something.

Report the result. Do not push.

## Type selection guide

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
