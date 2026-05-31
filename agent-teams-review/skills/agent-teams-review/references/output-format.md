# Agent Teams Review — Output Format

## 1. Issue ID Prefixes

Use reviewer-specific prefixes, not generic ones like `HIGH-001` or `MED-001` — the prefix tells the reader (and the triage step) which reviewer found it, which is information a severity-based prefix throws away.

| Reviewer | Prefix |
|----------|--------|
| Virtual Mariusz (Tech Lead) | `VM-` |
| Backend Solidifier | `BE-` |
| Frontend Virtuoso | `FE-` |
| Quality Purist | `QA-` |
| Security Sentinel | `SC-` |
| Devil's Advocate | `DV-` |

Each reviewer has its own counter (001, 002...). Prefix = reviewer, NOT severity.

## 2. Verdict Decision Matrix

| Critical | High | Verdict |
|----------|------|---------|
| > 0 | any | BLOCKED |
| 0 | > 3 | CHANGES REQUESTED |
| 0 | 1-3 | APPROVED WITH COMMENTS |
| 0 | 0 | APPROVED |

## 3. Finding Markers: Severity · Confidence · Effort

Every finding carries three markers. Severity alone is not enough — triage needs to know how sure the reviewer is and how expensive the fix is, otherwise it has to re-derive both by hand.

**Severity** — judged by real impact on the running app:

| Severity | Description |
|----------|-------------|
| Critical | Security vulnerability, data loss risk, breaking bug, financial incorrectness |
| High | Significant issue that should be fixed, race condition with real impact |
| Medium | Notable issue, fix recommended |
| Low | Minor suggestion, optional fix |

**Confidence** — how sure the reviewer is the issue is real. This is the antidote to crying wolf: a hunch is `Low`, not an inflated severity.

| Confidence | Meaning |
|------------|---------|
| High | Confirmed by reading the code; the issue is real |
| Medium | Likely, but depends on context the reviewer could not fully see |
| Low | "Worth a look" — flag it without inflating severity |

**Effort** — rough fix cost, so triage's effort dimension reads the marker instead of guessing:

| Effort | Meaning |
|--------|---------|
| ~5min | Trivial: rename, remove import, add constant, add type hint |
| ~30min | Moderate: add index, wrap in transaction, extract a small method |
| ~1h+ | Significant: refactor, redesign, new subsystem |

Write each finding's header line as: `[PREFIX-NNN] Title — file:line — Severity · Confidence · Effort`.

## 4. AI Slop Score Integration

The AI Slop Score from Virtual Mariusz is always included. It affects the verdict:

| AI Slop Score | Impact |
|---------------|--------|
| 0-3 | Adds 1 Critical issue (Heavy AI Slop) |
| 4-5 | Adds 1 High issue (Moderate AI Slop) |
| 6-7 | Noted in report, no verdict impact |
| 8-10 | Positive observation |

## 5. Deduplication Rules

When multiple reviewers find overlapping issues:

1. **Same issue, different perspectives** — keep the most detailed report, note which reviewers flagged it
2. **Related but distinct issues** — keep both, cross-reference them
3. **True duplicates** — merge into single entry, list all reviewers that found it
4. **Cross-reviewer findings** — when one reviewer flags something to another (e.g., BE flags SQL to SC), tag inline with `CROSS` and "who flagged -> who investigated" attribution. Do NOT create a separate cross-reviewer section.

## 6. Report Template

```markdown
# Agent Teams Code Review

**PR:** [Branch name or PR title]
**Date:** [YYYY-MM-DD]
**Team:** [List of active reviewers]
**Scope:** Quick (Critical-only) | Standard | Full (deep)

**Verdict:** BLOCKED | CHANGES REQUESTED | APPROVED WITH COMMENTS | APPROVED
**AI Slop:** X/10 — [Heavy Slop / Moderate Slop / Light Slop / Clean]

| | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| VM | X | X | X | X | X |
| BE | X | X | X | X | X |
| FE | X | X | X | X | X |
| QA | X | X | X | X | X |
| SC | X | X | X | X | X |
| DV | X | X | X | X | X |
| **Sum** | **X** | **X** | **X** | **X** | **X** |

---

## Action Items

> Each line carries `Severity · Confidence · Effort` so the list is scannable by a human and parseable by triage.

### Critical

- [ ] `[SC-001]` **Issue title** — `file/path.php:42` — Critical · High · ~30min _(Security Sentinel)_

### High (N)

- [ ] `[BE-001]` **Issue title** — `file/path.php:67` — High · High · ~30min _(Backend Solidifier)_
- [ ] `[VM-001]` **Issue title** CROSS _(flagged by BE -> VM)_ — `file/path.php:52` — High · Medium · ~5min

### Medium (N)

- [ ] `[QA-001]` **Issue title** — `file/path.php:30` — Medium · High · ~5min _(Quality Purist)_
- [ ] `[FE-001]` **Issue title** — `components/File.vue:45` — Medium · Medium · ~30min _(Frontend Virtuoso)_

### Low (N)

- [ ] `[QA-002]` **Issue title** — `file/path.php:95` — Low · High · ~5min _(Quality Purist)_
- [ ] `[BE-002]` **Issue title** — `migrations/file.php:35` — Low · Low · ~5min _(Backend Solidifier)_

> At **Quick** scope, the Medium and Low groups are replaced by a single line: `_Medium: N · Low: N — suppressed at Quick scope; rerun at Standard to see them._`

---

## Findings

### Critical

#### `path/to/file.php`

##### [SC-001] Issue Title — Critical · High · ~30min
_Security Sentinel_

Description of the problem and why it matters.

**Current:**
```php
// problematic code
```

**Fix:**
```php
// corrected code
```

### High

#### `path/to/first-file.php`

##### [BE-001] Issue Title
_Backend Solidifier_

Description of the problem and why it matters.

**Current:**
```php
// problematic code
```

**Fix:**
```php
// corrected code
```

##### [VM-001] Issue Title — CROSS
_Flagged by Backend Solidifier -> Investigated by Virtual Mariusz_

Description of what was flagged and what investigation revealed.

### Medium

#### `path/to/first-file.php`

##### [QA-001] Issue Title
_Quality Purist_ — Variable `$data` should be `$userSettings`. Naming convention violation.

#### `path/to/second-file.vue`

##### [FE-001] Issue Title
_Frontend Virtuoso_ — Missing loading state on save button. UX issue.

### Low

#### `path/to/second-file.vue`

##### [FE-002] Issue Title
_Frontend Virtuoso_ — Avatar preview missing alt text. Accessibility.

---

## Impact Analysis

> _(Full scope only. Omit this section at Quick and Standard scope.)_

Because the review went beyond the diff, this section reports whether the functions the PR touched still hold up against their callers and callees.

| Touched symbol | Used by (callers) | Depends on (callees) | Still works end-to-end? | Notes |
|----------------|-------------------|----------------------|-------------------------|-------|
| `Service::method()` | `Controller:34`, `ApiController:55` | `helperA()`, `Model::save()` | ⚠️ At risk | Second caller untested for the new path |
| `getThing()` | `Widget:12` | `Model::find()` | ✅ Yes | Signature unchanged, callers unaffected |

**Ripple risks** (findings about code outside the diff that the change endangers):
- `[DV-002]` **API caller bypasses new validation** — `ApiController.php:55` — High · Medium · ~30min _(Devil's Advocate)_

---

## AI Slop Report

**Overall Score:** X/10

| Category | Score | Notes |
|----------|-------|-------|
| Unnecessary Abstractions | X/10 | ... |
| Boilerplate Bloat | X/10 | ... |
| Comment Slop | X/10 | ... |
| Premature Generalization | X/10 | ... |
| Copy-Paste Artifacts | X/10 | ... |

**Verdict:** [Heavy Slop / Moderate Slop / Light Slop / Clean]

Notable examples (if score <= 7):
- `file:line` — description of slop pattern
- `file:line` — description of slop pattern

---

## Won't Implement

> _(This section appears only after triage. See Section 7 for rules.)_

- `[XX-NNN]` **Issue title** — `file/path.php:42` _(Reviewer Name)_ — Triage reason

---

## What's Good

- [Positive observation from Reviewer A]
- [Positive observation from Reviewer B]
- [Positive observation from Reviewer C]
```

## Formatting Rules

### Critical/High Issues (in "Findings")
Full detail: description + code example + fix. Show the problem and the solution.

### Medium Issues
1-2 line summary inline. No code blocks unless the fix is non-obvious.

### Low Issues
1 line summary. Just the what and where.

### Cross-Reviewer Findings
Inline with the file they belong to, tagged with `CROSS` and attribution (`flagged by X -> investigated by Y`). NOT a separate section.

## 7. Won't Implement — Triage Rules

When the user triages findings as "won't implement", the report is updated in place. The Won't Implement section sits between AI Slop Report and What's Good.

### Won't Implement Format

```markdown
## Won't Implement

> Triaged on YYYY-MM-DD. These findings were evaluated and intentionally excluded.

- `[XX-NNN]` **Issue title** — `file/path.php:42` _(Reviewer Name)_ — Triage reason
```

Uses the same bullet list format as Action Items for consistency.

### Report Update Rules

Apply all of these when items are triaged:

1. **Action Items** — remove triaged items from their severity group. Update the heading count (e.g., `### High (4)` becomes `### High (3)`). If a severity group becomes empty after removal, show `(none)` under it.
2. **Findings** — remove the detailed finding block for each triaged item. If a file heading (`#### path/to/file`) has no remaining findings under it within that severity group, remove the file heading too.
3. **Severity counts table** — the `**Sum**` row counts only active (non-triaged) findings. Add a `~~WI~~` row below Sum showing triaged counts with strikethrough styling. Per-reviewer rows stay unchanged — they reflect what each reviewer actually found.
4. **Verdict** — recalculate using the decision matrix (Section 2) based on remaining active Critical/High counts. If the verdict changes, annotate it: `**Verdict:** NEW_VERDICT _(was: OLD_VERDICT, updated after triage)_`.
5. **AI Slop Score** — not recalculated. It reflects code quality assessment, not triage decisions.
6. **Won't Implement list** — append triaged items as bullet points. If the section does not exist yet, create it between AI Slop Report and What's Good.

## Example

See [example-report.md](example-report.md) for a complete example report showing post-triage state.
