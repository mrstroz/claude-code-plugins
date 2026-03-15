---
name: jira-testing-release
description: Generate testing scenarios for a Jira release version. Combines Jira issue descriptions with git diff analysis (Quality vs Master) to produce a concise table of what needs manual testing before release. Use when the user wants testing scenarios, a test plan, QA checklist, release testing guide, or pre-release verification. Triggers on any request mentioning testing release, test scenarios, QA plan, release testing, what to test, pre-release checklist, or testing before deployment.
argument-hint: "[version number]"
---

# JIRA Testing Release — Scenario Generator

Generate a concise testing guide for a release version by combining Jira issue data with git diff analysis. Produces a table of what changed and what to verify — descriptive scenarios, not step-by-step scripts.

## Workflow

1. **Initial setup** — Ask language and branch configuration via `AskUserQuestion`
2. **Resolve JIRA project** — Auto-discover the project via MCP tools
3. **Collect version info** — Determine which version to generate scenarios for
4. **Search Jira issues by version** — Lightweight metadata only
5. **Extract issue details** — Fetch and condense descriptions via subagents
6. **Analyze git diff** — Compare feature branch vs main branch to identify changed files
7. **Correlate and generate scenarios** — Match file changes to issues and produce testing scenarios
8. **Compose testing document** — Assemble the final table with optional risk sections
9. **Present draft for review** — Show the document and ask for confirmation
10. **Output** — Deliver as markdown

---

## Initial Setup (Step 1)

Use a single `AskUserQuestion` call with three questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Feature branch** (header: "Feature branch"): The branch containing release changes (default: `quality`). Pre-fill with current branch if it is not `master`/`main`.
- **Base branch** (header: "Base branch"): The branch to compare against (default: `master`)

If `$ARGUMENTS` contains a version number (e.g., `2.1.0`, `v3.0`), extract it for use in Step 3.

Use the selected language for the entire document. Translate section headers according to the translations in [references/format.md](references/format.md).

## Resolve JIRA Project (Step 2)

Auto-discover the JIRA project — do not ask the user for cloudId or projectKey.

1. Call `getAccessibleAtlassianResources` to get the available cloud instances. Use the first (or only) instance as the cloudId.
2. Call `getVisibleJiraProjects` to list all projects in the instance.
3. If only one project exists, use it automatically.
4. If multiple projects exist, pick the most likely match based on context (version numbers from `$ARGUMENTS`, current git repo name) or present them via `AskUserQuestion` (header: "Project").

Store the resolved `cloudId`, `projectKey`, and the cloud base URL (e.g., `https://mycompany.atlassian.net`) for the rest of the session.

---

## Collect Version Info (Step 3)

If a version was extracted from `$ARGUMENTS`, use it directly.

If no version was provided:
1. Use JQL to discover versions with issues: `project = {projectKey} AND fixVersion IS NOT EMPTY ORDER BY fixVersion DESC` (fields: `["summary", "fixVersion"]`). Extract unique fixVersion values.
2. Present discovered versions to the user via `AskUserQuestion` (header: "Version") as selectable options.
3. Allow free text input for a version not in the list.

## Search Jira Issues by Version (Step 4)

Use the available MCP tool for JQL search with lightweight metadata fields only. Do not request `description` here — on versions with many issues the combined payload can exceed MCP size limits.

```
project = {projectKey} AND fixVersion = "{version}" ORDER BY priority DESC, issuetype ASC
fields: ["summary", "status", "issuetype", "priority", "labels", "components"]
maxResults: 100
```

If more than 100 issues exist, use the `nextPageToken` to paginate through all results.

From each result, collect: `key`, `summary`, `issuetype`, `priority`, `status`, `labels`, `components`.

## Extract Issue Details via Subagents (Step 5)

Descriptions are essential for understanding what each task does and generating accurate testing scenarios. Instead of fetching them into the main context, delegate extraction to subagents that return only condensed testing-relevant summaries. Comments are not needed — we care about what was built, not the discussion.

### Prioritization Cap

If more than 30 issues exist, select the top 30 for extraction:
1. Epic / Story / Feature (all priorities)
2. Blocker / Critical bugs
3. Remaining issues by priority descending

For issues beyond the 30-issue cap, generate scenarios from the `summary` field collected in Step 4 alone.

### Subagent Extraction

Follow the orchestration pattern in [extraction pattern](../_shared/extraction-pattern.md) to batch issue keys and spawn `jira:issue-extractor` subagents.

Use this skill-specific extraction template in each agent prompt:

```
Fields to fetch: ["description"]

For each issue, determine:
1. What was built or changed? (the core functionality)
2. What should be tested from a user's perspective? (key verification points)
3. What are edge cases or risk areas? (max 3 items)

Return format (one line per issue):
{KEY}: {what-changed} | {what-to-test} | {edge-cases, max 3 comma-separated items}
```

### Using Extracted Data

The subagents return condensed testing signals — one line per issue. Use these together with the metadata from Step 4 and the git diff analysis from Step 6 to generate scenarios in Step 7.

---

## Analyze Git Diff (Step 6)

Compare the feature branch against the base branch (from Step 1) to understand what code actually changed.

### 6a. Get Changed Files

Run:
```bash
git diff {baseBranch}...{featureBranch} --name-only
```

If the command fails (branches not found, not a git repo), skip git analysis entirely and generate scenarios from Jira data alone. Inform the user that git analysis was skipped.

### 6b. Get Change Statistics

Run:
```bash
git diff {baseBranch}...{featureBranch} --stat
```

This provides lines added/removed per file — useful for identifying high-change areas.

### 6c. Group Changed Files by Area

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

### 6d. Identify High-Change Areas

Flag areas where:
- A single file has more than 100 lines changed
- A directory has more than 5 files changed
- New files were added (potential new features not yet tested)

These become candidates for the "High Risk Areas" section in the output.

---

## Correlate and Generate Scenarios (Step 7)

This is the core step — combine Jira data with git analysis to produce testing scenarios.

### 7a. Match Files to Issues

For each Jira issue, attempt to correlate with changed files using:
- Component names from Jira matching directory/file paths
- Keywords from the issue summary matching file names or paths
- Labels matching area classifications from Step 6c

This correlation is best-effort — not every issue will have a clear file match, and that is fine.

### 7b. Generate One Scenario Per Issue

For each issue, produce a testing scenario that answers: **"What changed and what should the tester verify?"**

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

### 7c. Detect Uncovered Changes

After matching, identify files from the git diff that do not correlate with any Jira issue. These are "uncovered changes" — code that changed but has no corresponding task describing what was intended.

Group uncovered files by area (from Step 6c) and flag them for tester attention. These changes might be:
- Refactoring (safe but worth noting)
- Undocumented fixes (need testing)
- Dependencies of other changes (implicit impact)

---

## Compose Testing Document (Step 8)

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

## Present Draft for Review (Step 9)

Present the complete testing document inside a clearly marked block and use `AskUserQuestion` (header: "Review"):

- **Looks good — save** (Recommended)
- **Adjust scenarios** — let me refine the testing descriptions
- **Add/remove tasks** — let me change which tasks are included
- **Start over** — discard and begin from scratch

If the user asks for adjustments, apply changes and present the updated draft again. Repeat until the user confirms.

## Output (Step 10)

Present the final testing document in a code block and suggest saving to a file:

> Your testing scenarios are ready. Want me to save them to `docs/testing/testing-release-{version}.md`?

If the user confirms, write the file.
