# Agent Teams Review — Output Format

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
| > 0 | any | BLOCKED |
| 0 | > 3 | CHANGES REQUESTED |
| 0 | 1-3 | APPROVED WITH COMMENTS |
| 0 | 0 | APPROVED |

## 3. Severity Mapping

| Severity | Description |
|----------|-------------|
| Critical | Security vulnerability, data loss risk, breaking bug, financial incorrectness |
| High | Significant issue that should be fixed, race condition with real impact |
| Medium | Notable issue, fix recommended |
| Low | Minor suggestion, optional fix |

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

### Critical

- [ ] `[SC-001]` **Issue title** — `file/path.php:42` _(Security Sentinel)_

### High (N)

- [ ] `[BE-001]` **Issue title** — `file/path.php:67` _(Backend Solidifier)_
- [ ] `[VM-001]` **Issue title** CROSS _(flagged by BE -> VM)_ — `file/path.php:52`

### Medium (N)

- [ ] `[QA-001]` **Issue title** — `file/path.php:30` _(Quality Purist)_
- [ ] `[FE-001]` **Issue title** — `components/File.vue:45` _(Frontend Virtuoso)_

### Low (N)

- [ ] `[QA-002]` **Issue title** — `file/path.php:95` _(Quality Purist)_
- [ ] `[BE-002]` **Issue title** — `migrations/file.php:35` _(Backend Solidifier)_

---

## Findings

### Critical

#### `path/to/file.php`

##### [SC-001] Issue Title
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

## Example

See [example-report.md](example-report.md) for a complete example report.
