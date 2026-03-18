---
name: jira-feedback
description: Add comments, feedback, review notes, or replies to existing JIRA issues. Use when the user wants to post a comment, reply to a discussion, leave review feedback, or add notes on a JIRA ticket. Transforms raw input into clear, well-structured comments. Also use when the user wants to post code review findings or PR review results to a JIRA ticket. Triggers on any request to comment on, reply to, or add feedback to a JIRA issue.
argument-hint: "[feedback content]"
---

# JIRA Feedback

Add comments and feedback to existing JIRA issues. Transforms raw input into clear, well-structured comments.

## Workflow

1. **Initial setup** — Ask language and feedback type via `AskUserQuestion` (see below)
2. **Parse the input** — Treat `$ARGUMENTS` as the feedback content; if a JIRA issue key is present, extract it
3. **Read the JIRA issue** *(optional)* — If an issue key was found, fetch the issue from JIRA for context
4. **Draft the comment** — Write the comment in the chosen language and format, applying writing clarity rules
5. **Present for review** — Show the draft to the user and wait for confirmation
6. **Resolve JIRA configuration** — After user confirms the draft, resolve `cloudId` (see below)
7. **Send to JIRA** — Only after configuration is resolved

## Initial Setup (Step 1)

Before anything else, use `AskUserQuestion` with two questions:

- **Language** (header: "Language"): English (Recommended) | Spanish | Polish | German
- **Feedback type** (header: "Format"): Comment — direct reply or note | Feedback list — structured list of review points | PR Review — code review findings (from agent-teams-review)

Use the selected language for the entire draft.

## Parsing the Input (Step 2)

Treat the entire `$ARGUMENTS` as the feedback content. Scan for a JIRA issue key matching `[A-Z]{2,6}-\d+` — if found, extract it for use in Step 3 and Step 7.

The issue key is **optional**. If no key is present, skip Step 3 and ask for the issue key later in Step 7 (before sending).

Examples:
- `TES-1234 I think the API regression also happens on staging` → key: `TES-1234`, content: the full text
- `there are five things wrong with the export feature` → no key, content: the full text

**PR Review format — additional parsing:**

When PR Review format is selected, determine the input source. The expected input is a **triage report** (output of the triage skill, with Fix Now / Fix Later / Skip groups), but raw review reports also work as a fallback.

- If `$ARGUMENTS` contains a file path (matches `*.md` or a recognizable path like `docs/reviews/...`) — read the file. If it contains Fix Now / Fix Later / Skip sections, treat it as a triage report. If it contains Action Items / Findings by severity, treat it as a raw review report.
- If `$ARGUMENTS` contains reviewer-prefixed IDs (`VM-`, `BE-`, `FE-`, `QA-`, `SC-`, `DV-` followed by digits) — parse as pasted review findings
- If the input has neither a file path nor recognizable finding IDs — ask the user via `AskUserQuestion` (header: "Review source") to provide the triage/review report path or paste the findings

Still extract a JIRA issue key if present (same as above).

Examples:
- `TES-1234 docs/reviews/feature-auth-2026-03-15-triage.md` → key: `TES-1234`, source: triage file
- `TES-1234 docs/reviews/feature-auth-2026-03-15.md` → key: `TES-1234`, source: raw review file
- `TES-1234 BE-001 N+1 query in settings loader Critical ...` → key: `TES-1234`, source: pasted findings

## Reading the JIRA Issue (Step 3 — optional)

If an issue key was found in Step 2, use the `getJiraIssue` MCP tool to fetch the issue:

- **cloudId**: resolved from CLAUDE.md or ask the user (see JIRA Configuration below)
- **issueKey**: extracted in Step 2

Read the issue summary, description, and existing comments to understand the context. Use the issue's domain terminology in your draft.

**Thread analysis** — when comments exist on the issue, analyze the last 3-5 comments to understand the conversation dynamics:

- **Thread tone:** Identify whether the discussion is technical (code references, stack traces), casual (brief updates), formal (stakeholder-facing), or urgent (blockers, deadlines). Match this tone in the draft — a technical thread gets precise language, an urgent thread gets direct, no-preamble answers.
- **Open questions:** If the most recent comment asks a question or requests information, frame the draft as a direct answer. The reader should immediately recognize this as a response to what they asked, not a standalone observation.
- **Terminology consistency:** Use the exact names, abbreviations, and phrasing from the thread — not synonyms. If the thread says "settings loader" do not write "configuration fetcher."
- **Conversation momentum:** In heated or urgent threads (multiple comments in short succession, language signaling frustration or deadline pressure), match the directness and pace. Skip preamble, lead with the answer or status.

Example with thread context: [references/example-comment-with-context.md](references/example-comment-with-context.md)

If no issue key was provided, skip this step entirely.

## Writing Clarity Rules

The user's input may be rough, unstructured, or dictated by voice. Transform it into a clear, well-written comment:

- **Clean up grammar and structure** — proper capitalization, punctuation, and sentence boundaries; remove filler words and false starts
- **Simple language** — write in plain, straightforward language that is easy to read for non-native speakers
- **Deduplicate** — merge repeated or rephrased versions of the same idea into one clear statement
- **Preserve intent and tone** — keep the user's meaning, emphasis, and level of urgency intact
- **Use domain terminology** — if the JIRA issue was fetched, replace vague references with specific terms from the issue (e.g., "that thing" → the actual feature/component name)
- **Target language** — produce the final text in the language chosen in Step 1, regardless of the input language

## Comment Formats

### Format: Comment

Clean prose, 1-3 paragraphs. Direct reply or note — no headings, no greetings, no sign-offs.

```
[1-3 paragraphs. Concise, direct response addressing the issue or question.]
```

Example: [references/example-comment.md](references/example-comment.md)

### Format: Feedback List

Structured list with a brief context line and prioritized bullet points.

```
[1-2 sentences of context — what was reviewed and in what scope.]

- [Feedback item — most critical first]
- [Feedback item]
- [Feedback item]
```

Rules:
- Critical or blocking points first
- 3-8 bullet items
- Use dash markers (`-`)
- Each item is a single clear statement — no sub-bullets

Example: [references/example-feedback-list.md](references/example-feedback-list.md)

### Format: PR Review

Structured code review findings condensed for a JIRA comment. Expects input from a **triaged** review — after the triage skill has classified findings into Fix Now / Fix Later / Skip groups. Transforms the triage output into an actionable, scannable summary that developers can work through as a checklist.

```
**Code Review: {branch-name}** | {date} | Verdict: {verdict}
{reviewer-list} | {finding-count} findings | ~{total-effort}
{AI Slop: X/10 — only if score <= 6}

### Fix Now ({group-count} groups, ~{effort})

**{Group Name}**
- [ ] `[BE-001]` **Issue title** — `file:line` — description + fix
- [ ] `[SC-002]` **Issue title** ↔️CROSS — `file:line` — description + fix
> {Why fix now — copied from triage reasoning}

**{Group Name}**
- [ ] `[VM-001]` **Issue title** — `file:line` — description + fix

### Fix Later ({count} findings)
- `[QA-001]` Issue title — `file:line`
- `[FE-001]` Issue title — `file:line`

{Skip: N findings omitted} | Full report: `{report-path}`
```

Rules:
- **Fix Now groups** are the focus — preserve the triage group names and execution order. Each finding gets full detail: ID, title, file:line, one-sentence description, and inline fix suggestion. Include the triage reasoning blockquote (`>`) so the developer knows why this is urgent.
- **Fix Later** findings get a single-line summary: ID, title, file:line. No grouping needed — just a flat list for awareness.
- **Skip** findings are collapsed into a count. The developer doesn't need to see them — they were intentionally excluded.
- Won't Implement items (from previous triage rounds) are omitted entirely.
- Preserve reviewer-prefixed issue IDs (`VM-`, `BE-`, `FE-`, `QA-`, `SC-`, `DV-`) for traceability back to the full report
- Keep `↔️CROSS` tags with reviewer attribution on cross-reviewer findings
- Keep the entire comment under ~50 lines — JIRA comments lose readability when they are too long
- AI Slop score: include as a one-line note in the header only if the score is 6 or below; omit the full category breakdown
- If the source is a raw review report (not triaged), fall back to severity grouping: Critical/High get full detail, Medium get one-liners, Low get collapsed count

Example: [references/example-pr-review.md](references/example-pr-review.md)

## Writing Rules

- Be direct — state observations and conclusions, not the process of arriving at them
- Use the project's domain language and terminology from the JIRA issue
- Never fabricate information — only include facts from the user's input or the JIRA issue
- Match the tone to the context — urgent issues get direct language, discussions get collaborative tone
- Prefer concrete over abstract (say "the CSV export endpoint" not "the relevant endpoint")
- For PR Review format — keep language factual and terse; review findings are reference material, not prose. Use the finding's own wording rather than paraphrasing

## Presentation (Step 5)

Always present the draft inside a clearly marked block and ask:

> **JIRA Comment Draft — please review:**
>
> [comment content]
>
> Confirm to send, or let me know what to change.

When thread context was used (comments existed on the issue), include a brief context note above the draft so the user knows what influenced the tone and framing:

> **Thread context:** Last 3 comments discuss staging regression. Most recent (Anna, 2h ago) asks for confirmation on the date filter. Draft framed as a direct answer.

Do NOT send to JIRA until the user explicitly confirms.

## JIRA Configuration (Step 6)

After the user confirms the draft, resolve the JIRA connection before sending.

The skill needs a JIRA `cloudId` (e.g. `mycompany.atlassian.net`). The `projectKey` is not needed — the issue key already identifies the project.

**Resolution order:**

1. Check the project's `CLAUDE.md` for a JIRA config block:
   ```
   ## JIRA
   - Cloud: mycompany.atlassian.net
   ```
2. If not found, ask the user via `AskUserQuestion` (header: "JIRA config") for the cloud ID.

Store the resolved value for the rest of the session.

## Sending to JIRA (Step 7)

After configuration is resolved, use the `addJiraComment` MCP tool:

- **cloudId**: resolved in Step 6
- **issueKey**: extracted in Step 2, or ask the user via `AskUserQuestion` (header: "Issue key") if not provided earlier
- **body**: the confirmed comment text
