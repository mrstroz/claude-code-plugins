---
name: pr-review-output
description: Defines the standard output format for aggregated PR review reports. Use this skill to format the combined output from all review agents into a unified, actionable report.
---

# PR Review Output Format

This skill standardizes the format of PR review reports that aggregate findings from multiple specialized agents.

## Report Structure

The final PR review report MUST follow this structure:

```markdown
# PR Review Report

**PR/Changes:** [Branch name or PR title]
**Reviewed:** [Date]
**Agents Used:** [List of agents that ran]

---

## Executive Summary

**Overall Verdict:** ✅ Approved | ⚠️ Approved with Comments | 🔶 Changes Requested | ❌ Blocked

**Risk Level:** 🟢 Low | 🟡 Medium | 🟠 High | 🔴 Critical

| Category | Issues | Critical | High | Medium | Low |
|----------|--------|----------|------|--------|-----|
| Architecture | X | X | X | X | X |
| Code Quality | X | X | X | X | X |
| Bugs | X | X | X | X | X |
| Requirements | X | X | X | X | X |
| Security | X | X | X | X | X |
| Tests | X | X | X | X | X |
| Performance | X | X | X | X | X |
| **Total** | **X** | **X** | **X** | **X** | **X** |

### Key Findings
1. [Most critical finding - one sentence]
2. [Second most critical]
3. [Third most critical]

---

## Critical & High Priority Issues

[Only issues with Critical or High severity, grouped and deduplicated]

### 🔴 Critical Issues (Must Fix)

#### [CATEGORY-XXX] Issue Title
**Agent:** [Which agent found this]
**Location:** `file/path.ts:line_number`

[Issue description]

**Fix:**
```[language]
// solution code
```

---

### 🟠 High Priority Issues (Should Fix)

[Same format as Critical]

---

## Medium & Low Priority Issues

[Collapsed or summarized for readability]

### 🟡 Medium Priority (X issues)

| ID | Issue | Location | Agent |
|----|-------|----------|-------|
| CLEAN-001 | Variable naming | `src/file.ts:42` | Code Cleaner |
| ... | ... | ... | ... |

### 🟢 Low Priority (X issues)

[Same table format]

---

## Positive Observations

What the code does well:

- ✅ [Positive aspect from Architect]
- ✅ [Positive aspect from Code Cleaner]
- ✅ [Positive aspect from Tests]

---

## Recommended Actions

### Before Merge (Required)
- [ ] [Action for critical issue 1]
- [ ] [Action for critical issue 2]

### Before Merge (Recommended)
- [ ] [Action for high priority issue 1]
- [ ] [Action for high priority issue 2]

### Post-Merge (Consider)
- [ ] [Action for medium issue]
- [ ] [Action for low issue]


## Issue ID Prefixes

**CRITICAL:** Use agent-specific prefixes, NEVER generic `HIGH-001`, `MED-001`.

| Agent | Prefix |
|-------|--------|
| Architect Visioner | `ARCH-` |
| Code Cleaner | `CLEAN-` |
| Bug Smasher | `BUG-` |
| Acceptance Checker | `REQ-` |
| Security Guard | `SEC-` |
| Test Guardian | `TEST-` |
| Performance Scout | `PERF-` |

Each agent has its own counter (001, 002...). Prefix = agent, NOT severity.

---

## Deduplication Rules

When multiple agents find overlapping issues:

1. **Same issue, different perspectives** - Keep the most detailed report, note which agents flagged it
2. **Related but distinct issues** - Keep both, cross-reference them
3. **True duplicates** - Merge into single entry, list all agents that found it

## Severity Mapping

| Severity | Merge Impact | Description |
|----------|--------------|-------------|
| Critical | ❌ Blocked | Security vulnerability, data loss risk, breaking bug |
| High | 🔶 Changes Requested | Significant issue that should be fixed |
| Medium | ⚠️ Approved with Comments | Notable issue, fix recommended |
| Low | ✅ Approved | Minor suggestion, optional fix |

## Verdict Decision Matrix

| Critical | High | Verdict |
|----------|------|---------|
| > 0 | any | ❌ Blocked |
| 0 | > 3 | 🔶 Changes Requested |
| 0 | 1-3 | ⚠️ Approved with Comments |
| 0 | 0 | ✅ Approved (with medium/low noted) |

## File Output

Save the report to: `docs/pr-reviews/{branch-name}-{date}.md`

Example: `docs/pr-reviews/feature-auth-2024-01-15.md`
