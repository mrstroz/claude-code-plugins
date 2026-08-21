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

**Work that was quietly dropped becomes `- [-]`, not a deleted line.** The drift window often contains a decision nobody wrote down: a task overtaken by a different approach, or one whose reason disappeared. Mark it rejected with the date from `git log` and the reason the user gives you. And a rejected task that comes back is the *old* entry reopened with a note, never a new number — a second id for the same work makes every earlier reference ambiguous.

**Dates come from git, never from memory or from today.** `git log -1 --format=%ad --date=short <commit>`.

## 5. Drift checks

Run these regardless of what the diff showed. They catch the rot that no commit introduced.

```bash
# Task state per milestone file — compare against the roadmap counters
rg -c '^- \[x\]' docs/plan/*.md
rg -c '^- \[ \]' docs/plan/*.md
rg -c '^- \[-\]' docs/plan/*.md

# Tasks with no priority token: the id follows the checkbox directly
rg -n '^- \[[ x-]\] \*\*' docs/plan/*.md

# Every spec/ADR file referenced from the plan — anything printed here is a broken link.
# The anchor is stripped first: the link format is `[04 §3](../spec/04-auth.md#3-session)`,
# so testing the whole string reports every compliant link as missing.
rg -o '\]\(\.\./[a-z]+/[^)]+\)' docs/plan/ | sed 's/.*(\.\.\///; s/[)#].*//' | sort -u \
  | while read -r p; do [ -f "docs/$p" ] || echo "MISSING: $p"; done

# ADRs still marked Proposed. PROPOSED is the status word from the vocabulary table —
# `Propozycja` in a Polish tree, where hardcoded English silently matches nothing.
PROPOSED='Proposed'
rg -l "\*\*Status\*\* \| *$PROPOSED" docs/adr/

# Code paths cited in the spec that no longer exist. Two filters, both needed:
# a cited path counts as live when any tracked file ends with it, because the spec
# cites `i18n.ts` and `blocks/sets.ts` as often as full paths; and a path whose
# first segment is not a top-level directory of this repo is somebody else's file,
# not a stale one.
FILES=$(rg --files)
ROOTS=$(printf '%s\n' "$FILES" | cut -d/ -f1 | sort -u)
rg -o '`[a-zA-Z0-9_./-]+\.(ts|tsx|js|mjs|astro|vue|svelte|php|dart|py|go|rs|kt|swift|css|json)`' docs/spec/ \
  | sed 's/.*`\(.*\)`/\1/' | sort -u \
  | while read -r p; do
      printf '%s\n' "$FILES" | grep -qE "(^|/)${p}$" && continue
      case "$p" in */*) printf '%s\n' "$ROOTS" | grep -qx "${p%%/*}" || continue ;; esac
      echo "STALE PATH: $p"
    done
```

The roadmap counter is ticked over ticked-plus-unticked; rejected tasks are counted separately after it (`4/6, 1 rejected`), so a counter that matches the total number of task lines is wrong wherever a `[-]` exists. Missing priority tokens are only worth fixing if the rest of the plan has them — a plan written before the marker existed reads as all-normal and is not broken.

**Read the last check's output before acting on it.** What survives both filters is a short list, not a clean one. A bare filename with no directory cannot be judged by repository root, so a sibling repository's `nuxt.config.js` still shows up next to a component of yours that was genuinely renamed. Open each one. What the check is for is the second kind: a path that used to resolve and now does not, which is the spec quietly describing a file nobody can open.

The filters exist because the unfiltered version flags almost everything and gets ignored. On a project whose spec mostly documents *other* repositories, expect most of the remaining lines to be foreign anyway, and weigh the check accordingly — it earns its place on a single-repo tree and mostly produces reading on a cross-repo one.

Also read the roadmap end to end. If "State today" has grown into a chain of "before that…" entries, replace it with the current three rows and move anything worth keeping onto the individual tasks as `**Done**` annotations. That cell is the one place everyone is told to start, and its only job is to be short.

## 6. What not to do

- **Bring an ADR up to date rather than annotating it.** An ADR whose details turned out differently is edited to state the decision in force, not given a section recording the correction. Where the superseded decision still explains why the architecture looks the way it does, one line under `## Decision History` keeps it; a decision replaced outright gets a superseding ADR instead.
- **Do not backfill an ADR for something nobody decided.** If the storage choice happened because it was what the template used, that is not a decision and an invented rationale is worse than no ADR. Say it is undecided and record it as an open question in `spec/00`.
- **Do not restate the diff in the spec.** The spec describes the system as it is now, not the path it took. "The retry limit was changed from 3 to 5" belongs in git; "Retries stop after 5 attempts" belongs in the spec.
- **Do not close the gap in one commit if it is large.** Spec corrections in one, plan reconstruction in another. The first is reviewable; the two together are not.
