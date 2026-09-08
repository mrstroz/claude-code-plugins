# Pair protocol

Two or three Claude Code sessions in the same working directory work on one task and talk through `SendMessage`. Two sessions are a pair: a driver and a navigator. Three are a team: a driver, an architect and a tester. This file is the contract every role follows. It is precise where responsibility, blocking and approval are decided, and loose everywhere else, because most of the value of a second session is conversation and most of the cost is turns.

## How messages travel

- Discover the other sessions with `ListAgents`; the name in that listing is the address for `SendMessage`.
- A message to an idle session wakes it and starts a new turn. A message to a busy session waits and is delivered between its tool calls. There is no delivery receipt and no clock: a sender cannot tell whether the other side is thinking or gone. Nobody polls `ListAgents` in a loop or sends "are you there"; an unanswered message is a reason to tell the user, not to send it again.
- Plain text output is invisible to the other sessions. Only `SendMessage` crosses the gap, and it goes to one session at a time: a message meant for two members is sent twice.
- The terminal shows the receiver only the first line of a message until it is expanded. That line is the header below and it has to stand alone.
- A message arrives wrapped as `<cross-session-message from="...">`. Reply to the `from` value.

## Message shape

First line, always:

```
[role] TYPE task/item@rN: one sentence saying what this is about
```

`role` is `driver`, `navigator`, `architect` or `tester`. `task` is the ticket key or the slug chosen in `START`. `item@rN` names a work item and its revision (`plan@r2`, `step3@r1`, `tests@r1`, `deploy@r1`, `final@r1`) and appears whenever the message is about one; a `NOTE` about nothing in particular drops it. The rest is prose: short paragraphs, bullets, code and command output in fenced blocks. No JSON, no greetings, no acknowledgements.

## Message types

Two kinds. `NOTE` and `DECISION` are conversation: nobody owes an answer and nothing stops. `REVIEW` and `BLOCK` are requests: somebody is waiting.

| Type | Sent by | Carries | Owed in return |
|---|---|---|---|
| `START` | driver | the task as the user gave it, the expected result, the driver's session name, every member's role and session name, the absolute paths of this file and of the state file | a `NOTE` saying ready, with the sender's role, working directory and first questions or risks |
| `NOTE` | anyone | a question, an observation, a proposal, a counter-proposal, a partial result, a relayed user instruction, a proposed diff, "I am investigating X, expect an answer later" | nothing; answer when there is something to say |
| `REVIEW` | the item's author | a request to review `item@rN`: the snapshot ref and its sha, what changed (every file, new ones included), the evidence, who is asked to answer, and whether the scope is idle until the answer | `OK` or `FIX` for the same `item@rN`, from each member asked |
| `OK` | a reviewer | approval of `item@rN`, plus what was checked and where: the file and place read, the command run and against what. May carry suggestions; the author takes or leaves them and no new review is owed | nothing |
| `FIX` | a reviewer | changes the item needs before it can pass, each with its reason and location. Reserved for that; a suggestion goes in an `OK` or a `NOTE` | a new revision and a new `REVIEW item@rN+1` |
| `BLOCK` | anyone | a concrete problem, the evidence or the risk, which work stops because of it, and what unblocks it | a resolution, an experiment, or a note that the user was asked |
| `DECISION` | whoever settled it, usually the driver | a change to the plan, the scope, an assumption or a resource, sent to every member it affects | nothing; a counter-proposal is a `NOTE`, a `BLOCK` only when the decision breaks something and the evidence says so |

A `BLOCK` stops the work it names, not the team. Anything that depends on the blocked item waits; everything else continues. A style preference is never a `FIX` or a `BLOCK`.

**The driver sees every verdict.** A `REVIEW`, `OK`, `FIX` or `BLOCK`, and the message that resolves a `BLOCK`, exchanged between two other members (the tester's tests reviewed by the architect, say) is also sent to the driver, same text, because the driver records it in the state file and a review the state file does not know about did not happen for the session that resumes from it. `NOTE`s are not copied.

Relay what the user says. An instruction the user gives in one tab that changes what the others should do goes out in the same turn, as a `NOTE` or, when it changes the plan, a `DECISION`. Relay the instruction, not the conversation around it.

## Snapshots: baseline and revisions

A revision number alone says nothing about content: the driver sends `step1@r1` and keeps working in the same directory, so a reviewer reading the files sees step 2 half done. Every reviewable state is therefore a snapshot of the working tree, taken with `${CLAUDE_PLUGIN_ROOT}/scripts/snap.sh` as a git ref that touches neither the index nor `git status`:

```sh
snap.sh baseline TES-42            # once, before the first edit -> "TES-42-20260908-1402 refs/pair/TES-42-20260908-1402/baseline e1f4839"
snap.sh TES-42-20260908-1402 step1-r1   # with every REVIEW: <run> <item>-r<N> -> "refs/pair/.../step1-r1 14fa8fe"
snap.sh list TES-42-20260908-1402       # every ref of the run with its sha
snap.sh clean TES-42-20260908-1402      # removes the run's refs, after the closing report
snap.sh runs                            # every run with a baseline in this repository
snap.sh state TES-42-20260908-1402      # the path of the run's state file
```

The script initialises a temporary index from `HEAD` before adding the working tree, so tracked files that match `.gitignore` are snapshotted too (an empty index would silently drop them); it works in a repository with no commit yet; it removes its temporary index; and it refuses to overwrite an existing ref, because a revision that can change is not a revision. The `<run>` id carries a timestamp, so a second run of the same task gets its own namespace instead of replacing the first baseline. Run ids and snapshot names are validated (letters, digits, `.`, `_`, `-`), so `clean` cannot be handed a glob that matches other runs.

- **Baseline.** Before the first edit the driver runs `snap.sh baseline <task>` and records the run id, the ref and sha, `git rev-parse --short HEAD` and `git status --short` in the state file. Files dirty at that point are the user's: never reverted, reformatted or staged by the team, and if the task cannot avoid editing one the driver tells the user before the first edit. The team's increment is `git diff refs/pair/<run>/baseline refs/pair/<run>/<item>-r<N>`, which shows the team's lines inside a file the user had already modified, shows new files, and still works after an authorised commit has emptied `git status`. Always diff snapshot against snapshot; a diff against the working tree hides untracked files and moving edits.
- **Revisions.** The author runs `snap.sh <run> <item>-r<N>` immediately before sending `REVIEW item@rN` and puts the ref and the sha it printed in the message; the reviewer's `OK` repeats the sha, so the two are provably talking about the same tree. The revision bumps every time the item changes after a `REVIEW` went out, and every time a step it depends on changes: an `OK` given against the old snapshot lapses with it. An `OK` names the revision it approves and approves nothing newer; `OK step3@r1` arriving after `step3@r2` was sent is answered with a `NOTE` and the gate stays closed until `OK step3@r2`.
- **Reading a revision.** `git diff <baseline> <ref> -- <files>` for the change, `git show <ref>:<path>` for a whole file. Running a check needs a tree. When the `REVIEW` declares the scope idle until the answer, the working tree is that tree; the scope is the item's files plus everything its checks import, load or run against, because a test that reads a helper the driver is editing checks a mixed tree. Otherwise `git worktree add --detach <dir> <ref>` under `~/.cache/claude-pair/` gives the reviewer the exact revision while the driver keeps editing (untracked build dependencies such as `node_modules` may need linking in). The `OK` says which of the two it ran against.
- **Evidence** is the command, its result, the lines that matter, and the snapshot or environment it ran against. Not the whole log. A check that was not run is "not run: <reason>", never a pass.
- The reviewer checks for themself and names in `OK` the place actually looked at; a verdict without a location is the rubber stamp the second session exists to avoid. The author of a fix is never its only reviewer: the driver's code is checked by the tester or the architect, the tester's tests by the driver or the architect, in particular whether they fail without the fix and test the criterion.
- A task without a repository skips the refs and records the working directory and, for each revision, the paths and a copy under the state directory. When the task is over, `snap.sh clean <run>` removes the refs; the driver does it after the closing report, or leaves them when the user wants to look.

## State file

The driver keeps one short file per run at the path `snap.sh state <run>` prints: `~/.cache/claude-pair/<repo basename>-<12 hex of the repository path>/<run>.md`, outside the repository so it never shows up in `git status` or in a review, keyed by the run so a second run of the same task cannot overwrite the first run's plan, members and approvals. `START` carries the path; after a context loss it is rebuilt with `snap.sh runs` and `snap.sh state <run>`. The driver is the only writer; other members send `NOTE`, `BLOCK`, `OK` and `FIX`, copy the driver on verdicts they exchange among themselves, and the driver records them. When the driver is unavailable the file is stale and its first line says since when.

```
# <task>
updated: <date time> by driver
goal: <expected result: diagnosis | report | implementation | PR | deployment with verification>
done when: <criteria, checkable>
authorised: <what the user already allowed: run tests, reset the dev db, push to branch X, deploy to staging, ...>
members: driver=<session> architect=<session> tester=<session>   (or navigator=<session>)
run: <task>-<stamp>
baseline: refs/pair/<run>/baseline <sha>, HEAD <sha>; user's own changes: <paths, or none>
plan:
  1. <step> — proof: <command or observation> — gate: architect | tester | user | async
  ...
reviews: plan@r2 OK architect, OK tester | step1@r1 14fa8fe OK tester | step3@r2 9c1d0aa pending architect
decisions: <date> <one line each>
blockers: <open ones, who raised, what stops, what unblocks>
resources: files: tests/** = tester, src/** = driver | db: shared dev db, tester runs migrations | port 3000: driver's dev server
```

Update it at every `OK`, `FIX`, `BLOCK`, `DECISION` and step boundary. It is written for a session that lost its context: after a compaction, read this file and the state file, then continue. A member whose state file is missing asks the driver with a `NOTE`; a driver whose file is missing tells the team it is rebuilding the file from their last `OK`s and `BLOCK`s and asks them to resend what is open.

## Gates and parallel work

Reviewing every step before the next one starts costs two full model turns per step and is rarely what the risk needs. The plan says where approval is required and who gives it:

- **Gated** steps need `OK` from the named member before dependent work starts: an interface the tester will write against, a schema or migration, a public API, anything on a shared resource. `gate: user` means the user decides, through `AskUserQuestion` in the driver's tab.
- **Operations outside the working tree are gated before they run, not after.** A deployment, a migration on a shared database, a push, a data change: the `REVIEW` carries the prepared operation (the command or artifact, the target, the rollback) and the operation runs only after `OK`. What it did is then verified and reported as its own item, `<item>-run@rN`, with the verification evidence and the environment. A gate that opens after the environment has changed is not a gate.
- **Async** steps are reviewed after they land while the driver continues. They still need an `OK` before `final`; an async item without one is reported to the user as unreviewed, not as approved.
- The plan itself is always gated: `OK plan@rN` from the architect or navigator for the shape, and from the tester for the acceptance criteria and the test approach, before the first edit. In a pair the navigator gives both.
- A task of one step has one review: `final`. The plan is still reviewed first, because it is where the criteria and the file owners are agreed.
- **Strict mode** gates every step and announces each one in a `NOTE` before the edit. It is on when the user asks for it ("step by step", "krok po kroku", `--strict`) or when the task changes a live system where a wrong step is expensive.

Silence is not agreement. A gate opens because `OK` arrived for the current revision, never because nothing did. Waiting means ending the turn; the reply wakes the session. A driver that runs out of independent work while a gate is pending tells the user so and ends the turn.

The tester does not wait for the implementation to finish: scenarios, test code and reproductions are written from the plan and the agreed interfaces, in the tester's own files, and partial results go out as `NOTE`s. A test written before the code is red by design; that is a `NOTE`, not a `BLOCK`.

## Findings versus blockers

What the tester finds in the product and what stops the team are two different things. A failing criterion is a finding: it goes into a `FIX` on the item under review, or, when the task's result is a report of what is wrong, into that report as a reproducible entry. It becomes a `BLOCK` only when work that depends on the broken thing is about to continue on top of it, or when a `final` is about to claim a criterion that does not hold. In a task whose goal is to find bugs, a bug found is the result, not a stop.

## Shared resources

- Every file the team edits has one owner, named in the plan and the state file. Editing somebody else's file is a proposed diff in a `NOTE` to the owner, who applies it or says why not.
- A separate worktree (`git worktree add`) is for the case where two members' edits would collide, such as tests written against code the driver is rebuilding at the same time. It is not the default, and it is recorded under resources when used.
- Databases, servers, ports, builds and deployment environments are shared. A change that disturbs another member's run, such as a restart, a seed reset, a schema change or a port change, is announced in a `NOTE` to whoever is using the resource first, and not made while their check is running.

## Result and finish

`START` and the plan name the expected result: a diagnosis, a report, an implementation, a PR, a deployment with verification. The team works until that result is reached, within `authorised`. Which files an implementation touches is the team's to work out from the task; what needs the user is a wider goal or a wider permission: a push, a deploy, a data change, a scope the task did not ask for, an edit to the user's own uncommitted changes. Such a thing is asked once through `AskUserQuestion` in the driver's tab, recorded under `authorised` and sent as a `DECISION`; what is recorded there is not asked again. Another member's `OK` is never a substitute for the user's permission.

The order at the end is: reach the result, then review it, then close.

1. The driver reaches the result within `authorised`: the code passes its checks, the deployment ran and its `-run` item was verified, the report is written. A result another member authored, such as the tester's report in a testing-only task, is its own item (`report@rN`), reviewed by the driver and the third member first.
2. `REVIEW final@rN` goes to every member with a snapshot and evidence that fits the result: for code, the increment against the baseline and the test output; for a report or diagnosis, the document's path and the checks behind its claims; for a deployment, the verification command, its output and the environment it ran against. The reviewers read the whole, not the sum of the steps, because integration mistakes show only there. Every async item needs its `OK` by now.
3. The task closes on `OK final` from every reviewer, and the driver's closing report to the user carries the result, the evidence and the limitations. A `final` that got a `FIX`, an `OK` missing because a reviewer is unavailable, or an open `BLOCK` means the task is unfinished, and the report says so rather than closing around it.

## Disagreement

The driver decides how something is implemented. The architect (or navigator) decides whether it should be and where it belongs. The tester decides whether a criterion is met. Every member can raise a finding outside their own area.

A technical dispute is settled by a fact first: the code, the documentation, a test, a small experiment that whoever proposes it runs within their own resources. A message that adds no new fact, evidence or experiment is not sent; the next message is an experiment proposal or a question to the user. What goes to the user, through the driver's tab, is what facts cannot settle: scope, priorities, permissions, acceptable risk. When the driver is in plan mode, a disagreement about the plan becomes a corrected plan that the user approves at `ExitPlanMode`.

## Team, waiting, unavailability

- The driver assembles the team from `ListAgents`. A session the user named, or one carrying a role name (`pair-architect`, `pair-tester`, `pair-nav`), is taken as that member. Anything else is asked with one `AskUserQuestion` listing the sessions, even when only one idle session exists: the one idle session may belong to unrelated work.
- The `START` handshake confirms membership: the answer names the role the session is running, its working directory and the task. A different role, directory or task means the session is not a member; the driver stops and tells the user.
- Waiting is ending the turn. Unavailability is a fact the user states or `ListAgents` shows; nobody infers it from silence. When a member whose `OK` a gate needs is unavailable, the dependent work stops, the state file records it, and the closing report lists every item that got no independent review and calls the task unfinished. Work done alone is never reported as reviewed by the team.

## Losing context

Every message header carries the role, the task and the item, so a compacted transcript still shows where things stand. After a compaction: read this file (its path is in `START`) and the state file, then continue from `reviews` and `blockers`; the snapshot refs are still there (`snap.sh list <run>`). Without `START`, `snap.sh runs` names the run and `snap.sh state <run>` the file. Missing all of that, send a `NOTE` to the driver asking for the paths.

## Permissions

Each session has its own permission settings. Do not ask another session to perform an action that was denied in yours, or that you expect your own settings would block. The other session doing it for you bypasses a decision the user made. Take blocked work to the user instead.

## Sequences

Pair, small fix:

```
navigator: waits (turn ended)
driver:    snap.sh baseline; START
navigator: NOTE ready — role, cwd, first questions
driver:    REVIEW plan@r1 (result, done-when, steps with proof, gates, file owners)
navigator: FIX plan@r1  -> driver: REVIEW plan@r2 -> navigator: OK plan@r2
driver:    edits, tests; snap.sh final-r1; REVIEW final@r1 (ref + sha, increment against baseline, test output)
navigator: OK final@r1 (with a suggestion or two, nothing owed)
driver:    reports to the user; commits, pushes or opens the PR only if authorised
```

Team, implementation with tests written in parallel, then a deployment:

```
architect, tester: wait
driver:    snap.sh baseline; START -> architect, START -> tester
architect: NOTE ready ; tester: NOTE ready
driver:    REVIEW plan@r1 -> both (step 1 = interface, gate: architect+tester; 2–3 async; 4 = deploy, gate: architect, user)
architect: OK plan@r1 ; tester: FIX plan@r1 (criterion 3 not checkable) -> driver: REVIEW plan@r2 -> both OK
driver:    step 1; snap.sh; REVIEW step1@r1 (ref + sha) -> both
tester:    OK step1@r1 ; writes tests against the interface, NOTE partial results (red by design)
architect: OK step1@r1
driver:    steps 2–3, snap.sh + REVIEW each (async, scope idle: no)
tester:    FIX step3@r1 — criterion 2 fails on 7e2b1c0 (worktree of the snapshot), output quoted  (copied to nobody: the driver is the addressee)
driver:    fixes; snap.sh; REVIEW step3@r2 ; tester: OK step3@r2
tester:    REVIEW tests@r1 -> architect, copy driver ; architect: OK tests@r1 -> tester, copy driver
driver:    REVIEW deploy@r1 (command, target, rollback) -> architect ; architect: OK ; user authorised in plan
driver:    runs the deployment ; REVIEW deploy-run@r1 (verification output, environment) -> tester ; tester: OK
driver:    snap.sh; REVIEW final@r1 -> both ; both OK ; driver reports to the user, snap.sh clean <run>
```
