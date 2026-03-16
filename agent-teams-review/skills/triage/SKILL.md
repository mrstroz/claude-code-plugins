---
name: triage
description: Smart triage of Agent Teams Review findings into three action groups (Fix Now / Fix Later / Skip) with intelligent grouping and severity verification. Use when the user wants to triage, prioritize, or sort review findings after a code review. Also use when the user asks what to fix first, wants an action plan from a review, or mentions triage, prioritize findings, review priorities, or sort review results. Requires a completed review report from agent-teams-review.
argument-hint: "[path-to-review-report]"
---

# Triage — Smart Review Finding Prioritization

Analyze a completed Agent Teams Review report and divide all findings into three actionable groups. The triage produces a prioritized, grouped output that tells the developer exactly what to fix now, what to schedule for later, and what to skip entirely.

## Core Principle: Verify, Don't Trust

Reviewers assign severity based on their domain perspective. A Security Sentinel may flag a missing rate limit as Critical on an internal admin endpoint behind VPN — that's not actually Critical. A Quality Purist may mark a naming issue as Medium when it's a 30-second rename you should just do now.

Triage is the final decision-maker. Evaluate every finding by its **real-world impact on the running application**, not by its severity label.

## Workflow

### Step 1: Load the Review Report

If `$ARGUMENTS` contains a file path, read that report directly.

If no argument is provided, find the most recent review report:

```bash
ls -t docs/reviews/*.md | head -1
```

If no reports exist, inform the user and exit.

Read the full report. Extract all findings from the **Action Items** and **Findings** sections. Also read the **Won't Implement** section if it exists — those items are already triaged and should be excluded from analysis.

### Step 2: Collect Context

To make informed triage decisions, gather additional context:

1. **PR intent** — read the git log to understand what the PR was trying to accomplish:
   ```bash
   git log --oneline main...HEAD | head -20
   ```
2. **Changed files** — know which files were actually modified in this PR:
   ```bash
   git diff main...HEAD --name-only
   ```

This context matters because findings in changed code deserve more attention than findings in adjacent code the PR didn't touch.

### Step 3: Assess Each Finding

For every active finding (not in Won't Implement), evaluate it across seven dimensions. Read [references/assessment-guide.md](references/assessment-guide.md) for detailed criteria and examples.

The seven dimensions:

| # | Dimension | Question to answer |
|---|-----------|-------------------|
| 1 | **Real impact** | What actually breaks if we ignore this? Not the label — the consequence. |
| 2 | **Blast radius** | How many users/flows does this affect? Hot path or edge case? |
| 3 | **Effort** | Is this a 2-minute fix or a 2-hour refactor? |
| 4 | **Location** | Is this in code the PR changed, or in adjacent/pre-existing code? |
| 5 | **Regression risk** | Could fixing this break something else? |
| 6 | **Dependencies** | Does this finding block or unlock other findings? |
| 7 | **Nature** | Security/data-integrity vs performance vs code-quality vs stylistic? |

No single dimension is an automatic classifier. A Critical-labeled finding can land in Skip if the real impact is negligible. A Low-labeled finding can land in Fix Now if it's a 30-second fix in a file you're already touching.

### Step 4: Classify Into Three Groups

Based on the seven-dimension assessment, place each finding into one of three groups:

**Fix Now** — fix in this PR, before merge:
- Findings where ignoring them risks real harm (security holes, data corruption, user-facing bugs)
- Quick wins: anything that takes under 5 minutes, regardless of original severity — the cost of deferring exceeds the cost of fixing
- Findings in files you're already changing where the fix is straightforward
- Findings that block other Fix Now items

**Fix Later** — schedule for next sprint:
- Findings that need significant refactoring with high regression risk if rushed
- Performance issues that aren't user-visible at current scale
- Code quality improvements that need design thought before implementing
- Findings in code the PR didn't touch (adjacent/pre-existing issues)
- Findings correctly identified but too risky to squeeze into current PR scope

**Skip** — intentionally exclude:
- Findings where the reviewer's assessment doesn't match reality (overblown severity)
- Purely stylistic preferences with no functional impact
- Theoretical edge cases with negligible real-world probability
- Pre-existing issues not worsened by the PR that aren't worth the churn
- Findings where the "fix" would introduce more complexity than the problem itself

### Step 5: Apply Smart Grouping

After classification, group related findings within each category into logical work packages. This is where triage adds real value — instead of a flat list of 15 items, the developer gets 5-6 coherent tasks.

Apply these five grouping strategies (detailed rules in [references/assessment-guide.md](references/assessment-guide.md)):

1. **Proximity** — findings in the same file within ~30 lines become one task. If one is Fix Now and another would be Fix Later, pull the second into Fix Now with a note ("fix together, same location").

2. **Domain** — findings addressing the same concern across multiple files (e.g., three input validation issues in different controllers) become one task ("Input Validation Pass").

3. **Pattern** — identical fix type repeated in multiple places (e.g., "add strict_types" in 4 files) become one task with a checklist.

4. **Dependency** — when fixing A makes B trivial or B depends on A, chain them together with a suggested order.

5. **Effort bundling** — multiple quick fixes in one file become a single "cleanup" task rather than separate items.

After grouping, number the groups sequentially across all three categories for easy reference.

### Step 6: Output the Triage

Present the triage result to the user using the format below. Do not save to a file — display directly.

```markdown
## Triage

> Based on: `{report-path}`
> PR: {branch-name} | {total-findings} findings analyzed | {won't-implement-count} previously triaged

### Fix Now ({group-count} groups, {finding-count} findings, ~{effort-estimate})

**1. {Group Name}** _({N} findings{, grouping-reason})_
- `[XX-NNN]` **Title** — `file:line` — {original-severity} in review{, reclassification-note}
- `[XX-NNN]` **Title** — `file:line` — {original-severity} in review
> {Why fix now. If grouped: why together. If reclassified: why the original severity was wrong.}

**2. {Group Name}** _({N} findings)_
- `[XX-NNN]` **Title** — `file:line` — {original-severity} in review
> {Why fix now.}

### Fix Later ({group-count} groups, {finding-count} findings)

**3. {Group Name}** _({N} findings{, grouping-reason})_
- `[XX-NNN]` **Title** — `file:line` — {original-severity} in review
- `[XX-NNN]` **Title** — `file:line` — {original-severity} in review
> {Why defer. What to consider when implementing later.}

### Skip ({finding-count} findings)

- `[XX-NNN]` **Title** — `file:line` _(Reviewer)_ — {reason for skipping}
- `[XX-NNN]` **Title** — `file:line` _(Reviewer)_ — {reason for skipping}
```

#### Output rules

- Every finding from the original report must appear in exactly one group — nothing gets lost.
- Each group in Fix Now and Fix Later has a descriptive name and a `>` blockquote explaining the reasoning.
- Fix Now groups are numbered in suggested execution order (dependencies first, then proximity clusters, then standalone items).
- Effort estimates are rough and honest: "~5 min", "~30 min", "~1-2h". Only for Fix Now groups.
- When a finding's triage classification contradicts its original severity, add a reclassification note: "Critical in review, **downgraded** — internal endpoint, admin-only" or "Low in review, **upgraded** — quick fix, same file as SC-001".
- Skip items use flat bullets (no numbered groups) since they need less structure.
- If reviewers had conflicting recommendations (e.g., VM says "extract to class" while DV says "too abstract"), flag the conflict and propose a resolution in the blockquote.

### Step 7: Answer Follow-up Questions

After presenting the triage, the user may ask follow-up questions or disagree with classifications. Adjust the triage based on their feedback and re-display the affected sections. Typical follow-ups:
- "Move BE-002 to Fix Now"
- "Why did you skip SC-001?"
- "Combine groups 2 and 3"
- "What would break if we skip group 1?"
