---
name: jira-testing-release
description: Generate testing scenarios for a Jira release version. Combines Jira issue descriptions with git diff analysis (Quality vs Master) to produce a concise table of what needs manual testing before release. Use when the user wants testing scenarios, a test plan, QA checklist, release testing guide, or pre-release verification. Triggers on any request mentioning testing release, test scenarios, QA plan, release testing, what to test, pre-release checklist, or testing before deployment.
argument-hint: "[version number]"
---

# JIRA Testing Release — Scenario Generator

Generate a concise testing guide for a release version by combining Jira issue data with git diff analysis. Produces a table of what changed and what to verify — descriptive scenarios, not step-by-step scripts. Uses the `jira-fetch` script to pull all issue data via REST API in one call — no MCP overhead, no subagents, no token waste.

## Workflow

1. **Initial setup** — Ask language and branch configuration via `AskUserQuestion`
2. **Resolve JIRA project** — Get domain and project key from CLAUDE.md or ask user
3. **Fetch issue data** — Run `jira-fetch` script to get all issues for the version
4. **Analyze git diff** — Compare feature branch vs main branch to identify changed files
5. **Correlate and generate scenarios** — Match file changes to issues and produce testing scenarios
6. **Compose testing document** — Assemble the final table with optional risk sections
7. **Present draft for review** — Show the document and ask for confirmation
8. **Output** — Deliver as markdown

---

## Initial Setup (Step 1)

Use a single `AskUserQuestion` call with three questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Feature branch** (header: "Feature branch"): The branch containing release changes (default: `quality`). Pre-fill with current branch if it is not `master`/`main`.
- **Base branch** (header: "Base branch"): The branch to compare against (default: `master`)

If `$ARGUMENTS` contains a version number (e.g., `2.1.0`, `v3.0`), extract it for use in Step 3.

Use the selected language for the entire document. Translate section headers according to the translations in [references/format.md](references/format.md).

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

## Fetch Issue Data (Step 3)

This single step replaces the old search + subagent extraction pattern. The `jira-fetch` script fetches all issues with full descriptions and comments in one call, returning a minimal JSON file with plaintext data ready for scenario generation.

### Locate Script

Find the fetch script via Glob:

```
pattern: **/jira-fetch/scripts/fetch-issues.mjs
```

### Determine Version and Fetch

**If a version was extracted from `$ARGUMENTS`**, run a targeted fetch:

```bash
node "${SCRIPT_PATH}" \
  --domain "${DOMAIN}" \
  --jql "project = ${PROJECT_KEY} AND fixVersion = \"${VERSION}\" ORDER BY priority DESC, issuetype ASC" \
  --output "/tmp/jira-testing-release-${VERSION}-$(date +%Y%m%d-%H%M%S).json"
```

**If no version was provided**, discover available versions first:

```bash
node "${SCRIPT_PATH}" \
  --domain "${DOMAIN}" \
  --jql "project = ${PROJECT_KEY} AND fixVersion IS NOT EMPTY ORDER BY fixVersion DESC" \
  --output "/tmp/jira-testing-versions-$(date +%Y%m%d-%H%M%S).json"
```

Read the JSON output and extract unique version names from the `fixVersions` field across all issues. Present discovered versions to the user via `AskUserQuestion` (header: "Version") as selectable options. Allow free text input for a version not in the list.

After the user selects a version, filter the already-fetched data to keep only issues where `fixVersions` includes the selected version. No second fetch needed — the discovery data already contains full issue details.

If the script fails, show the error and stop. Common issues: missing `JIRA_EMAIL` or `JIRA_API_TOKEN` env vars.

### Read and Parse

The JSON output contains per issue: `key`, `type`, `status`, `priority`, `assignee`, `reporter`, `labels`, `fixVersions`, `components`, `summary`, `created`, `updated`, `description` (plaintext), `comments[]` (with `author`, `created`, `body` as plaintext).

From the fetched (or filtered) data, collect for each issue: `key`, `summary`, `type`, `priority`, `status`, `labels`, `components`, `description`. Comments are available but not typically needed for testing scenarios — we care about what was built, not the discussion.

---

## Analyze Git Diff (Step 4)

Compare the feature branch against the base branch (from Step 1) to understand what code actually changed.

### 4a. Get Changed Files

Run:
```bash
git diff {baseBranch}...{featureBranch} --name-only
```

If the command fails (branches not found, not a git repo), skip git analysis entirely and generate scenarios from Jira data alone. Inform the user that git analysis was skipped.

### 4b. Get Change Statistics

Run:
```bash
git diff {baseBranch}...{featureBranch} --stat
```

This provides lines added/removed per file — useful for identifying high-change areas.

### 4c. Group Changed Files by Area

Classify each changed file into an area based on its path and extension:

| Path patterns | Area |
|---------------|------|
| `*/components/*`, `*/views/*`, `*/pages/*`, `*.vue`, `*.tsx`, `*.jsx`, `*.css`, `*.scss` | Frontend / UI |
| `*/api/*`, `*/controllers/*`, `*/routes/*`, `*/endpoints/*` | API |
| `*/services/*`, `*/models/*`, `*/repositories/*`, `*/domain/*` | Backend / Business Logic |
| `*/migrations/*`, `*.sql`, `*/schema/*` | Database |
| `*/tests/*`, `*/test/*`, `*spec*`, `*test*` | Tests |
| `*.config.*`, `*.yml`, `*.yaml`, `*.env*`, `Dockerfile`, `docker-compose*` | Configuration / Infrastructure |
| Everything else | Other |

### 4d. Identify High-Change Areas

Flag areas where:
- A single file has more than 100 lines changed
- A directory has more than 5 files changed
- New files were added (potential new features not yet tested)

These become candidates for the "High Risk Areas" section in the output.

---

## Correlate and Generate Scenarios (Step 5)

This is the core step — combine Jira data with git analysis to produce testing scenarios.

### 5a. Match Files to Issues

For each Jira issue, attempt to correlate with changed files using:
- Component names from Jira matching directory/file paths
- Keywords from the issue summary matching file names or paths
- Labels matching area classifications from Step 4c

This correlation is best-effort — not every issue will have a clear file match, and that is fine.

### 5b. Generate One Scenario Per Issue

For each issue, produce a testing scenario that answers: **"What changed and what should the tester verify?"**

Use the `description` field from the JSON data to understand what each task does and generate accurate testing scenarios. Having descriptions available directly (instead of summary alone) enables more precise and useful scenarios.

Scenario writing rules:
- **Descriptive, not procedural** — describe the function and what to check, not click-by-click steps
- **2-3 bullet points per scenario** covering: the main change, edge cases to watch for, and any integration points
- **Max 60 words per scenario** — concise enough to scan quickly
- **User-visible focus** — describe behavior from the end user's perspective
- **Include risk context** — if git diff shows many file changes for this issue, mention the breadth of impact

Examples of good scenarios:
- "Verify that the new date range filter on the orders page returns correct results. Check edge cases: empty date range, future dates, very old dates. Confirm that existing saved filters still work."
- "Check that the updated payment flow completes successfully for all payment methods. Verify error messages display correctly when payment fails. Test with both new and returning customers."

Examples of bad scenarios (too detailed / step-by-step):
- "1. Go to Orders page 2. Click the Date Filter dropdown 3. Select 'Custom Range' 4. Enter start date 01/01/2025 5. Enter end date 03/01/2025 6. Click Apply..."

### 5c. Detect Uncovered Changes

After matching, identify files from the git diff that do not correlate with any Jira issue. These are "uncovered changes" — code that changed but has no corresponding task describing what was intended.

Group uncovered files by area (from Step 4c) and flag them for tester attention. These changes might be:
- Refactoring (safe but worth noting)
- Undocumented fixes (need testing)
- Dependencies of other changes (implicit impact)

---

## Compose Testing Document (Step 6)

Assemble the final document following the structure defined in [references/format.md](references/format.md).

```markdown
# [Project] Testing Scenarios — Version X.Y.Z
**Version:** X.Y.Z | **Branches:** {featureBranch} vs {baseBranch} | **Generated:** {date}

## Summary
{X} tasks to test | {Y} files changed | {Z} uncovered changes

## Testing Scenarios

| Task | Testing Scenario |
|------|-----------------|
| [PROJ-123](url) | **Order date filtering** |
| Story · High · In Progress | Verify that the new date range filter... |
| [PROJ-124](url) | **Payment flow update** |
| Bug · Critical · Done | Check that the updated payment flow... |

## High Risk Areas *(if applicable)*
[Areas with many file changes that deserve extra attention]

## Uncovered Changes *(if applicable)*
[Files that changed without a corresponding Jira task]
```

Full example: [references/example.md](references/example.md)

### Condensation

If a version has more than 20 tasks:
- Group Sub-tasks, Minor/Trivial bugs, and Chores into a single "Additional minor changes" row pair:
  `| — | **{count} additional minor changes** |`
  `| Minor tasks | Routine fixes across {areas}. Spot-check for regressions. |`
- Keep individual scenario row pairs for Epic, Story, Feature, and Major+ bugs only
- Limit each scenario to 1-2 sentences (max 40 words)
- Target: no more than 25 visible row pairs in the table

---

## Present Draft for Review (Step 7)

Present the complete testing document inside a clearly marked block and use `AskUserQuestion` (header: "Review"):

- **Looks good — save** (Recommended)
- **Adjust scenarios** — let me refine the testing descriptions
- **Add/remove tasks** — let me change which tasks are included
- **Start over** — discard and begin from scratch

If the user asks for adjustments, apply changes and present the updated draft again. Repeat until the user confirms.

## Output (Step 8)

Present the final testing document in a code block and suggest saving to a file:

> Your testing scenarios are ready. Want me to save them to `docs/testing/testing-release-{version}.md`?

If the user confirms, write the file.
