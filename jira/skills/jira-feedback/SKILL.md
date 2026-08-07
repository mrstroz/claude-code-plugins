---
name: jira-feedback
description: Write and post a comment on an existing JIRA issue. Turns rough, dictated or half-formed input into a comment that reads like a person wrote it, in whatever language the issue thread is already using. Reads the issue and its recent comments first, so the draft answers what was actually asked and uses the thread's own terminology. Use when the user wants to comment on a ticket, reply to a discussion, leave feedback or review notes, confirm or deny something on an issue, or post an update. Triggers on "skomentuj", "dodaj komentarz", "odpowiedz na", "napisz w tickecie", "wrzuć notatkę do", "comment on", "reply to", "add a note to", "post an update on" followed by an issue key or a description of what to say. Also use whenever the user dictates a rough observation about a ticket and expects it to land in JIRA.
argument-hint: "[TICKET-123] [what to say]"
---

# JIRA Feedback

Post a comment on a JIRA issue. The input is usually rough: dictated, unfinished,
written in a hurry. The job is to turn it into something a colleague would write,
without adding anything the user did not say.

## Workflow

1. Issue key and domain, then read the issue and its thread
2. Detect the language from the thread
3. Draft, with the shape following the content
4. Preview the draft together with any assumptions
5. Post after explicit confirmation

## Step 1 — Key, domain, and the read

Extract `[A-Z]{2,6}-\d+` from `$ARGUMENTS`. Without a key there is no thread to
read and nowhere to post, so when none is present ask once via `AskUserQuestion`
(header: "Issue key") and continue.

Resolve the domain the way `jira-fetch` does. Look for a config block in the
project's CLAUDE.md, and ask only when it is missing:

```
## JIRA
- Domain: mycompany.atlassian.net
```

Read the issue with the existing fetch script, one issue selected by key:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/jira-fetch/scripts/fetch-issues.mjs" \
  --domain "${DOMAIN}" \
  --jql "key = ${ISSUE_KEY}" \
  --output "/tmp/${ISSUE_KEY}.json"
```

The output carries the summary, description and the most recent comments with
their bodies already flattened to plain text, which is everything the next three
steps need. No `cloudId` and no MCP tool is involved; authentication is the
`JIRA_EMAIL` and `JIRA_API_TOKEN` pair that `jira-fetch` already uses.

## Step 2 — Language

Comment in the language the thread is already using, and do not ask.

The recent comments decide it rather than the description: the comment is
addressed to the people talking now, not to whoever opened the ticket a month
ago. So a ticket described in Polish under an English discussion gets an English
comment. When there are no comments at all, the description decides.

An explicit request in the input ("po polsku", "in English") beats detection.

State what you picked in one line above the draft. A wrong guess then costs one
word to correct instead of a whole redraft.

## Step 3 — Draft

### The thread

Read the last few comments before writing anything.

When the most recent one asks a question, the draft is an answer to it and
should read that way from its first sentence, not as a standalone note that
happens to sit underneath. Match the register of the discussion: a technical
thread wants precision, and an urgent one (several comments in quick succession,
deadline language) wants the status first and no preamble.

Use the thread's own names and abbreviations. If it says "settings loader", do
not write "configuration fetcher". A synonym makes every reader stop and work
out whether some new thing is being discussed.

### Shape

The shape falls out of the content. One thought is a paragraph. Several separate
things are a list. An answer plus a caveat is two paragraphs, because a list of
one item is not a list.

There is no count in either direction. A minimum turns two real points into
three, the third being filler. A maximum cuts the ninth finding out of nine. The
only length rule worth keeping is that nothing stays in which could be deleted
without losing information.

### How it should read

Two habits give a machine away, and both are matters of pattern rather than of
any single word.

**Em dashes.** At most one in an English comment. Where one wants to go, a comma,
a colon or a full stop usually fits better, and the full stop repairs the rhythm
at the same time. In a list write `**Term:** description` rather than
`**Term** — description`.

Polish works differently. The pause is ordinary punctuation there, particularly
in an aside or where a verb is left out, so stripping every one of them leaves
the text stiff. What gives it away is density, one per paragraph at most, and
reaching for it in place of every other mark.

**Bullet rhythm.** Points should not share a length or a build. Five points that
each run "statement, then implication" across one line read as generated however
good the content is. Real lists are uneven: one runs half a line, the next three,
one ends on a question.

**Word choice, English only.** Most readers here are not native speakers, so
write so they can read fast without a dictionary. Prefer "happens again" to
"reproduces", "makes" to "triggers", "matches" to "aligns with", "easy to read"
to "human-readable", "find it later" to "for easier identification". Short
sentences, one idea each. Sounding plain is fine. None of this applies in Polish:
write normal Polish and do not flatten the vocabulary to seem simple.

### What may go in

Every sentence needs a source, either the user's input or the issue. Vague
references may be swapped for real names from the ticket, so "that thing in the
export" becomes the actual field.

Nothing beyond that. No suspected cause, no suggested fix, no conclusion the user
did not reach. Their name goes on this and a reader cannot tell which half they
wrote. Hedges survive intact: "might be" stays "might be", because dropping it
turns a guess into a claim the thread will hold them to later.

Worked examples of all of the above: [references/examples.md](references/examples.md).

## Step 4 — Preview

Show the draft as plain text in a fenced code block. A blockquote puts a `>` on
every line and ruins copy-paste.

````
**Draft for review:**

```
[comment]
```

Thread runs in English, so the draft is in English.

Confirm to post, or tell me what to change.
````

When something in the input was ambiguous, list what you assumed underneath, and
keep it outside the code block so it cannot be posted by accident. Draft first
and assumptions second: a question asked before the draft costs a round trip
every time, including the times the guess would have been right.

When the thread shaped the tone or framing, say so in a line so it is clear what
the draft is responding to.

## Step 5 — Post

Only after explicit confirmation. Write the confirmed text to a file first,
because comments contain newlines, quotes and backticks, and a shell argument is
exactly where that breaks.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/jira-feedback/scripts/post-comment.mjs" \
  --domain "${DOMAIN}" \
  --issue "${ISSUE_KEY}" \
  --body-file "/tmp/comment.md"
```

The script converts the markdown to ADF, which is the format API v3 accepts,
posts it, then reads the comment back and prints how JIRA actually rendered it.
Show that output to the user: a conversion problem is otherwise invisible until
somebody opens the issue in a browser.

Add `--dry-run` to see the exact JSON that would be sent without sending it.
