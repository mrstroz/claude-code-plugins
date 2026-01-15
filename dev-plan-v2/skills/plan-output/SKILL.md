---
name: plan-output
description: Defines the layered output format for development plans (TL;DR, Approach, Tasks with dependencies). Ensures plans are readable at multiple levels - from executive summary to detailed implementation steps.
---

# Plan Output Skill

**Name**: `dev-plan-v2:plan-output`

**Description**: Defines the standard output format for development plans. Ensures plans are layered (TL;DR → Details), include dependency mapping, and remain readable.

## When to Use

Use this skill to format development plans created by the `plan-writer` agent before saving or presenting to user.

## Target Audience

Developers implementing the plan - from junior (who needs details) to senior (who just wants overview).

## Core Principle: Layered Readability

Plans must work at multiple levels:
1. **TL;DR**: Manager/stakeholder can understand in 30 seconds
2. **Approach**: Senior dev can review architecture in 2 minutes
3. **Tasks**: Implementing dev can follow step-by-step
4. **Appendix**: Deep technical details only when needed

## File Naming Convention

Format: `{TASK-ID}-{brief-description}.md` or `{brief-description}.md`

Examples:
- `PROJ-123-add-user-authentication.md`
- `implement-payment-processing.md`
- `GH-456-fix-login-race-condition.md`

## Required Structure

```markdown
# Development Plan: [Task ID] - [Brief Title]

> **Task**: [Link or reference if available]
> **Approach**: [Name of selected approach]
> **Complexity**: S | M | L | XL
> **Created**: [YYYY-MM-DD]

---

## TL;DR

- **What**: [One sentence - what we're building]
- **Why**: [One sentence - why this approach was chosen]
- **How**: [One sentence - key technical decision]
- **Risk**: [One sentence - main risk and mitigation]
- **Scope**: [One sentence - what's explicitly in/out]

---

## Approach

[Maximum 1 page - technical overview]

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| [Area] | [What we chose] | [Why] |

### Architecture Overview

[Brief description or simple diagram if helpful]

### Dependencies

- **Uses**: [Existing systems this builds on]
- **Affects**: [Systems that may be impacted]
- **External**: [New dependencies introduced]

---

## Tasks

### Phase 1: [Phase Name] (Must-Have)

Core functionality that must be completed.

- [ ] **1.1 Task Title**
  - Depends on: none
  - Blocks: 1.2, 2.1
  - Files: `src/path/to/file.ext`
  - Description: [What to do]

- [ ] **1.2 Task Title**
  - Depends on: 1.1
  - Blocks: 1.3
  - Files: `src/path/to/file.ext`, `src/path/to/other.ext`
  - Description: [What to do]

- [ ] **1.V Verify Phase 1** ✓
  - Run: `npm test src/feature/`
  - Check: [Specific verification criteria]

### Phase 2: [Phase Name] (Should-Have)

Important but not blocking. Can be parallelized where noted.

- [ ] **2.1 Task Title** ⚡
  - Depends on: 1.1
  - Parallel with: 2.2
  - Files: `src/path/to/file.ext`
  - Description: [What to do]

- [ ] **2.2 Task Title** ⚡
  - Depends on: 1.2
  - Parallel with: 2.1
  - Files: `src/path/to/file.ext`
  - Description: [What to do]

- [ ] **2.V Verify Phase 2** ✓
  - Run: `npm test`
  - Check: [Specific verification criteria]

### Phase 3: [Phase Name] (Nice-to-Have)

Optional improvements. Implement if time permits.

- [ ] **3.1 Task Title**
  - Priority: Low
  - Files: `src/path/to/file.ext`
  - Description: [What to do]

---

## Appendix

> **Note**: Only include this section if code examples are essential.
> Prefer verbal descriptions over code snippets.

### [Topic requiring code example]

```[language]
// Only when verbal description is insufficient
```
```

## Formatting Rules

### TL;DR Section
- Exactly 5 bullet points
- Each bullet is ONE sentence
- No technical jargon - stakeholder readable
- Total should fit in a small terminal window

### Approach Section
- Maximum 1 printed page
- Use tables for structured decisions
- Diagrams only if they add clarity (not decoration)
- Focus on "why" not "how"

### Tasks Section
- Every task has dependency mapping
- Use ⚡ emoji to mark parallelizable tasks
- Verification tasks marked with ✓
- Phase names should be descriptive (not "Phase 1")
- Categorize: Must-Have → Should-Have → Nice-to-Have

### Appendix Section
- OPTIONAL - omit if not needed
- Code snippets only when:
  - Verbal description would be ambiguous
  - Exact syntax matters (config files, etc.)
  - Pattern is non-obvious
- Never include boilerplate or obvious code

## Complexity Scale

| Size | Meaning | Typical Scope |
|------|---------|---------------|
| **S** | Small | 1-3 tasks, single file changes |
| **M** | Medium | 4-8 tasks, few files, one module |
| **L** | Large | 9-15 tasks, multiple modules |
| **XL** | Extra Large | 15+ tasks, architectural changes |

## Task Dependency Notation

```markdown
- Depends on: [task IDs that must complete first]
- Blocks: [task IDs that wait for this]
- Parallel with: [task IDs that can run simultaneously]
```

Special values:
- `none` - No dependencies
- `external` - Depends on external factor (document what)

## Verification Tasks

Every phase should end with a verification task:

```markdown
- [ ] **X.V Verify Phase X** ✓
  - Run: `[specific command]`
  - Check: [what success looks like]
```

## Quality Checklist

Before finalizing, ensure:

- [ ] TL;DR is exactly 5 bullet points, one sentence each
- [ ] Approach section fits on one screen
- [ ] Every task has `Depends on` field
- [ ] Tasks marked as parallelizable have ⚡
- [ ] Each phase ends with verification step
- [ ] File paths are specific (not placeholders like `src/...`)
- [ ] Appendix is omitted OR contains only essential code
- [ ] Complexity rating matches actual task count
- [ ] Phase names are descriptive
