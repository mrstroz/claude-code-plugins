---
name: jira-fetch
description: Fetch JIRA issues via REST API and save as minimal extracted JSON. Bypasses MCP tools for maximum data efficiency and token minimization. Use when the user wants to download, fetch, pull, export, or cache JIRA data locally. Triggers on requests to fetch issues, download tasks, export JIRA data, get issues from JIRA, pull sprint/version/project data, cache JIRA issues, dump JIRA to file, or any variation like "give me data from JIRA", "I need issues from...", "pull tasks for sprint X", "get me everything from version Y". Also triggers when the user needs JIRA data saved to a file for offline analysis or for other skills to consume. Does NOT use MCP — calls JIRA REST API v3 directly via Node.js script.
allowed-tools: [Bash, Read, Write, AskUserQuestion, Glob, Grep]
argument-hint: describe what to fetch, e.g. "sprint 5 of project PROJ" or "all bugs in version 2.0"
---

# JIRA Fetch

Fetch JIRA issues via REST API v3 and save as minimal extracted JSON. Uses a zero-dependency Node.js script that calls JIRA directly — no MCP tools, no subagents, no token overhead.

**Output per issue:** key, type, status, priority, assignee, reporter, labels, fixVersions, components, summary, created, updated, description (plaintext), comments (up to 50, plaintext with author/datetime). All nested objects flattened, all HTML stripped.

## Prerequisites

Environment variables:
- `JIRA_EMAIL` — Atlassian account email
- `JIRA_API_TOKEN` — API token from https://id.atlassian.com/manage/api-tokens

If either is missing, tell the user which one and how to set it permanently — add `export JIRA_EMAIL=...` and `export JIRA_API_TOKEN=...` to `~/.zshrc` or `~/.bashrc` and restart the shell. Do not proceed without both.

---

## Step 1: Resolve JIRA Domain

Look for a JIRA configuration block in the project's CLAUDE.md:

```
## JIRA
- Domain: mycompany.atlassian.net
- Project key: PROJ
```

If found, use that domain and project key. If not found, ask via `AskUserQuestion` (header: "JIRA Configuration"):
- Domain (e.g., mycompany.atlassian.net)
- Default project key (optional — used when user doesn't specify one)

Store domain and project key for the session.

---

## Step 2: Build JQL

Transform the user's request (`$ARGUMENTS`) into a valid JQL query. Construct it directly — do not ask the user for JQL syntax.

If the user's request mentions a project, use that. Otherwise use the project key from Step 1.

Common patterns:

| User says | JQL |
|-----------|-----|
| sprint 5 of project PROJ | `project = PROJ AND sprint = "Sprint 5" ORDER BY priority DESC` |
| current sprint | `project = PROJ AND sprint in openSprints() ORDER BY priority DESC` |
| my tasks in current sprint | `project = PROJ AND sprint in openSprints() AND assignee = currentUser() ORDER BY priority DESC` |
| all bugs in version 2.0 | `project = PROJ AND issuetype = Bug AND fixVersion = "2.0" ORDER BY priority DESC` |
| everything updated this week | `project = PROJ AND updated >= startOfWeek() ORDER BY updated DESC` |
| tasks in "In Progress" | `project = PROJ AND status = "In Progress" ORDER BY priority DESC` |
| all tasks for version 3.1 | `project = PROJ AND fixVersion = "3.1" ORDER BY priority DESC` |
| unresolved bugs | `project = PROJ AND issuetype = Bug AND resolution = Unresolved ORDER BY priority DESC` |

Show the constructed JQL to the user before executing:

```
JQL: project = PROJ AND sprint in openSprints() ORDER BY priority DESC
```

If they want changes, adjust and re-show. Proceed only after confirmation.

---

## Step 3: Locate Script

Find the fetch script's absolute path:

```
Glob pattern: **/jira-fetch/scripts/fetch-issues.mjs
```

Store as `SCRIPT_PATH`. The Glob is needed because the plugin install path varies across systems — the script could be in `~/.claude/plugins/`, a local checkout, or a symlinked directory. If not found, report the error — the jira plugin may not be installed correctly.

---

## Step 4: Run Fetch

Generate the output filename using current date and time:

```
FILENAME: jira-fetch-YYYYMMDD-HHmmss.json
```

Run the script. Output goes to `/tmp` first so the user can preview before committing to the project directory — this avoids polluting the repo with unwanted files:

```bash
node "${SCRIPT_PATH}" \
  --domain "${DOMAIN}" \
  --jql "${JQL}" \
  --output "/tmp/${FILENAME}"
```

The JQL argument must be properly quoted to handle spaces, parentheses, and special characters.

**Lightweight mode** — when the user only needs an issue list or version discovery (no descriptions or comments), add `--summaries-only`. The script then returns search results directly (key, type, status, priority, assignee, labels, fixVersions, components, summary, updated) at a cost of one API request per 1000 issues instead of 2+ requests per issue — a large difference on projects with years of history.

The script prints progress to stderr and the output file path to stdout. If it exits with non-zero status, show the error message and stop — do not retry.

---

## Step 5: Show Results

Read the output JSON from the temp file. Display a compact summary:

**Header line:** `Fetched {count} issues from {domain} ({fetched timestamp})`

**Table** with all issues:

```
| Key | Type | Status | Priority | Assignee | Summary |
```

Truncate summary at 60 characters with `...`. This table lets the user verify the right data was fetched before saving.

---

## Step 6: Ask to Save

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

For one-off operations the script does not cover (project metadata, workflow transitions, sprints), call the REST API directly with the same credentials. Reads are safe to run freely; anything `POST`/`PUT`/`DELETE` changes JIRA state — confirm with the user first, same as the send steps in the other jira skills. For writes prefer the MCP tools (`addCommentToJiraIssue`, `createJiraIssue`) — see the ADF gotcha below.

**Auth** — Basic auth with the same env vars the script uses:

```bash
curl -s -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -H "Accept: application/json" \
  "https://${DOMAIN}/rest/api/3/myself"   # cheap credentials check
```

**Useful endpoints beyond issue search:**

| Endpoint | Purpose |
|----------|---------|
| `GET /rest/api/3/project/{key}/versions` | List fixVersions directly — faster than scanning issues |
| `GET /rest/api/3/issue/{key}/transitions` | Available workflow transitions (IDs are instance-specific) |
| `POST /rest/api/3/issue/{key}/transitions` | Move an issue through the workflow |
| `GET /rest/agile/1.0/board?projectKeyOrId={key}` | Boards; `/rest/agile/1.0/board/{id}/sprint` lists sprints |
| `GET /rest/api/3/myself` | Verify credentials / current account |

**Gotchas:**

- **Writes need ADF, not markdown** — REST v3 write bodies (comments, descriptions) must be Atlassian Document Format JSON. A plain-text comment body looks like `{"body":{"type":"doc","version":1,"content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}}`. This is why the jira skills route writes through MCP tools, which accept plain text.
- **Search endpoint migration** — `/rest/api/3/search` (offset-based) is legacy; new instances use `/rest/api/3/search/jql` (cursor-based, `nextPageToken`). The bundled script already handles both, so prefer the script for issue searches.
