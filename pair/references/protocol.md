# Pair protocol

Two or more Claude Code sessions in the same working directory work on one task and talk through `SendMessage`. Two sessions are a pair: a driver and a navigator. A team is one driver, one or more architects and one or more testers; three sessions is the smallest team and nothing above it is special. This file is the contract every role follows. It is precise where responsibility, blocking and approval are decided, and loose everywhere else, because most of the value of a second session is conversation and most of the cost is turns.

There is exactly one driver. A second driver seen in `ListAgents` belongs to somebody else's task: it is never taken, never stopped and never sent a `START`.

## How messages travel

- Discover the other sessions with `ListAgents`; every row reads `name [ref]`, and the name is the address for `SendMessage`.
- A message to an idle session wakes it and starts a new turn. A message to a busy session waits and is delivered between its tool calls. There is no delivery receipt and no clock: a sender cannot tell whether the other side is thinking or gone. Nobody polls `ListAgents` in a loop or sends "are you there"; an unanswered message is a reason to tell the user, not to send it again.
- Plain text output is invisible to the other sessions. Only `SendMessage` crosses the gap, and it goes to one session at a time: a message meant for three members is sent three times, with the same body.
- The terminal shows the receiver only the first line of a message until it is expanded. That line is the header below and it has to stand alone.
- A message arrives wrapped as `<cross-session-message from="...">`. Reply to the `from` value: that is an address the tool returned, not one anybody reconstructed.

## Session names

A renamed tab is how the user says what a session is for, and it decides four different things that are worth keeping apart, because confusing them is how a session ends up addressed by its role or configured by its name.

**Detecting the role.** The bases are `pair-nav` (navigator), `pair-architect`, `pair-tester` and `pair-driver`. A name is that role when it is *exactly* the base, or when it begins with the base followed by `-` and at least one more character. Nothing else matches:

| name | role | why |
|---|---|---|
| `pair-architect` | architect | exactly the base |
| `pair-architect-[project]-[code-quality]` | architect | base, `-`, a suffix |
| `pair-architect-project-code-quality` | architect | the same without brackets |
| `pair-tester-e2e` | tester | base, `-`, a suffix |
| `my-pair-architect` | none | does not begin with the base |
| `pair-architectural` | none | the base is followed by `u`, not `-` |
| `pair-testers` | none | the base is followed by `s`, not `-` |
| `pair-tester-` | none | empty suffix |

**Reading the labels.** The suffix is everything after `<base>-`.

- A suffix containing `[`: the labels are exactly what stands inside the brackets. Anything outside them is decoration, not a label. `pair-architect-[project]-[code-quality]` carries `project` and `code-quality`.
- A suffix with no brackets is one free label, and known profile identifiers are looked for inside it: a match has to be bounded by the start or the end of the suffix or by `-`, and longer identifiers are tried first, so `code-quality` stays one identifier instead of falling apart into `code` and `quality`. `pair-architect-project-code-quality` carries both; whatever is left over stays a free label.
- Labels are a **set**. Order carries no meaning and a repeat does nothing twice: `[project]-[code-quality]` and `[code-quality]-[project]` are the same configuration, and `[project]-[project]` is `project` once.
- A label that is not a known profile identifier is a session label, not a new profile. On a tester it is that session's **proposed scope** — `api`, `e2e`, `regression` — and there is no tester profile catalogue and no tester profile picker in this version; the plan settles a tester's scope.

**The active configuration.** A label switches nothing on by itself. For an architect and for a navigator the user's answer to the profile question decides (see *Architect profiles*); for a tester the plan decides. The suffix is a suggestion, shown in the question and repeated in the handshake, and the user's answer wins over it.

**Identity and address.** A name is neither, and the next section says what is.

Square brackets live in session names only. They never reach a run id, an item name or a ref: `snap.sh` rejects them, which is the behaviour you want.

## Members and identity

`ListAgents` prints one row per session as `name [ref]` — `pair-architect [88e104]`. Three different things come out of that row and each has one job:

- **Identity** is the `ref`. It survives a rename and it is what tells two sessions apart when their displayed names are identical.
- **The address** is the name. Append ` [ref]` only when the listing shows two rows with that name or when the tool asks you to disambiguate. Replying to an incoming message always uses its `from` value. An address is never built out of a role or a profile: `pair-architect-[project]` is a name that happens to describe a configuration, not a way of addressing whoever holds that configuration.
- **The member id** is a short handle the driver assigns in `START` and everybody uses afterwards: `d` for the driver, `n` for a navigator, `a1`, `a2`, … for architects, `t1`, `t2`, … for testers. It is what appears in every header, every plan item and every verdict, because a role name stopped being unique the moment a team could hold two architects.

The state file keeps the mapping — id, role, displayed name, ref, and each member's configuration. These cases are ordinary and are handled rather than avoided:

- **Two architects with identical profiles.** Normal. They differ by id and by ref, and they review different scopes because the plan says so, not because their profiles differ.
- **Two sessions showing the same name.** Address them as `name [ref]`. If even that will not resolve, the driver asks the user to rename one and does not guess: a review sent to the wrong tab is a verdict credited to somebody who never gave it.
- **A rename mid-task.** The ref and the member id stay; the member sends a `NOTE` saying it renamed, and the driver corrects `name=` in the state file. Nothing else moves.
- **No way to address a session unambiguously.** That is a question to the user, not a reason to send hopefully.

**A `START` never replaces an assignment a session is still holding.** A reviewing tab that is mid-run for one driver looks exactly like a free one in `ListAgents` — idle between turns is what waiting for a gate looks like — so the check has to happen at the receiving end, before anything is adopted. On `START`, a session holding an **active** assignment compares the pair **(run id, driver ref)** in the message against the one it holds: both equal is a resend and is answered normally; anything else is declined in a `NOTE` naming the run it is already serving, and nothing is taken from the new message — not the id, not the roster, not the state file path, not the task. Adopting first and sorting it out later cannot work, because from that moment the session answers about the wrong task, and the driver that lost it hears nothing at all.

Compare the **ref**, not the displayed name. A driver that renames its tab mid-task is still the same session, and a name comparison would turn its own resent `START` into a stranger's and strand the run behind a decline nobody expected. The name is for display and for addressing; the ref is what says who.

**An assignment stops being active when the run ends, and the run ends explicitly.** A guard with no release turns every finished task into a set of tabs that refuse the next one, which is the same failure as no guard at all, only quieter. So the state file carries a `status:` line — `active`, `complete`, `unfinished` or `abandoned` — the driver writes the terminal one as its last act, and sends a closing `DECISION` naming the run and that status to every member. On receiving it a member drops the assignment and is free for the next `START`; the record of what it did stays in the state file, which is where it belonged anyway. A task that ends unfinished — a `FIX` on `final`, a missing `OK`, an open `BLOCK` — is released the same way: `unfinished` is a status, not a reason to hold four tabs hostage. And a member left holding an assignment whose driver is simply gone is released by its own user saying so in its tab, because a closing `DECISION` that will never arrive is not something to wait for.

A driver that gets such a decline records that session as unavailable and tells the user. Whether the other run is over is the user's to say, not something to infer from a tab looking quiet.

## Message shape

First line, always:

```
[id role] TYPE task/item@rN: one sentence saying what this is about
```

`id` is the member id from `START` and `role` is `driver`, `navigator`, `architect` or `tester`, so a reader sees at once both which seat spoke and which occupant of it. `task` is the ticket key or the slug chosen in `START`. `item@rN` names a work item and its revision (`plan@r2`, `step3@r1`, `tests-t1-api@r1`, `deploy@r1`, `final@r1`) and appears whenever the message is about one; a `NOTE` about nothing in particular drops it. The rest is prose: short paragraphs, bullets, code and command output in fenced blocks. No JSON, no greetings, no acknowledgements.

```
[a2 architect] FIX step3@r1 9c1d0aa: the handler reaches into the repository in the opposite direction from the rest of the module
```

## Message types

Two kinds. `NOTE` and `DECISION` are conversation: nobody owes an answer and nothing stops. `REVIEW` and `BLOCK` are requests: somebody is waiting.

| Type | Sent by | Carries | Owed in return |
|---|---|---|---|
| `START` | driver | the task as the user gave it, the expected result, **the run id and the driver's own ref**, the whole roster (every member's id, role, name and ref, the driver included), the recipient's own id, the absolute paths of this file and of the state file | a `NOTE` saying ready, with the sender's id, role, working directory (or repositories), configuration — an architect's or navigator's profiles and user note, a tester's proposed scope — and first questions or risks; or a `NOTE` declining, when the session is already serving another run |
| `NOTE` | anyone | a question, an observation, a proposal, a counter-proposal, a partial result, a relayed user instruction, a proposed diff, a claim on an exclusive resource or its release, a rename, a change of profiles, "I am investigating X, expect an answer later" | nothing; answer when there is something to say |
| `REVIEW` | the item's author | a request to review `item@rN`: the snapshot ref and its sha, what changed (every file, new ones included), what else the snapshot holds that is not the item, the evidence, a `required:` block naming each reviewer by id with the scope asked of them, and whether the scope is idle until the answer. One body, sent unchanged to every required reviewer | `OK` or `FIX` for the same `item@rN`, from each id in `required` |
| `OK` | a reviewer | approval of `item@rN` by that one member, plus what was checked and where: the file and place read, the command run and against what; on `final`, whether it covers the tree, the report or both. May carry suggestions; the author takes or leaves them and no new review is owed | nothing |
| `FIX` | a reviewer | changes the item needs before it can pass, each with its reason and location. Reserved for that; a suggestion goes in an `OK` or a `NOTE` | a new revision and a new `REVIEW item@rN+1` |
| `BLOCK` | anyone | a concrete problem, the evidence or the risk, which work stops because of it, and what unblocks it | a resolution, an experiment, or a note that the user was asked |
| `DECISION` | whoever settled it, usually the driver | a change to the plan, the scope, an assumption, a resource, the roster or a member's configuration, and the closing one that names the run's terminal status and releases every member, sent to everyone it affects | nothing; a counter-proposal is a `NOTE`, a `BLOCK` only when the decision breaks something and the evidence says so |

A `BLOCK` stops the work it names, not the team. Anything that depends on the blocked item waits; everything else continues. A style preference is never a `FIX` or a `BLOCK`.

**The driver sees every verdict.** A `REVIEW`, `OK`, `FIX` or `BLOCK`, and the message that resolves a `BLOCK`, exchanged between two other members (a tester's tests reviewed by an architect, say) is also sent to the driver, same text, because the driver records it in the state file and a review the state file does not know about did not happen for the session that resumes from it. `NOTE`s are not copied: a working note broadcast to five sessions is five interrupted turns.

Relay what the user says. An instruction the user gives in one tab that changes what the others should do goes out in the same turn, as a `NOTE` or, when it changes the plan, a `DECISION`. Relay the instruction, not the conversation around it.

## Architect profiles

An architect's standing duties hold in every session and are not a profile: where the change lands and how it is structured, the interfaces and contracts, the dependencies and consequences, compatibility and reversibility, and everything else under review below. A **profile** is an added priority on top of that base, chosen by the user for one session, and several can be on at once.

Three exist:

| id | file | what it adds |
|---|---|---|
| `code-quality` | `${CLAUDE_PLUGIN_ROOT}/references/architect-profiles/code-quality.md` | readable code with well-chosen responsibilities and abstractions |
| `project` | `${CLAUDE_PLUGIN_ROOT}/references/architect-profiles/project.md` | growing the system along its own architecture and conventions |
| `pragmatist` | `${CLAUDE_PLUGIN_ROOT}/references/architect-profiles/pragmatist.md` | a solution proportionate to the task and cheap to keep |

The rules that hold whatever the mix:

- The user chooses, through one `AskUserQuestion` in that session's own tab, before the session starts waiting. **Default** means no added profile and is neutral when it arrives alongside others: ticking Default and Code Quality leaves Code Quality on. A profile named in the session's suffix is a suggestion carried into the question, never an activation, and a suffix naming no profile does not skip the question. A question the user interrupted is not an answer: nothing is configured, the session says so in a line and asks again rather than assuming Default.
- Profiles are per member. Two architects in one team can hold different sets, the same set, or none, and each answers only for the scope the plan gave it.
- Profiles add priorities; they do not widen the task. A finding a profile surfaces is still weighed the ordinary way: a `FIX` is what the item needs before it passes, everything else rides inside an `OK` or a `NOTE`. Taste alone is never a `FIX`.
- Combinations resolve by their own reasoning rather than by precedence. **Code Quality with Project**: raise quality inside the project's architecture, make a larger departure from it explicit in the plan instead of in a diff, and do not treat an existing mistake as a pattern that has to be preserved. **Code Quality with Pragmatist**: prefer readable code and abstractions that earn their place, and remove complication that buys nothing concrete. **Pragmatist with anything** never excuses skipping correctness, security, the tests the plan requires or an agreed contract.
- Changing profiles mid-task is a `NOTE` to the driver naming the new set and the items the architect wants to reread; the driver records a `DECISION` and sends it to whoever it affects. Earlier `OK`s are not voided by the change — the architect says which items it is rereading, and only something it actually finds becomes a `FIX` on the current revision.

## Snapshots: baseline and revisions

A revision number alone says nothing about content: the driver sends `step1@r1` and keeps working in the same directory, so a reviewer reading the files sees step 2 half done. Every reviewable state is therefore a snapshot of the working tree, taken with `${CLAUDE_PLUGIN_ROOT}/scripts/snap.sh` as a git ref that touches neither the index nor `git status`:

```sh
snap.sh baseline TES-42            # once, before the first edit -> "TES-42-20260908-1402 refs/pair/TES-42-20260908-1402/baseline e1f4839"
snap.sh baseline TES-42 --run TES-42-20260908-1402   # the same run id in a second repository the task spans
snap.sh TES-42-20260908-1402 step1-r1        # with every REVIEW: <run> <item>-r<N> -> "refs/pair/.../step1-r1 14fa8fe"
snap.sh TES-42-20260908-1402 tests-t1-api-r1 # an item whose name carries its author
snap.sh list TES-42-20260908-1402       # every ref of the run with its sha
snap.sh clean TES-42-20260908-1402      # removes the run's refs, when the user asks for it
snap.sh runs                            # every run with a baseline in this repository
snap.sh state TES-42-20260908-1402      # the path of the run's state file
```

The script initialises a temporary index from `HEAD` before adding the working tree, so tracked files that match `.gitignore` are snapshotted too (an empty index would silently drop them); it works in a repository with no commit yet; it removes its temporary index; and it refuses to overwrite an existing ref, because a revision that can change is not a revision. The `<run>` id carries a timestamp, so a second run of the same task gets its own namespace instead of replacing the first baseline. Run ids and snapshot names are validated (letters, digits, `.`, `_`, `-`), so `clean` cannot be handed a glob that matches other runs.

- **Item names are unique within the run, and the plan is where they are fixed.** An item only one member can author keeps its plain name: `plan`, `stepN`, `deploy`, `deploy-run`, `final`, all the driver's. An artifact more than one member could produce carries its author's id, and a scope label after it when that helps a reader: `tests-t1-api`, `tests-t2-e2e`, `report-t1`. Two testers publishing under `tests` would collide on the ref — `snap.sh` refuses the second one, which is the good outcome, but the plan should never have let them try. Names are lower-case letters, digits and `-`; the brackets from a session name never come along. Nobody invents an item name the plan does not have without a `NOTE` to the driver, who adds it.
- **Baseline.** Before the first edit the driver runs `snap.sh baseline <task>` and records the run id, the ref and sha, `git rev-parse --short HEAD` and `git status --short` in the state file. Files dirty at that point are the user's: never reverted, reformatted or staged by the team, and if the task cannot avoid editing one the driver tells the user before the first edit. The team's increment is `git diff refs/pair/<run>/baseline refs/pair/<run>/<item>-r<N>`, which shows the team's lines inside a file the user had already modified, shows new files, and still works after an authorised commit has emptied `git status`. Always diff snapshot against snapshot; a diff against the working tree hides untracked files and moving edits. A task that spans several repositories is one run and not several: the baseline is taken in the main repository first and in each of the others with `snap.sh baseline <task> --run <the same id>`, so a single id names the whole increment. Without the flag the two repositories get ids stamped a second apart, which is what the first multi-repository run had to work around, and two ids cannot be quoted as one revision.
- **Revisions.** The author runs `snap.sh <run> <item>-r<N>` immediately before sending `REVIEW item@rN` and puts the ref and the sha it printed in the message; every reviewer's `OK` repeats the sha, so all of them are provably talking about the same tree. The revision bumps every time the item changes after a `REVIEW` went out, and every time a step it depends on changes: an `OK` given against the old snapshot lapses with it, whoever gave it. An `OK` names the revision it approves and approves nothing newer; `OK step3@r1` arriving after `step3@r2` was sent is answered with a `NOTE` and the gate stays closed until that member sends `OK step3@r2`.
- **The snapshot is the whole tree, not the item.** It also holds whatever else was in the working tree at that moment: a tester's half-written tests, the driver's started next step. The `REVIEW` says what that is, and the reviewer diffs by the item's files. A check that runs through code outside the item, such as step 4's test reading a helper that step 5 is rewriting, is a partial result: it goes out as a `NOTE` naming the dependency, not as an `OK`. It does not open a gate the item needs; the `OK` follows once the dependency has its own `OK` or the check is rerun without it. For an async item the driver keeps working meanwhile. The driver's cheapest defence is order: snapshot and send before starting the next step.
- **Files the author does not own.** The snapshot freezes whatever another member happened to be writing at that moment, and that cost four withdrawn revisions in the first six runs: a test file caught mid-move, tests appended a second after the ref was taken. With several testers writing at once there is simply more of it. So the `REVIEW` lists every file in the snapshot the author does not own with its hash (`git show <ref>:<path> | sha256sum`) and with the id of the member who owns it, and that owner compares the hash against its own tree.

  **Owners and reviewers are two different lists, and the second does not contain the first.** An item reviewed by `a1` and `t1` can perfectly well have frozen `t2`'s tests, and `t2` never sees the `REVIEW`. So the author sends the hash lines for a member's own files to that member as well, as a `NOTE` and not a second `REVIEW`: nothing is owed when the hashes match, because the point is to give the owner the chance to notice, not to collect another approval. What the owner owes is the correction — a `NOTE` saying the file moved — and what that costs depends on **where** the file sits. Inside the item's scope, which is its own files plus everything its checks import, load or run against, the revision is stale and the author takes the next one, whoever sent the `NOTE`. Outside it, the difference is information and nothing more: it is recorded, the reviewers are told what in the snapshot is not the item, and the review stands. Otherwise a tester writing E2E tests all afternoon would invalidate a settled API item on every save, and the revisions would stop meaning anything long before anybody stopped bumping them. Where the item's own evidence runs through an owner's files, that owner is not merely notified: the plan or the `REVIEW` puts them in `required` with *confirm your files in this snapshot* as their scope, because then a stale file does not just annoy somebody, it invalidates the check the gate is resting on. A difference is a `NOTE` — *my file moved after your snapshot, this needs a new revision* — and not a `FIX`: nobody did anything wrong, the revision simply is not what the reviewer holds. Compare by hash rather than by diff, because `git diff --stat <ref>` reports an untracked file as a deletion whether it changed or not, so a tree can match the ref in every tracked file and differ exactly where the item lives. And read the exit status of whatever produced the hash: `git show <ref>:<a path that is not there>` piped into `sha256sum` prints the hash of empty input, and one run spent a round comparing the sha256 of git's error text against real content.
- **Reading a revision.** `git diff <baseline> <ref> -- <files>` for the change, `git show <ref>:<path>` for a whole file. Running a check needs a tree. When the `REVIEW` declares the scope idle until the answer, the working tree is that tree; the scope is the item's files plus everything its checks import, load or run against, because a test that reads a helper the driver is editing checks a mixed tree. Otherwise `git worktree add --detach <dir> <ref>` under `~/.cache/claude-pair/` gives the reviewer the exact revision while the driver keeps editing (untracked build dependencies such as `node_modules` may need linking in). The `OK` says which of the two it ran against. Two reviewers checking out the same ref use two directories; a worktree path carries the reviewer's id.
- **Evidence** is the command, its result, the lines that matter, and the snapshot or environment it ran against. Not the whole log. A check that was not run is "not run: <reason>", never a pass. Evidence longer than a screen goes into one file next to the state file, `<state dir>/<run>/<item>-rN.md`, written once by the author; the message quotes the path and the decisive lines, and every reviewer reads the same artifact instead of a retelling.
- Each reviewer checks for themself and names in its `OK` the place actually looked at; a verdict without a location is the rubber stamp the second session exists to avoid. The author of a fix is never its only reviewer: the driver's code is checked by a tester, an architect or the navigator, a tester's tests by the driver, an architect or **another tester**, and the navigator's own tests and reproductions by the driver — never by their own author, in particular on whether they fail without the fix and test the criterion. In a pair this crosses in both directions: the navigator reviews the driver's items and the driver reviews the navigator's, each as its own item with its own revision.
- A task without a repository skips the refs and records the working directory and, for each revision, the paths and a copy under the state directory.
- **The refs outlive the task.** `snap.sh clean <run>` removes them and it runs when the user asks for it, not as part of finishing: the closing report cites the refs by name, so cleaning empties its own evidence, and in the field the baseline twice held the only copy of a file that had disappeared from the working tree during the run. The closing report says in a line that the refs are there and how to remove them.

## State file

The driver keeps one short file per run at the path `snap.sh state <run>` prints: `~/.cache/claude-pair/<repo basename>-<12 hex of the repository path>/<run>.md`, outside the repository so it never shows up in `git status` or in a review, keyed by the run so a second run of the same task cannot overwrite the first run's plan, members and approvals. `START` carries the path; after a context loss it is rebuilt with `snap.sh runs` and `snap.sh state <run>`. The driver is the only writer; other members send `NOTE`, `BLOCK`, `OK` and `FIX`, copy the driver on verdicts they exchange among themselves, and the driver records them. A member that needs to know its own configuration after a compaction reads it here rather than asking the user again.

```
# <task>
updated: <output of date -Iseconds> by driver   (the time of the last write, from the clock, not a model's guess; it is not evidence of when anybody became unavailable)
goal: <expected result: diagnosis | report | implementation | PR | deployment with verification>
done when: <criteria, checkable>
authorised: <what the user already allowed: run tests, reset the dev db, push to branch X, deploy to staging, ...>
members:
  d  driver     name=<displayed name> ref=<[abc123]>
  a1 architect  name=pair-architect-[project] ref=<[88e104]> profiles=project
                note="the public API must stay backward compatible"
  a2 architect  name=pair-architect-[code-quality]-[pragmatist] ref=<[4c9b12]> profiles=code-quality,pragmatist
  t1 tester     name=pair-tester-[api] ref=<[85a4ce]> scope="API contract and error codes" label=api
  t2 tester     name=pair-tester-[e2e] ref=<[7d1a03]> scope="checkout end to end, integration run" label=e2e
run: <task>-<stamp>
status: active | complete | unfinished | abandoned   (terminal status written by the driver as its last act, and sent to every member as a closing DECISION that releases them for the next run)
repos: <path> refs/pair/<run>/baseline <sha>, HEAD <sha>; user's own changes: <paths, or none>   (one line per repository, the main one first)
plan:
  1. <step> — author: <id> — proof: <command or observation> — gated: a1 (<scope>), t1 (<scope>)
  2. <step> — author: <id> — proof: <...> — async: a2 (<scope>)
  ...
reviews:
  plan@r3 4a91c2b required a1,a2,t1,t2 | OK a1 | OK a2 | OK t1 | FIX t2 -> r4
  step1@r1 14fa8fe author d required a1,t1 | OK t1 (suite on the snapshot) | pending a1
  tests-t1-api@r2 7e2b1c0 author t1 required a2 | OK a2
  late: OK a1 step3@r1 arrived after step3@r2 went out — not counted
decisions: <date> <one line each, including roster and configuration changes>
blockers: <open ones, who raised (id), what stops, what unblocks>
resources: files: src/** = d, tests/api/** = t1, tests/e2e/** = t2 | db: shared dev db = exclusive, keeper: d, held by: <id or free> | port 3000: d's dev server
```

A run spanning several repositories keeps **one** state file, in the main repository's directory, and `START` carries that path. In every other repository's cache directory the driver leaves a one-line pointer, `see: <that path>`, so `snap.sh state <run>` from there leads somewhere after a context loss; a state file whose whole content is a `see:` line means the real one is elsewhere. The first multi-repository run kept two full copies instead, and the only thing holding them in step was that nobody edited the second.

**A state file from an older run reads fine and is normalised, not reinterpreted.** `members: driver=X architect=Y tester=Z` becomes `d`, `a1`, `t1` and `reviews: plan@r2 OK architect, OK tester` becomes `OK a1 | OK t1`, because with one architect and one tester the mapping is unambiguous and the history is worth keeping. Where the old text does not map onto exactly one member, the driver leaves it verbatim and asks in a `NOTE` who gave it. An approval attributed to the wrong member is worse than an approval attributed to nobody.

Update it at every `OK`, `FIX`, `BLOCK`, `DECISION` and step boundary, and take `updated:` from `date -Iseconds`: the model has no clock, and the first live run wrote times three hours ahead of the wall. It is written for a session that lost its context: after a compaction, read this file and the state file, then continue. A member whose state file is missing asks the driver with a `NOTE`; a driver whose file is missing tells the team it is rebuilding the file from their last `OK`s and `BLOCK`s and asks them to resend what is open.

## Gates and parallel work

Reviewing every step before the next one starts costs two full model turns per step and is rarely what the risk needs, and with five members it is the whole budget. The plan says, for every item: its **author**, the **reviewers required** by id, the **scope** asked of each of them, and whether it is **gated** or **async**.

```
plan:
  1. repository interface — author d — proof: unit test —
     gated: a1 (contract and direction of the dependency), t1 (that criterion 2 is checkable against it)
  2. handler — author d — proof: `npm test -- handler` — async: a2 (naming, duplication)
  3. api contract tests — author t1 — proof: red before step 1 lands — async: a1
```

- **Gated** items need `OK` from every required id before dependent work starts: an interface a tester will write against, a schema or migration, a public API, anything on a shared resource. `gate: user` means the user decides, through `AskUserQuestion` in the driver's tab.
- **Operations outside the working tree are gated before they run, not after.** A deployment, a migration on a shared database, a push, a data change: the `REVIEW` carries the prepared operation (the command or artifact, the target, the rollback) and the operation runs only after every required `OK`. What it did is then verified and reported as its own item, `<item>-run@rN`, with the verification evidence and the environment. A gate that opens after the environment has changed is not a gate.
- **Async** items are reviewed after they land while the driver continues. They still need every required `OK` before `final`; an async item short of one is reported to the user as unreviewed, not as approved.
- **The plan and `final` go to every reviewer in the agreed roster.** Ordinary steps do not: the driver picks reviewers by risk, by dependency and by what the profiles make each architect good at, and an item reviewed by everybody who could review it is turns spent on agreement that was never in doubt.
- A task of one step has one review: `final`. The plan is still reviewed first, because it is where the criteria, the item names and the file owners are agreed.
- **Strict mode** gates every step and announces each one in a `NOTE` before the edit. It is on when the user asks for it ("step by step", "krok po kroku", `--strict`) or when the task changes a live system where a wrong step is expensive.

**How a verdict counts.** With more than one reviewer this is where a session quietly goes wrong, so it is spelled out:

- An `OK` is that one member's, for that one `item@rN` and that one sha. A gate opens when **every** id in `required` has sent `OK` for the current revision, and never before.
- A `FIX` from any required reviewer keeps the item open no matter how many `OK`s stand beside it. Another member's `OK` does not answer it, overrule it or replace it; the item needs a new revision.
- A late `OK` for an older revision is recorded under `late:` and opens nothing, whoever sent it.
- A verdict from an id that is not in `members`, or that is not in that item's `required`, opens no gate. The driver records it — it is often worth reading — and asks the user what it is.
- **A reviewer is never dropped from `required` to get past its `FIX` or its silence.** Changing the roster or moving a responsibility is an explicit `DECISION` that says who now covers that scope, so the coverage stays whole. A gate that opened because the reviewer was removed is a gate that never opened.
- The scopes given to the several reviewers of one item have to cover it between them. Each member reviews the scope it was given and, at `final`, reads its own id in the report and checks the evidence credited to it. Nobody writes that everybody ran everything.

Silence is not agreement. A gate opens because `OK` arrived for the current revision, never because nothing did. Waiting means ending the turn; the reply wakes the session. A driver that runs out of independent work while a gate is pending tells the user so and ends the turn.

A tester does not wait for the implementation to finish: scenarios, test code and reproductions are written from the plan and the agreed interfaces, in that tester's own files, and partial results go out as `NOTE`s. A test written before the code is red by design; that is a `NOTE`, not a `BLOCK`. Nor does a tester wait for the plan's `OK`: while the plan is under review, scenarios and isolated test drafts may be written in new files, marked provisional in the `NOTE` that mentions them. What waits for the approved plan is any edit to a file that already exists or that another member may own.

## Findings versus blockers

What a tester finds in the product and what stops the team are two different things. A failing criterion is a finding: it goes into a `FIX` on the item under review, or, when the task's result is a report of what is wrong, into that report as a reproducible entry. It becomes a `BLOCK` only when work that depends on the broken thing is about to continue on top of it, or when a `final` is about to claim a criterion that does not hold. In a task whose goal is to find bugs, a bug found is the result, not a stop.

## Shared resources

- Every file the team edits has one owner, named in the plan and the state file **by member id, not by role**: `tests/api/** = t1` and `tests/e2e/** = t2` are two different owners, and "the tester" names neither. Editing somebody else's file is a proposed diff in a `NOTE` to that owner, who applies it or says why not.
- A separate worktree (`git worktree add`) is for the case where two members' edits would collide, such as tests written against code the driver is rebuilding at the same time. It is not the default, and it is recorded under resources when used.
- Databases, servers, ports, builds and deployment environments are shared. A change that disturbs another member's run, such as a restart, a seed reset, a schema change or a port change, is announced in a `NOTE` to whoever is using the resource first, and not made while their check is running.
- **A resource two members cannot use at once is marked exclusive in the plan, with a keeper**: `db: tesoro-test = exclusive, keeper: d`. Whoever wants it asks for it in a `NOTE` and ends the turn; the run starts after the keeper answers that it is free, and a second `NOTE` releases it. Announcing is not enough for these, because announcing is what failed: in one run the driver and the tester each announced a full suite and each started anyway, and fixtures truncating the same collections produced errors in both tabs from identical code — 75 in one, 91 in the other — which took four discarded runs to explain. Two testers with their own suites are that same failure waiting with a shorter fuse, so a database any of them resets is exclusive from the start. The announcement also cannot travel in the message the run begins in: messages arrive between tool calls, so by the time the other tab reads it the sender is already writing. A claim covers a window rather than a single command, or the two turns it costs are paid on every check. The keeper is the driver unless the plan says otherwise and records the current holder by id in the state file; a keeper that has not answered is a pending gate like any other, so the turn ends and the user hears about it rather than the run starting anyway. Resources not marked exclusive keep the announcement above, which is cheaper and enough for them.

## Result and finish

`START` and the plan name the expected result: a diagnosis, a report, an implementation, a PR, a deployment with verification. The team works until that result is reached, within `authorised`. Which files an implementation touches is the team's to work out from the task; what needs the user is a wider goal or a wider permission: a push, a deploy, a data change, a scope the task did not ask for, an edit to the user's own uncommitted changes. Such a thing is asked once through `AskUserQuestion` in the driver's tab, recorded under `authorised` and sent as a `DECISION`; what is recorded there is not asked again. Another member's `OK` is never a substitute for the user's permission.

The order at the end is: reach the result, then review it, then close.

1. The driver reaches the result within `authorised`: the code passes its checks, the deployment ran and its `-run` item was verified, the report is written. A result another member authored, such as a tester's report in a testing-only task, is its own item (`report-t1@rN`), reviewed by somebody who did not write it before the driver goes on.
2. `REVIEW final@rN` goes to every member with a snapshot and evidence that fits the result: for code, the increment against the baseline and the test output; for a report or diagnosis, the document's path and the checks behind its claims; for a deployment, the verification command, its output and the environment it ran against. The reviewers read the whole, not the sum of the steps, because integration mistakes show only there. Every async item needs its required `OK`s by now.

   **The closing report is written before that review, as a file**: `<state dir>/<run>/final-rN.md`, whose path the `REVIEW` carries next to the snapshot. A report living only inside the driver's messages cannot be signed off, because *approved the tree* and *approved the report* are two claims; one run discovered this with both `OK`s already given on a tree while the unread text over-claimed who had run what. So an `OK final` says which of the two it covers, or both, and the task closes when every reviewer has covered both. Editing the report after a reviewer read it bumps the revision exactly as editing the code does.

   Every check in that report names **who ran it, by member id, and on which tree or environment**. A collective *both reviewers reran this* over a block of evidence is the sentence that proved false twice, in two different runs, caught both times by a tester; one line, one author is what survives, and with two testers and two architects "the reviewers" names nobody at all. Each criterion says how it is held: **executed**, with the command and the output, or **inspected**, by a diff, a grep or a read — a distinction worth keeping because a criterion nobody could execute is not a weaker pass, it is a different claim. A reviewer reads its own id in the report first; a check credited to somebody who did not run it is a `FIX`.
3. The task closes on `OK final` from every reviewer in the roster, covering both the tree and the report. The driver then writes the terminal `status:` into the state file and sends the closing `DECISION` — the run id and that status — to every member, which is what frees those tabs for the next task; a run left `active` because the driver simply stopped writing is a set of sessions that will decline the next `START` for no reason anybody remembers. The driver's closing report to the user carries the result, the evidence and the limitations. A suggestion that arrives inside `OK final` goes into the report as follow-up work by default, not into the code: taking it reopens `final` for every reviewer, and the first live run spent a full round on one. A `FIX` on `final` is still done at once. A `final` that got a `FIX`, an `OK` missing because a reviewer is unavailable, or an open `BLOCK` means the task is unfinished, and the report says so rather than closing around it — and the run is still released, as `unfinished`, because holding the team's tabs is not how an unfinished task gets finished.

## Disagreement

The driver decides how something is implemented. An architect (or the navigator) decides whether it should be and where it belongs. A tester decides whether a criterion is met. Every member can raise a finding outside their own area.

A technical dispute is settled by a fact first: the code, the documentation, a test, a small experiment that whoever proposes it runs within their own resources. A message that adds no new fact, evidence or experiment is not sent; the next message is an experiment proposal or a question to the user. What goes to the user, through the driver's tab, is what facts cannot settle: scope, priorities, permissions, acceptable risk. When the driver is in plan mode, a disagreement about the plan becomes a corrected plan that the user approves at `ExitPlanMode`.

**Two architects who disagree** are the common case of this, and the profiles are usually why: one is defending the project's existing convention, another is defending the simpler shape. Settle it the same way — by the fact and by the consequence each side can point at — and let the driver coordinate one solution rather than implementing both halves. Where the answer needs a business priority or a wider scope, the driver asks the user.

Two rules hold whatever the count. **Correctness is not decided by a majority**: three `OK`s do not answer one member's evidence, and the item stays open until the evidence does. And **a justified `FIX` is not dropped because others approved** — the others reviewed their own scope, which is exactly why they did not see it.

## Team, waiting, unavailability

- **The supported compositions** are a pair — the driver and exactly one navigator — and a team — the driver, at least one architect and at least one tester, with no upper bound on either. A navigator mixed into a team, a second navigator and a second driver are not supported; where the visible sessions suggest one of those, the driver settles the composition with the user before sending anything.
- The driver assembles the roster from `ListAgents`, matching names by the rules under *Session names* and recording each candidate's name and ref. A composition the user states wins over the one the names suggest. **Several architects or several testers is not an ambiguity** — it is the case this protocol is for, and all of them are taken. One `AskUserQuestion` is owed for a real ambiguity: a mixed or incomplete composition, candidate sessions carrying no role name, two rows that cannot be told apart, or a mismatch between what the user said and what is listed.
- A session named as a driver belongs to another task. It is not taken, not stopped, and not sent a `START`.
- The `START` handshake confirms membership: it carries the run id, the driver's name, the whole roster and the recipient's own id, and the answer names that id, the role the session is running, its working directory or repositories, and its configuration. A different role, directory or task means the session is not a member; the driver stops and tells the user. A session already serving another run declines instead of answering ready, and it is then simply not a member — never taken over, and never counted as a reviewer whose silence is pending.
- Waiting is ending the turn. Unavailability is a fact the user states or `ListAgents` shows; nobody infers it from silence. When a member whose `OK` a gate needs is unavailable, the dependent work stops, the state file records it, and the closing report lists every item that got no independent review and calls the task unfinished. Work done alone is never reported as reviewed by the team.

## Losing context

Every message header carries the member id, the role, the task and the item, so a compacted transcript still shows who stands where. After a compaction: read this file (its path is in `START`) and the state file, then check `status:` — anything but `active` means the run is over and this session is free — and continue from `members`, `reviews` and `blockers` — your own id, profiles or scope are in `members`, so they are read rather than asked about again. The snapshot refs are still there (`snap.sh list <run>`). Without `START`, `snap.sh runs` names the run and `snap.sh state <run>` the file. Missing all of that, send a `NOTE` to the driver asking for the paths.

## Permissions

Each session has its own permission settings. Do not ask another session to perform an action that was denied in yours, or that you expect your own settings would block. The other session doing it for you bypasses a decision the user made. Take blocked work to the user instead.

## Sequences

Pair, small fix:

```
navigator: picks profiles, waits (turn ended)
d:  snap.sh baseline; START -> n (run id + d's ref, roster: d, n; n's id and the paths)
n:  NOTE ready — id, role, cwd, profiles, first questions
d:  REVIEW plan@r1 (result, done-when, steps with author/proof/gate, file owners)
n:  FIX plan@r1  -> d: REVIEW plan@r2 -> n: OK plan@r2
d:  edits, tests; writes <state dir>/<run>/final-r1.md; snap.sh final-r1; REVIEW final@r1 (ref + sha, report path, increment, test output)
n:  OK final@r1 on the tree and the report (with a suggestion or two, nothing owed)
d:  status: complete; DECISION closing the run -> n (n is free for the next task)
d:  reports to the user; commits, pushes or opens the PR only if authorised
```

Team of five: one driver, two architects with different profiles, two testers with different scopes.

```
a1 (project), a2 (code-quality + pragmatist), t1 (api), t2 (e2e): each picks profiles or scope, then waits
d:  snap.sh baseline; START -> a1, a2, t1, t2 (run id + d's ref, same roster in each, each with its own id)
a1: NOTE ready — profiles=project, note from the user, first risks
a2: NOTE ready — profiles=code-quality,pragmatist
t1: NOTE ready — proposes the API contract as its scope
t2: NOTE ready — proposes the checkout flow and the integration run
d:  REVIEW plan@r1 -> a1, a2, t1, t2 (item names, authors, per-reviewer scopes, owners, db marked exclusive keeper d)
    required: a1 — placement against the existing modules; a2 — responsibilities and the size of the change;
              t1 — that the API criteria are checkable; t2 — that the flow criteria are checkable and who owns the integration run
a1: OK plan@r1 ; a2: FIX plan@r1 (step 2 introduces a second way of doing what step 1 already does)
t1: OK plan@r1 ; t2: FIX plan@r1 (criterion 4 is not checkable without a seeded order)
d:  REVIEW plan@r2 -> all four ; all four: OK plan@r2      <- the gate opens here and not one OK earlier
d:  step 1 (interface); snap.sh step1-r1; REVIEW step1@r1 -> a1, t1 (gated)
t1: OK step1@r1 ; starts tests-t1-api against the interface, NOTE partial (red by design)
a1: FIX step1@r1 — the contract duplicates one in src/orders  -> d: REVIEW step1@r2 -> a1, t1: OK step1@r2
t2: NOTE claiming the test database for the integration run -> d (keeper) ; ends the turn
d:  NOTE free ; t2 runs, then NOTE released
d:  steps 2-3; snap.sh; REVIEW step2@r1 -> a2 (async), REVIEW step3@r1 -> a1, t1 (async)
t1: REVIEW tests-t1-api@r1 -> a2, copy d ; a2: OK tests-t1-api@r1 -> t1, copy d
t2: REVIEW tests-t2-e2e@r1 -> t1, copy d ; t1: FIX (the scenario asserts the fixture, not the criterion)
    -> t2: REVIEW tests-t2-e2e@r2 -> t1, copy d ; t1: OK
a2: OK step2@r1 ; a1: OK step3@r1 ; t1: OK step3@r1
d:  writes <state dir>/<run>/final-r1.md; snap.sh final-r1; REVIEW final@r1 -> all four
a1: OK final@r1 (tree and report) ; t1: OK final@r1 (tree and report)
a2: FIX final@r1 — the report credits the integration run to t1, who did not run it
d:  corrects the report; snap.sh final-r2; REVIEW final@r2 -> all four ; all four: OK final@r2
d:  status: complete; DECISION closing the run -> all four (their tabs are free for the next task)
d:  reports to the user; the run's refs stay unless the user asks for snap.sh clean <run>
```
