# Agent Teams Review — Output Format (Action-First)

## 1. Issue ID Prefixes

Use reviewer-specific prefixes. NEVER use generic prefixes like `HIGH-001` or `MED-001`.

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
| > 0 | any | :x: Blocked |
| 0 | > 3 | :large_orange_diamond: Changes Requested |
| 0 | 1-3 | :warning: Approved with Comments |
| 0 | 0 | :white_check_mark: Approved (with medium/low noted) |

## 3. Severity Mapping

| Severity | Merge Impact | Description |
|----------|--------------|-------------|
| Critical | :x: Blocked | Security vulnerability, data loss risk, breaking bug, financial incorrectness |
| High | :large_orange_diamond: Changes Requested | Significant issue that should be fixed, race condition with real impact |
| Medium | :warning: Approved with Comments | Notable issue, fix recommended |
| Low | :white_check_mark: Approved | Minor suggestion, optional fix |

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
4. **Cross-reviewer findings** — when one reviewer flags something to another (e.g., BE flags SQL to SC), tag inline with `↔️CROSS` and "who flagged -> who investigated" attribution. Do NOT create a separate cross-reviewer section.

## 6. Report Template

```markdown
# Agent Teams Code Review

**PR:** [Branch name or PR title]
**Date:** [YYYY-MM-DD]
**Team:** [List of active reviewers]

---

## Verdict & Score

**Verdict:** :x: Blocked | :large_orange_diamond: Changes Requested | :warning: Approved with Comments | :white_check_mark: Approved
**Risk:** :red_circle: Critical | :orange_circle: High | :yellow_circle: Medium | :green_circle: Low
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

## What You Need To Do

### :red_circle: Before Merge — Required

> Critical + High severity. These MUST be fixed.

- [ ] `[BE-001]` **Issue title** `Critical` — `file/path.php:42` _(Backend Solidifier)_
- [ ] `[SC-001]` **Issue title** `High` ↔️CROSS _(flagged by BE, investigated by SC)_ — `file/path.php:67`
- [ ] `[VM-001]` **Issue title** `High` — `file/path.php:52` _(Virtual Mariusz)_

### :orange_circle: Before Merge — Recommended

> Medium severity issues worth fixing now.

- [ ] `[QA-001]` **Issue title** `Medium` — `file/path.php:30` _(Quality Purist)_
- [ ] `[FE-001]` **Issue title** `Medium` — `components/File.vue:45` _(Frontend Virtuoso)_

### :yellow_circle: Post-Merge — Optional

> Medium + Low severity. Fix when convenient.

- [ ] `[QA-002]` **Issue title** `Medium` — `file/path.php:95` _(Quality Purist)_
- [ ] `[BE-002]` **Issue title** `Low` — `migrations/file.php:35` _(Backend Solidifier)_
- [ ] `[FE-002]` **Issue title** `Low` — `components/File.vue:12` _(Frontend Virtuoso)_

---

## Why — Findings By File

### `path/to/first-file.php`

#### [BE-001] Issue Title `Critical`
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

---

#### [SC-001] Issue Title `High` ↔️CROSS
_Flagged by Backend Solidifier → Investigated by Security Sentinel_

Description of what was flagged and what investigation revealed.

**Vulnerable:**
```php
// vulnerable code
```

**Secure:**
```php
// secure implementation
```

---

#### [QA-001] Issue Title `Medium`
_Quality Purist_ — Variable `$data` should be `$userSettings`. Naming convention violation.

---

### `path/to/second-file.vue`

#### [FE-001] Issue Title `Medium`
_Frontend Virtuoso_ — Missing loading state on save button. UX issue.

#### [FE-002] Issue Title `Low`
_Frontend Virtuoso_ — Avatar preview missing alt text. Accessibility.

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

## Reviewer Verdicts

| Reviewer | Verdict | Issues | Summary |
|----------|---------|--------|---------|
| Virtual Mariusz | :large_orange_diamond: | X | One-line summary |
| Backend Solidifier | :large_orange_diamond: | X | One-line summary |
| Frontend Virtuoso | :white_check_mark: | X | One-line summary |
| Quality Purist | :warning: | X | One-line summary |
| Security Sentinel | :large_orange_diamond: | X | One-line summary |
| Devil's Advocate | :white_check_mark: | X | One-line summary |

---

## What's Good

- :white_check_mark: [Positive observation from Reviewer A]
- :white_check_mark: [Positive observation from Reviewer B]
- :white_check_mark: [Positive observation from Reviewer C]
```

## Formatting Rules

### Critical/High Issues (in "Why — Findings By File")
Full detail: description + code example + fix. Show the problem and the solution.

### Medium Issues
1-2 line summary inline. No code blocks unless the fix is non-obvious.

### Low Issues
1 line summary. Just the what and where.

### Cross-Reviewer Findings
Inline with the file they belong to, tagged with `↔️CROSS` and attribution (`flagged by X → investigated by Y`). NOT a separate section.

## Example

See [example-report.md](example-report.md) for a complete example report.
