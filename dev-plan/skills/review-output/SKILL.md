---
name: review-output
description: Defines the standard output format and template for architectural review reports. Use this skill to ensure consistent, comprehensive review report formatting for development plans and implementation proposals.
---

# Architectural Review Report Format Specification

## Target Audience

Assume the primary reader is a junior developer. Findings and recommendations should be explicit, unambiguous, and avoid jargon.

## Report Structure

All architectural review reports MUST follow this structure:

```markdown
# Architectural Review Report

> **Development Plan**: [Link to or name of the plan being reviewed]
> **Review Date**: [YYYY-MM-DD]
> **Reviewer**: Development Plan Reviewer Agent

---

## Executive Summary

**Overall Assessment**: [Approved | Approved with Recommendations | Requires Revision | Rejected]

**Critical Issues**: [Number] Critical | [Number] High | [Number] Medium | [Number] Low

---

## Architectural Analysis

### Issue #1: [Issue Title]

- **Category**: [Design Flaw | Inconsistency | Security | Performance | Maintainability | Scalability | Testing]
- **Severity**: [Critical | High | Medium | Low]
- **Location**: [Reference to specific section/component in the plan]

**Description**:
[Concise explanation - 1-2 sentences max]

**Impact**:
[Brief statement of potential consequences - 1 sentence]

**Recommendation**:
[Concrete, actionable solution - 1-2 sentences with file references if applicable]

**Code Example** (optional, only for complex cases):
[Brief code snippet showing recommended approach only]

---

[Repeat for each issue]

---

## Consistency Violations

[If none: "No consistency violations identified."]

[List as single-line bullets with file references. Example: "- File structure: Use `src/auth/` not `src/services/auth/` (see AdminAuthService.php)"]

---

## Positive Aspects

[Always include 2-4 positive aspects]

- [Well-thought-out aspect or decision]
- [Good use of existing patterns]

---

## Recommendations Summary

### Critical Changes Required

[Must-fix issues that block implementation, or "None identified."]

### High Priority Improvements

[Important improvements to address before implementation]

### Optional Enhancements

[Nice-to-have improvements]
```

## Severity Definitions

| Severity | When to Use | Action Required |
|----------|-------------|-----------------|
| **Critical** | System failures, security breaches, major architectural problems | Must fix before implementation |
| **High** | Maintainability problems, scalability concerns, significant technical debt | Should fix before implementation |
| **Medium** | Code quality improvements, consistency issues | Address but won't block implementation |
| **Low** | Minor improvements, optimization opportunities | Nice to have |

## Formatting Guidelines

- Be constructive, professional, and concise
- Descriptions: 1-2 sentences max; Impacts: 1 sentence
- Include code examples only when verbal explanation is insufficient
- Show recommended approach only (not problematic code)
- Reference file paths: `path/to/file.ext:line_number`
- Balance criticism with recognition of strengths

## Example

See [references/example.md](references/example.md) for a complete review report example.

## Quality Checklist

- [ ] Clear overall assessment with accurate issue counts
- [ ] Each issue is concise (1-2 sentence descriptions)
- [ ] Code examples only when necessary
- [ ] Consistency violations as single-line bullets
- [ ] At least 2-3 positive aspects highlighted
- [ ] Recommendations prioritized by severity
- [ ] Professional, constructive tone throughout
