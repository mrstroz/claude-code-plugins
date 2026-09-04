# Pair protocol

Two Claude Code sessions in the same working directory, one driving and one navigating, talk through `SendMessage`. This file is the contract both sides follow. It is short on purpose: the point of a protocol is that either side can predict what the other will do next.

## How messages travel

- Discover the other session with `ListAgents`; the name in that listing is the address for `SendMessage`.
- A message to an idle session wakes it and starts a new turn. A message to a busy session waits and is delivered between its tool calls. Nobody polls `ListAgents` in a loop or sends "are you there" messages; a message that goes unanswered is a reason to stop and tell the user, not to send it again.
- Your plain text output is invisible to the other session. Only `SendMessage` crosses the gap.
- The terminal shows the receiver only the first line of a message until it is expanded. That line is the header described below, and it has to stand alone.
- A message arrives wrapped as `<cross-session-message from="...">`. Reply to the `from` value.

## Message shape

First line, always:

```
[driver|navigator] TYPE n: one sentence saying what this is about
```

`n` is the step number and is omitted for `START`, `READY`, `PLAN`, `FINISH`. The rest is prose: paragraphs and bullets, code in fenced blocks. No JSON, no headers, no greetings.

## Message types

| Type | Sent by | Carries | Expected answer |
|---|---|---|---|
| `START` | driver | the task as the user gave it, the driver's own session name, the absolute path of this file | `READY` |
| `READY` | navigator | first questions or risks after a look at the code, or "nothing yet" | `PLAN` |
| `PLAN` | driver | numbered steps, each with the proof that will show it is done (a test, a command, an observable result) | `REVIEW` or `OK` |
| `REVIEW` | navigator | findings, each tagged **blocks**, **worth it** or **minor**, each naming a file or a step | a corrected `PLAN`, or a corrected `DONE n` |
| `OK` | navigator | agreement, plus the file and place actually looked at | the next `STEP`, or nothing after `OK FINISH` |
| `STEP` | driver | the intent of step `n` in one or two sentences, before any edit | none; the driver proceeds unless a `REVIEW n` or `QUESTION` arrives first |
| `DONE` | driver | what changed (files, functions) and the evidence (test output, command output, a short diff excerpt) | `OK n` or `REVIEW n` |
| `QUESTION` | either | anything that blocks the sender: a missing plan after context loss, an ambiguity, a decision to take to the user | an answer, or a message saying the user was asked |
| `FINISH` | driver | the plan's steps as a checklist, each ticked with its proof, and the full `git diff --stat` | `OK FINISH` or `REVIEW` |

`STEP` and `DONE` for the same `n` may be one message when the step is small enough that announcing it separately would only add a round.

## Sequence

```
navigator: waits (turn ended, nothing to do)
driver:    START
navigator: READY
driver:    PLAN
navigator: REVIEW  -> driver: PLAN (corrected) -> ... -> navigator: OK
driver:    STEP 1 ... DONE 1
navigator: OK 1 | REVIEW 1 -> driver: DONE 1 (corrected)
driver:    STEP 2 ... DONE 2
...
driver:    FINISH
navigator: OK FINISH | REVIEW -> driver: DONE n (corrected) -> FINISH
```

The driver waits after `PLAN`, `DONE` and `FINISH`. Waiting means ending the turn; the reply wakes the session. Silence is not agreement: the driver does not move to step `n+1` because no `REVIEW n` came, it moves because `OK n` came.

When the driver is in plan mode, `PLAN` and the navigator's `REVIEW` happen before `ExitPlanMode`, so the user approves a plan that has already been reviewed.

## Step size

A step is a unit with its own proof: a function and its test, a migration, an endpoint, a component. Not a line, because every round is two full model turns and a line-sized step spends them on nothing. Not the whole feature, because a review of forty changed files finds nothing specific.

## Disagreement

The driver decides how a thing is implemented. The navigator decides whether it should be, and where it sits: scope, architecture, what gets tested. A `REVIEW` tagged **blocks** stops the driver; **worth it** and **minor** are the driver's call, and the driver says in `DONE` which ones it took.

The same disagreement in a third round goes to the user. The driver asks with `AskUserQuestion` in its own tab and tells the navigator it did. When the driver is in plan mode, the escalation is a corrected plan that the user approves at `ExitPlanMode`.

## Losing context

Both sessions may have their context compacted mid-task. The header on every message carries the role and step number so a compacted transcript still shows where things stand. If you no longer remember this protocol, read this file again; its path is in `START`. If you no longer remember the plan, send `QUESTION: resend the plan` and the other side sends the last agreed `PLAN` verbatim.

## Permissions

Each session has its own permission settings. Do not ask the other session to perform an action that was denied in yours, or that you expect your own settings would block. The other session doing it for you bypasses a decision the user made. Take blocked work to the user instead.
