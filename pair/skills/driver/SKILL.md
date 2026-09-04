---
name: driver
description: Take the driver seat in a pair programming session — implement a task step by step while a navigator in a second Claude Code tab reviews the plan and every step before the next one starts. Finds the navigator session with ListAgents, hands it the task, sends the plan for review before any code is written (before ExitPlanMode when the user has put this tab in plan mode), then announces each step, does it, reports it with evidence and waits for the navigator's verdict. Use whenever the user wants to work in a pair with a second tab watching: "pair programming", "bądź driverem", "ty piszesz, druga zakładka patrzy", "jedziemy w parze", "siadaj do klawiatury", "zaimplementuj to z nawigatorem", "drive this", "you drive, the other tab navigates", "pair with the other session", "implement this with a navigator watching", "let's pair on this" — and whenever the user says a navigator is waiting in another tab. Needs a second session that has run /pair:navigator; without one the skill stops rather than working alone. Do NOT use it for an ordinary implementation with no second tab — that is just doing the work. Do NOT use it when the user wants this tab to watch and review rather than write; that is pair:navigator.
argument-hint: "[the task: a description, a ticket key or a docs/plan id]"
---

# Driver

You write the code. Another Claude Code session, in a tab next to yours in the same directory, is the navigator: it reviews the plan before you start, reviews every step after you finish it, and keeps the edge cases, the architecture and the tests in view while you keep the next line in view. The value of the pair comes from that second, independent look, so the two things that break it are moving on without an answer and doing a step you did not announce.

The contract between the two sessions is in [references/protocol.md](references/protocol.md). Read it once now; it is short and the navigator follows the same file.

The user sits at both tabs and can talk to either of you. Anything they tell you mid-task is theirs to decide; mention it to the navigator in your next message so both sides work from the same facts.

## Workflow

### 1. Find the navigator

Call `ListAgents`. Look for an interactive peer session on this machine that is idle.

- Exactly one idle session: that is the navigator. Use its name as the address. A name the user set with `/rename` (say, `pair-nav`) settles it even when other sessions are idle.
- Several: ask the user with a single `AskUserQuestion` listing the names. Guessing sends the task into someone else's unrelated work.
- None: stop and tell the user to run `/pair:navigator` in a second tab, then invoke you again. Do not fall back to working alone. A session that quietly drops the navigator produces a transcript shaped like a pair session with only one opinion in it, and the user reads it as two.

### 2. Hand over the task

Send `START` with the task exactly as the user gave it (`$ARGUMENTS`, plus anything the conversation adds), your own session name from the `ListAgents` header, and the absolute path of `references/protocol.md` resolved from `${CLAUDE_PLUGIN_ROOT}/skills/driver/references/protocol.md`. The path is what lets a navigator that lost its context find the rules again.

Then end your turn. The navigator's `READY` wakes you.

### 3. Plan before code

Read the code the task touches, the spec or ticket if there is one, and whatever `READY` raised. Write the plan as numbered steps, each one a unit with its own proof: what changes and how you will show it works (a test, a command, an observable result). Send it as `PLAN` and end the turn.

Most of the navigator's value lands here. A missing edge case costs one round in the plan and five in the code. Take the `REVIEW` seriously, correct the plan, resend it, and start step 1 only after `OK`.

If the user has put this tab in plan mode, do all of this before `ExitPlanMode`. The plan the user approves is then one that has already been reviewed, and the approval dialog is where a disagreement between you and the navigator gets settled by the person who owns the task.

### 4. Drive, one step at a time

For each step:

1. Send `STEP n` with the intent in a sentence or two. Announcing it first is what lets the navigator stop a wrong step before it exists; a step nobody announced cannot be reviewed, only undone.
2. Do the step.
3. Run whatever proves it: the test, the build, the command. Read the output yourself.
4. Send `DONE n` with the files and functions that changed and the evidence, quoted, not summarised. "Tests pass" is a claim; the last lines of the runner output are a fact the navigator can check against the diff.
5. End the turn and wait.

`OK n` means the next step. `REVIEW n` means fix what is tagged **blocks**, decide about the rest, say what you took and what you left and why, and send `DONE n` again. Fold `STEP` and `DONE` into one message when a step is small enough that announcing it separately would only add a round.

Keep the user informed in your own tab in a line or two per step. They see your transcript, not the navigator's.

### 5. Finish

When every step has its `OK`, send `FINISH`: the plan as a checklist with each step ticked and its proof, and `git diff --stat`. The navigator reviews the whole diff at this point, not the sum of the steps, because integration mistakes only show up there.

After `OK FINISH`, offer the user a commit through `utils:commit`. Do not commit on your own; the pair session ends with reviewed work in the working tree, and what to do with it is the user's call.

## When you disagree

You decide how something is implemented. The navigator decides whether it should be, and where it belongs: scope, architecture, what is tested. A finding tagged **blocks** stops you; **worth it** and **minor** are yours to accept or decline, and you say which in `DONE`.

The same argument in a third round is a sign neither of you has the missing fact. Ask the user with `AskUserQuestion` in your tab, tell the navigator you did, and carry the answer into the next message. Two models restating their positions cost turns and settle nothing.

## What ruins a driver session

- **Steps too large.** A `DONE` covering twelve files gives the review nothing to hold; the navigator either skims or asks you to split it, and both cost more than planning smaller.
- **Steps too small.** A step per line spends two model turns per line. If a step has no proof of its own, it is part of the step next to it.
- **Evidence by assertion.** "Works" and "tests green" are what the navigator is there to doubt. Paste the output.
- **Continuing into silence.** No `REVIEW n` is not `OK n`. If nothing arrives, something is wrong on the other side; tell the user rather than moving on or resending.
- **Working without the pair.** If the navigator is gone mid-task, stop and say so. Finishing alone and reporting it as paired is the one outcome worse than an unfinished task.
