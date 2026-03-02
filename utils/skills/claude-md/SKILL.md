---
name: claude-md
description: Analyze session changes and propose CLAUDE.md updates. Use when the user says "update claude.md", "sync claude.md", "document this in claude.md", after finishing a task that introduced new patterns or conventions, when new tools/commands/dependencies were added, or when project architecture changed. Do NOT trigger for simple questions about CLAUDE.md content, reading CLAUDE.md, or general project questions.
---

# CLAUDE.md Updater

Analyze session changes and propose targeted CLAUDE.md updates following Anthropic's best practices.

## Rules (strictly enforced)

1. **Never** add code examples or code blocks to CLAUDE.md — agents can read source code directly
2. **Keep CLAUDE.md concise** — target 200 lines for small/medium projects, up to 500 for large monorepos; every line must earn its place
3. **Write in imperative form** — "Run tests with `npm test`" not "Tests are run with `npm test`"
4. **Concrete over vague** — ban the words "properly", "correctly", "appropriate", "as needed", "ensure quality"
5. **Only document surprises** — skip anything an agent could infer from reading the code, package.json, or directory structure
6. **No sensitive data** — never include secrets, tokens, credentials, API keys, or internal URLs
7. **Always confirm with user** before writing any changes to CLAUDE.md

## Workflow

### Step 1 — Gather session changes

Run these commands to understand what changed during the session:

- `git branch --show-current` — current branch
- `git diff HEAD` — unstaged changes
- `git diff --staged` — staged changes
- `git log --oneline -10` — recent commits

Then determine the merge-base to capture the full session scope (committed + uncommitted work):

- `git merge-base HEAD main` (or the default branch) — find where the branch diverged
- `git diff <merge-base>..HEAD` — all committed changes in this session

If not a git repo, fall back to reviewing the conversation tool history for files created, edited, or written during this session.

### Step 2 — Read existing CLAUDE.md

Look for `CLAUDE.md` at the project root. If found:

- Read the full file
- Note the current line count
- Identify existing sections and their content
- Flag any overlap with what the session changes might add

If no CLAUDE.md exists, note that a new file needs to be created.

### Step 3 — Identify update triggers

Evaluate the session diff against the trigger categories in the table below. For each category, determine if the changes warrant a CLAUDE.md entry.

If **no triggers fire** — tell the user "No CLAUDE.md update needed — these changes don't introduce anything that would surprise a future agent." and **stop**.

### Step 4 — Draft the update

**If creating a new CLAUDE.md**, use this section template (omit sections that have no content):

- Project Overview
- Tech Stack
- Commands
- Architecture
- Code Style
- Environment
- Gotchas

**If updating an existing CLAUDE.md**, draft only targeted additions or edits to existing sections. Do not rewrite sections that are unchanged.

Writing rules for all entries:

- One bullet per concept
- Start with imperative verb
- No sub-bullets or nested lists
- No code blocks (inline backticks for commands and names are fine)
- Maximum 2 lines per entry
- Check total line count stays within budget (200 for small/medium projects, up to 500 for large monorepos)

### Step 5 — Present for review

Show the complete draft to the user, then use `AskUserQuestion` with these options:

- **Header:** "CLAUDE.md"
- **Options:**
  - "Apply this update" — write the changes to CLAUDE.md
  - "Let me refine the draft" — user will provide edits before applying
  - "Skip — no update needed" — discard the draft and stop

### Step 6 — Write the file

Apply the approved changes to CLAUDE.md at the project root. After writing, confirm the action and report the final line count.

## Update Trigger Categories

| Category | Fires when | Does NOT fire when |
|---|---|---|
| **Commands** | New build/test/lint/deploy commands added, existing commands changed, new scripts in package.json | Existing commands used without changes |
| **Tech Stack** | New language, framework, or major dependency added; runtime version changed | Minor dependency updates, patch bumps |
| **Architecture** | New top-level directories, new module boundaries, new API patterns, significant structural refactors | Moving files within existing structure, renaming |
| **Code Style** | New lint rules enforced, new naming conventions established, new formatting config | One-off style fixes, auto-formatter runs |
| **Environment** | New env vars required, new services to run locally, new setup steps | Config value changes, port number tweaks |
| **Gotchas** | Non-obvious workarounds discovered, surprising behavior documented, platform-specific quirks | Obvious bugs that were fixed, temporary hacks removed |
| **Testing** | New test framework, new test commands, new coverage requirements, testing patterns established | Adding individual test files, fixing tests |
| **Project Overview** | Project purpose or scope changed significantly, new major feature area | README updates, minor scope adjustments |

## CLAUDE.md Quality Checklist

Before presenting the draft in Step 5, verify:

- No duplicate entries (check against existing content)
- No fragile absolute file paths (use relative paths or describe locations)
- No code blocks (only inline backticks)
- No vague words ("properly", "correctly", "as needed", "ensure")
- All commands are explicit and runnable
- All required environment variables are named
- Total line count is within budget (200 small/medium, up to 500 large monorepos)
