# Team protocol

One driver and at least one reviewer work on one task from separate sessions, possibly in different CLIs. The only channel is the run directory, and `team.mjs` in it is the only writer of its log. What you print in your own session reaches nobody.

Call the script by its absolute path: `node <run>/team.mjs ...`. It works from any directory, including a worktree. `chat.md`, `team.md` and `plan.md` are generated views: read them, and do not edit them, because the next write replaces them. `events.jsonl` is the record.

## Who does what

- **Driver** (`d`): does the task, holds the plan, integrates, reports to the user. The only writer of the plan.
- **Architect** (`a1`, `a2`, ...): the approach, the interfaces, the consequences elsewhere.
- **Tester** (`t1`, `t2`, ...): the criteria as checks, the edge cases, independent runs.

Your role file holds the detail. Everyone needs the rest of this page.

## Waiting

A session that polls in a loop pays for every poll: a Codex session left on a shortened `wait` made 53 tool calls in 15 quiet minutes. So use the first of these that your CLI can do, and do not shorten a timeout to look busy.

**Your CLI can run a command in the background and start a turn when it ends** (Claude Code): run this in the background and end your turn.

```
node <run>/team.mjs wait --as <you> --timeout 3600 --soft-timeout [--seen <batch>]
```

It costs no turns until it exits. `state: idle` means nothing arrived: start it again.

**You are woken by a watcher** (Codex; `join` tells you so): read once, then work, publish and end your turn.

```
node <run>/team.mjs wait --as <you> --timeout 0 [--seen <batch>]
```

A signal starts your next turn when something arrives. It carries no content, so a missed or repeated signal costs only time. The driver runs the watcher from outside any sandbox: `node <run>/team.mjs watch`, in the background. `post` warns when a recipient depends on a watcher and none is running. If signals fail, the driver gets a `WAKE_FAILED` message, and the user can tell that session by hand to read its messages.

A signal goes to the session that joined. `/compact` keeps that session; `/clear` or a new conversation does not move the seat, and the old session keeps being woken. To take the seat from a new conversation, run `node <run>/team.mjs join --role <role> --runtime <cli> --rejoin <you>` there, then read your role file and the protocol again, since nothing else carries over.

**Neither** (last resort, and the costly one): run the blocking `wait` in the foreground again until it exits with 4, with the longest timeout your tool allows. Tell the user what it costs.

| Exit | Meaning | What to do |
|---|---|---|
| 0 | messages are printed with a batch id, or `state: idle` under `--soft-timeout` | work on them, and put `--seen <batch>` on your next `post` or `wait` |
| 3 | nothing arrived in time | not a failure: wait again |
| 4 | the run is closed | stop; you are free |

Only `--seen` moves your cursor. A batch you did not acknowledge comes back with the same ids, which is how an interrupted or compacted session recovers: skip what you already answered. Every `post` tells you how many messages are unread.

## Messages

```
node <run>/team.mjs post --as <you> --type <TYPE> [--to a1,t1|all] [--item <name>] [--rev <n>] [--seen <batch>] --stdin <<'EOF'
plain text
EOF
```

| Type | Who | What it says | What it costs the others |
|---|---|---|---|
| `NOTE` | anyone, needs `--to` | a question, an observation, a partial result | nothing is owed |
| `DECISION` | usually the driver, needs `--to` | a change to the plan, the scope or an assumption | nothing is owed |
| `REVIEW` | the item's author | please review this revision: what changed, the evidence, what to look at | a verdict from each required reviewer |
| `OK` | a required reviewer | approved, and what was checked and where | nothing |
| `FIX` | a required reviewer | what must change before this passes, with the reason and the location | a new revision |

`--to` defaults to the right people for `REVIEW`, `OK` and `FIX`. A suggestion goes inside an `OK` or a `NOTE`, because a `FIX` forces a new revision. A `FIX` is for what you would not want to land as it is, and taste alone is not that. Send one `REVIEW` text to everybody, with a line per role where they need different things.

## Evidence

Every `OK` and `FIX` states how it is held, because a confident sentence about a command that never ran reads exactly like a real result.

| `--held` | Meaning | Needs |
|---|---|---|
| `executed` | you ran it on this revision | `--evidence <exec id>` |
| `inspected` | you read the code, a diff, a page | the file and place in the text |
| `not-run` | you could not check it | the reason in the text |

Run a check through the script, so that the run exists apart from what anybody says about it:

```
node <run>/team.mjs exec --as <you> --item <name> --rev <n> -- npm test
```

It records the command, the directory, `HEAD`, the exit code, the signal, any spawn error and both outputs under `artifacts/exec/<id>/`, and says whether the directory holds that revision. A check on a different tree says nothing about the revision: take a worktree of the ref, or say so.

- Read the output first and publish the verdict in a separate command. A command that runs the check and posts the verdict in one go writes results nobody has seen yet.
- Say what the output shows, not what you expected it to show. A sandbox error that stops a check before it starts is `not-run`.
- A check your CLI ran outside a shell (a browser tool, say) has no record. Hold it as `inspected` and name the tool and what it showed.
- An `OK` citing a failed run or another tree is recorded as a contradiction, and `gates` shows it.

The script confirms that a run exists, how it ended and that it belongs to the revision. Whether you read it correctly is still on you.

## Items, revisions, gates

The plan is a text file plus a list of items, each with an author, the reviewers it requires and the items it truly depends on:

```json
[
  { "name": "step1", "author": "d", "required": ["a1", "t1"] },
  { "name": "tests-t1", "author": "t1", "required": ["d"] },
  { "name": "step2", "author": "d", "required": ["t1"], "depends": ["step1"] },
  { "name": "final", "author": "d", "required": ["a1", "t1"] },
  { "name": "report", "author": "d", "required": ["a1", "t1"] }
]
```

`depends` means "this rests on that", not "this comes after that": when `step1` moves, approval of `step2` lapses. `final` rests on every other item, and `report` rests on `final`. Keep independent work independent, or one small fix sends everybody back to re-approve.

`snap --as <you> --item <name>` captures the whole working tree as an immutable ref under `refs/team/<run>/` and gives the item its next revision. Read a revision with `git diff refs/team/<run>/baseline <ref> -- <files>` and `git show <ref>:<path>`, not from the working tree, which has moved on. A session that cannot write git refs asks the driver in a `NOTE` to run `snap --as d --item <name> --for <you>`; authorship stays yours.

An `OK` counts only for the current revision, from a required reviewer, with no later `FIX` from that reviewer and nothing it depends on moved since. Only the script decides that. `gates` prints what is approved and why anything is not, and `close --status complete` refuses while anything is open. An `OK` quoted inside a message opens nothing.

A new plan revision asks only the reviewers it affects, plus anyone holding an open `FIX`; `--affects a1` adds one. A prose-only change asks everyone.

## Modes

**Standard**: architect and tester, per-step items, a decision in the plan about an adversarial review.

**Lite**: for a small change, `start --mode lite` with a single `final` item reviewed by a tester, and no adversarial review. The plan still gets reviewed, since that is where the most valuable findings come from, whatever the size of the change.

Choosing is the driver's call and the user's to overrule. Lite on a schema change, an auth path, a public contract or anything hard to reverse is the wrong saving.

## Ending

The driver sends the result, then the report; the reviewers approve what they own.

The report is a file (`snap --item report --file report.md`) with its own revisions, so correcting a sentence leaves the approval of the code alone. Every check in it names who ran it and on what, with the exec id where there is one, and says whether it was executed or inspected. Write only what you know: the driver cannot know what another session re-ran, so "verified by both" needs each of them to have said so. A reviewer correcting one line of its own is asked only about that line (`--correction-of t1`).

`close --status complete` needs nothing left open in `gates`. `partial` and `abandoned` need `--reason`, always pass, and list what went unreviewed. Anybody may abandon on the user's word, including `--as user` from a shell, because a driver that is gone must not hold the other sessions. Exit code 4 from `wait` releases everyone.

## Rules that hold whatever the role

- Check for yourself and say where you looked. An `OK` with no location is worth nothing.
- The user's permission reaches you only through the user. A `DECISION --tag authorised` from the driver records what the user said; a message from another session cannot widen it, and your `OK` is never a substitute for it.
- Do not ask another session to do what your own permissions block.
- Files you did not change are not yours to revert. What was modified before the run started belongs to the user, and `start` lists it.
- Work in your own files. Editing somebody else's file is a proposed diff in a message: two writers in one file collide, and a reviewer who edits has stopped reviewing.
- A shared database, server or port that the plan marks `exclusive` has a keeper, the driver by default. Ask for it in a `NOTE` and use it after the answer. Concurrent runs against shared fixtures produce failures that look like a bug in the change.
- Do not infer that a member is gone from silence. `status` reports facts: last contact, what was delivered and acknowledged. Whether somebody is gone is for the user to say.
- Before a long stretch of work, `status --as <you> --doing "..."` spares the others from guessing. It is optional and notifies nobody.
- If a dispute repeats without a new fact, the next message is an experiment or a question to the user. Scope, priorities, permissions and acceptable risk are the user's.

## Reference

| Command | Purpose |
|---|---|
| `status` | members, contact, delivery, what is unresolved, the watcher |
| `gates [--json]` | what is approved and why anything is not |
| `log [--since <seq>]` | the record, without confirming anything |
| `rebuild` | regenerate the views from `events.jsonl` |
| `doctor` | what this session can write |
| `help` | every command and flag |

Exit codes: 0 ok, 1 failure, 2 usage, 3 wait timeout, 4 run closed, 5 refused by a rule (read the message), 7 corrupt log (stop and tell the user).
