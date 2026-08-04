# Catching up after drift

The normal loop assumes one change, closed the same day. This file covers the other case: the code moved for a week or three and nobody touched `docs/`. It is the moment the method usually dies, because the gap looks too big to close and gets postponed again.

It is not too big. The work is bounded by the diff, and most of the diff needs no documentation at all.

## 1. Find the boundary

```bash
git log -1 --format='%h %ad %s' --date=short -- docs/
git log --oneline --no-merges "$(git log -1 --format=%H -- docs/)"..HEAD
git diff --stat "$(git log -1 --format=%H -- docs/)"..HEAD -- . ':!docs'
```

That is the drift window. If `docs/` was touched recently but only cosmetically, walk back further — the boundary is the last commit that changed a spec section, an ADR or a checkbox, not the last commit that fixed a typo in a README.

## 2. Build an inventory before editing anything

Go through the window commit by commit and write a working list — in the conversation, not in a file. For each commit, one line: what changed, and which bucket it falls in.

| Bucket | Signal in the diff |
|---|---|
| Behaviour | A new endpoint, a changed response, a different default, a new failure path, a changed data shape |
| Decision | A dependency added or dropped, a storage or transport swapped, a pattern deliberately broken in one place |
| Plan task | The commit message carries a task id |
| Unplanned work | Real work with no task id |
| Nothing | Formatting, renames with no behaviour change, dependency bumps, test-only commits, revert pairs that cancel out |

Expect most commits to land in "Nothing". That is the normal result and it is worth saying out loud, because it is what makes the remaining list small enough to act on.

## 3. Show the list, then edit

Present the inventory and the proposed documentation changes before touching a file. Two reasons this matters more here than in the single-change loop: the user knows things the diff does not show — which of those changes were deliberate decisions and which were accidents on the way to something else — and a large batch of unreviewed documentation edits is exactly the kind of change nobody reads afterwards.

Then apply, in the usual closing order: spec, then ADRs, then the cross-repo status column, then checkboxes, then the roadmap.

## 4. Reconstructing plan state

**Tick only what you can verify.** A commit message carrying `WH-09` is evidence the task was started, not that its done-condition was met. Open the done-condition and check it against the code. If you cannot check it, leave the box unticked and say which ones you left, and why — an honest gap beats a plan that claims more than is true.

**Unplanned work becomes a retroactive task, already ticked.** Next free id, in the milestone it belongs to, with a `**Done YYYY-MM-DD.**` annotation carrying the date from `git log`. This is not bookkeeping theatre: without it the milestone counter is wrong forever, and the next person reading the plan cannot tell whether the work exists.

**Do not renumber and do not reuse numbers.** If work was done that clearly should have been three tasks, add three, with the numbers that are free now. Their being out of chronological order is expected and fine.

**Dates come from git, never from memory or from today.** `git log -1 --format=%ad --date=short <commit>`.

## 5. Drift checks

Run these regardless of what the diff showed. They catch the rot that no commit introduced.

```bash
# Ticked and unticked tasks per milestone file — compare against the roadmap counters
rg -c '^- \[x\]' docs/plan/*.md
rg -c '^- \[ \]' docs/plan/*.md

# Every spec/ADR path referenced from the plan — anything printed here is a broken link
rg -o '\]\(\.\./[a-z]+/[^)]+\)' docs/plan/ | sed 's/.*(\.\.\///;s/)//' | sort -u \
  | while read -r p; do [ -f "docs/$p" ] || echo "MISSING: $p"; done

# ADRs still marked Proposed
rg -l '\*\*Status\*\* \| Proposed' docs/adr/

# Code paths cited in the spec that no longer exist
rg -o '`[a-zA-Z0-9_./-]+\.(ts|js|php|dart|py|go|rs|vue|tsx)`' docs/spec/ \
  | sed 's/.*`\(.*\)`/\1/' | sort -u \
  | while read -r p; do [ -e "$p" ] || echo "STALE PATH: $p"; done
```

The last one produces false positives for files in sibling repositories, which are written as plain text precisely because they live elsewhere. Check before deleting a reference.

Also read the roadmap end to end. If "State today" has grown into a chain of "before that…" entries, replace it with the current three rows and move anything worth keeping onto the individual tasks as `**Done**` annotations. That cell is the one place everyone is told to start, and its only job is to be short.

## 6. What not to do

- **Do not rewrite ADR history.** An accepted ADR that turned out to be wrong gets an `## Amendment (YYYY-MM-DD)` or a superseding ADR. Editing it to match what happened destroys the record of a decision that was made in good faith with the information available.
- **Do not backfill an ADR for something nobody decided.** If the storage choice happened because it was what the template used, that is not a decision and an invented rationale is worse than no ADR. Say it is undecided and record it as an open question in `spec/00`.
- **Do not restate the diff in the spec.** The spec describes the system as it is now, not the path it took. "The retry limit was changed from 3 to 5" belongs in git; "Retries stop after 5 attempts" belongs in the spec.
- **Do not close the gap in one commit if it is large.** Spec corrections in one, plan reconstruction in another. The first is reviewable; the two together are not.
