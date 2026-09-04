---
name: jira-fetch
description: Fetch JIRA issues matching a request and save them as a minimal JSON file — descriptions and comments as Markdown, nested objects flattened, ready for offline analysis or for another skill to read. Use when the user wants to download, fetch, pull, export, or cache JIRA data locally. Triggers on requests to fetch issues, download tasks, export JIRA data, get issues from JIRA, pull sprint/version/project data, cache JIRA issues, dump JIRA to file, or any variation like "give me data from JIRA", "I need issues from...", "pull tasks for sprint X", "get me everything from version Y". Also triggers when the user needs JIRA data saved to a file for offline analysis or for other skills to consume. Calls the REST API through the jira-api skill's script, no MCP.
allowed-tools: [Bash, Read, Write, AskUserQuestion, Glob, Grep]
argument-hint: describe what to fetch, e.g. "sprint 5 of project PROJ" or "all bugs in version 2.0"
---

# JIRA Fetch

Fetch JIRA issues and save them as minimal JSON. All tracker access goes through
`${CLAUDE_PLUGIN_ROOT}/skills/jira-api/scripts/jira.mjs` — one zero-dependency script, no MCP
tools, no subagents.

**Output per issue:** key, url, type, status, statusCategory, resolution, priority, assignee,
reporter, labels, fixVersions, components, parent, summary, created, updated, description
(Markdown), comments (up to 50, oldest first, each with id, author, created, body as Markdown and
`replyTo` when it answers another comment). The full contract is in
`${CLAUDE_PLUGIN_ROOT}/skills/jira-api/SKILL.md#exporting`.

## Prerequisites

Environment variables:
- `JIRA_EMAIL` — Atlassian account email
- `JIRA_API_TOKEN` — API token from https://id.atlassian.com/manage/api-tokens

If either is missing, tell the user which one and how to set it permanently — add `export JIRA_EMAIL=...` and `export JIRA_API_TOKEN=...` to `~/.zshrc` or `~/.bashrc` and restart the shell. Do not proceed without both.

---

## Step 1: Configuration

The script reads the site and the project key itself, from `.ai/jira.config.json` found by
walking up from the working directory (falling back to the `tracker` block of
`.ai/tesoro.config.json`). Nothing has to be resolved by hand. When the script exits with code 2
saying `no .ai/jira.config.json found`, ask once via `AskUserQuestion` (header: "JIRA config") for
the site (e.g. `mycompany.atlassian.net`) and the project key, offer to write the file, and
continue. Details: `${CLAUDE_PLUGIN_ROOT}/skills/jira-api/SKILL.md#setup`.

If the user asks for a different project than the configured one, pass `--project KEY` on the
command line rather than editing the file.

---

## Step 2: Build the JQL predicate

Transform the user's request (`$ARGUMENTS`) into a JQL predicate. Construct it directly — do not ask the user for JQL syntax.

Write only the predicate. The script composes `project = "KEY" AND (<predicate>) ORDER BY …` around it, so the project never appears in what you write; a trailing `ORDER BY` is honoured.

Common patterns:

| User says | Predicate |
|-----------|-----------|
| sprint 5 | `sprint = "Sprint 5" ORDER BY priority DESC` |
| current sprint | `sprint in openSprints() ORDER BY priority DESC` |
| my tasks in current sprint | `sprint in openSprints() AND assignee = currentUser() ORDER BY priority DESC` |
| all bugs in version 2.0 | `issuetype = Bug AND fixVersion = "2.0" ORDER BY priority DESC` |
| everything updated this week | `updated >= startOfWeek() ORDER BY updated DESC` |
| tasks in "In Progress" | `status = "In Progress" ORDER BY priority DESC` |
| all tasks for version 3.1 | `fixVersion = "3.1" ORDER BY priority DESC` |
| unresolved bugs | `issuetype = Bug AND resolution = Unresolved ORDER BY priority DESC` |

When the request genuinely spans projects ("my open issues everywhere"), add `--all-projects` in
Step 3 and write the predicate as a complete query. It has to be said explicitly, because a
whole-instance query by accident is never what anybody meant.

Show the predicate to the user before executing:

```
JQL predicate: sprint in openSprints() ORDER BY priority DESC
```

If they want changes, adjust and re-show. Proceed only after confirmation.

---

## Step 3: Run the export

Generate the output filename using current date and time:

```
FILENAME: jira-fetch-YYYYMMDD-HHmmss.json
```

Run the export. Output goes to `/tmp` first so the user can preview before committing to the project directory — this avoids polluting the repo with unwanted files:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/jira-api/scripts/jira.mjs" export-issues \
  --jql "${PREDICATE}" \
  --output "/tmp/${FILENAME}"
```

The predicate must be properly quoted to handle spaces, parentheses, and special characters.

**Lightweight mode** — when the user only needs an issue list (no descriptions or comments), add `--summaries-only`. The script then returns search rows directly at a cost of one API request per 1000 issues instead of 2+ requests per issue — a large difference on projects with years of history. To list a project's versions, `list-versions` is cheaper still and does not need issues at all.

The script prints progress to stderr and the output file path to stdout. If it exits with non-zero status, show the error message and stop — do not retry.

---

## Step 4: Show Results

Read the output JSON from the temp file. Display a compact summary:

**Header line:** `Fetched {count} issues from {meta.site} ({meta.fetched})`

**Table** with all issues:

```
| Key | Type | Status | Priority | Assignee | Summary |
```

Truncate summary at 60 characters with `...`. This table lets the user verify the right data was fetched before saving.

---

## Step 5: Ask to Save

Ask via `AskUserQuestion` (header: "Save results"):
- **Save to docs/jira/** (Recommended) — copy file to `./docs/jira/${FILENAME}`
- **Keep in /tmp** — leave file at temp location, show full path
- **Discard** — delete the temp file

If saving to `docs/jira/`:
1. Create `./docs/jira/` directory if it doesn't exist
2. Copy the file from `/tmp/${FILENAME}` to `./docs/jira/${FILENAME}`
3. Show the saved path

After saving (or keeping), mention that the file is ready for use by other skills or direct reading.

---

## Raw API Access

For a read the named operations do not cover (workflow transitions, boards, sprints), call the REST API directly with the same credentials. Reads only: anything that changes JIRA state goes through a `jira-api` operation, which shows the request and waits for confirmation. The tracker's rich-text format is what makes a hand-written write break, and the script already handles it.

**Auth** — Basic auth with the same env vars the script uses:

```bash
curl -s -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -H "Accept: application/json" \
  "https://${SITE}/rest/api/3/myself"   # cheap credentials check
```

| Endpoint | Purpose |
|----------|---------|
| `GET /rest/api/3/issue/{key}/transitions` | Available workflow transitions (IDs are instance-specific) |
| `GET /rest/agile/1.0/board?projectKeyOrId={key}` | Boards; `/rest/agile/1.0/board/{id}/sprint` lists sprints |
| `GET /rest/api/3/myself` | Verify credentials / current account |
