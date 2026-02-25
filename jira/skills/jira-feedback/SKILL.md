---
name: jira-feedback
description: Add comments, feedback, review notes, or replies to existing JIRA issues. Use when the user wants to post a comment, reply to a discussion, leave review feedback, or add notes on a JIRA ticket. Transforms raw input into clear, well-structured comments. Triggers on any request to comment on, reply to, or add feedback to a JIRA issue.
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
- **Feedback type** (header: "Format"): Comment — direct reply or note | Feedback list — structured list of review points

Use the selected language for the entire draft.

## Parsing the Input (Step 2)

Treat the entire `$ARGUMENTS` as the feedback content. Scan for a JIRA issue key matching `[A-Z]{2,6}-\d+` — if found, extract it for use in Step 3 and Step 7.

The issue key is **optional**. If no key is present, skip Step 3 and ask for the issue key later in Step 7 (before sending).

Examples:
- `TES-1234 I think the API regression also happens on staging` → key: `TES-1234`, content: the full text
- `there are five things wrong with the export feature` → no key, content: the full text

## Reading the JIRA Issue (Step 3 — optional)

If an issue key was found in Step 2, use the `getJiraIssue` MCP tool to fetch the issue:

- **cloudId**: resolved from CLAUDE.md or ask the user (see JIRA Configuration below)
- **issueKey**: extracted in Step 2

Read the issue summary, description, and existing comments to understand the context. Use the issue's domain terminology in your draft.

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

## Writing Rules

- Be direct — state observations and conclusions, not the process of arriving at them
- Use the project's domain language and terminology from the JIRA issue
- Never fabricate information — only include facts from the user's input or the JIRA issue
- Match the tone to the context — urgent issues get direct language, discussions get collaborative tone
- Prefer concrete over abstract (say "the CSV export endpoint" not "the relevant endpoint")

## Presentation (Step 5)

Always present the draft inside a clearly marked block and ask:

> **JIRA Comment Draft — please review:**
>
> [comment content]
>
> Confirm to send, or let me know what to change.

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
