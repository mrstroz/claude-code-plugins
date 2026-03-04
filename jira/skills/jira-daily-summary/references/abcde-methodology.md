# ABCDE Priority Classification

Based on Brian Tracy's "Eat That Frog!" methodology, adapted for JIRA task triage. Assign each task a single letter A-E so the user knows what to tackle first and in what order.

---

## Letter Definitions

### A — Must Do

Serious negative consequences if not done today. These tasks have a multiplier effect — delaying them blocks other people or risks production stability.

Signals:
- Blocker or Critical priority
- Team members are actively blocked and waiting on my response
- Imminent release deadline (fixVersion releasing this week)
- Production incident or hotfix
- Customer escalation mentioned in comments
- Explicit "urgent" or "ASAP" language in recent comments

### B — Should Do

Mild consequences if delayed by a day or two. Important work that others are aware of, but no one is fully stuck without it right now.

Signals:
- Major priority
- Someone asked a question in comments but is not fully blocked yet
- Upcoming release (fixVersion releasing this sprint)
- Code review or QA approval that others are waiting on
- Task was recently moved to a "waiting for me" status

### C — Nice to Do

No real consequences if delayed. Routine work that will get done eventually but has no time pressure.

Signals:
- Normal priority, no dependencies on other people
- Routine progress updates
- Tasks for a future release (not the current sprint)
- No one is waiting on this task
- General improvements or enhancements with flexible timelines

### D — Delegate

Can be assigned to someone else. The task is in my queue, but my personal involvement is not essential.

Signals:
- Task is assigned to me but another team member has more context or expertise
- Task is outside my primary domain
- Someone else on the team could handle it equally well or better
- I am a bottleneck holding this task unnecessarily

### E — Eliminate

Can be dropped or deferred indefinitely. Keeping this task open adds noise without value.

Signals:
- Task is no longer relevant (requirements changed, duplicate, already fixed elsewhere)
- Very low priority with no stakeholder interest
- Already released/closed but ticket is still open
- Task has had zero activity for 30+ days with no upcoming deadline

---

## Classification Decision Factors

Ordered by importance — when factors conflict, the higher-ranked factor wins.

1. **Team obligations from comments directed at me** — if someone is waiting for my input, that is the strongest signal. A person blocked on my response makes the task at least B, often A. Read recent comments carefully for phrases like "waiting for", "need input from", "blocked by", "can you review", or direct @-mentions — but only count these when **I am the named or tagged target** of the request. Comments directing action at another person (e.g., "@jan can you review") do not create an obligation for me.

2. **Release proximity** — tasks in the nearest unreleased fixVersion outrank tasks in future versions. A task in the current sprint's target release is more urgent than one scheduled for next quarter. No fixVersion means lower urgency unless other signals override.

3. **Priority field** — the JIRA priority set by the team reflects collective judgment:
   - Blocker → A
   - Critical → A
   - Major → B
   - Normal → C
   - Minor → C or below

4. **Issue type** — Hotfix implies production urgency (A). Bug implies a defect that should be fixed soon (B-C depending on severity). Story and Task are neutral — classification depends on other factors.

5. **Assignee/reporter relationship** — if I am both the assignee and the reporter, I set my own deadline (lower urgency). If someone else reported it and assigned it to me, there is an implicit expectation to deliver (higher urgency).

---

## Override Rules

These overrides take precedence over the factor-based classification:

- A task with **Blocker priority** is always **A** regardless of other factors
- A **Hotfix** issue type is always **A** regardless of priority field
- A task where someone is **explicitly blocked waiting for my response** (in comments addressed to me, not another team member) is at least **B**, even if priority is Minor
- If a task qualifies for both an upgrade and a downgrade, keep the **higher letter** (err on the side of urgency)

---

## Sorting Within Groups

When multiple tasks share the same letter within a triage group:

1. Sort by priority field descending (Blocker first, Minor last)
2. Break ties by release proximity (nearest fixVersion first)
3. Break remaining ties by last-updated descending (most recently active first)
