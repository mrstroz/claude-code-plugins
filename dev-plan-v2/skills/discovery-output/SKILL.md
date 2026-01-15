---
name: discovery-output
description: Defines the format for presenting codebase exploration findings - existing patterns, dependencies, risks, and approach assessment (single vs multiple options).
---

# Discovery Output Skill

**Name**: `dev-plan-v2:discovery-output`

**Description**: Defines the standard format for presenting codebase exploration findings. Designed to summarize existing patterns, dependencies, and risks while assessing if one or multiple approaches are viable.

## When to Use

Use this skill to format the output of the `discovery-agent` before presenting findings to the user or passing to subsequent agents.

## Target Audience

- **Primary**: Other agents in the planning workflow (clarifier, approach-designer, plan-writer)
- **Secondary**: User who wants to understand existing codebase patterns

## Core Principle: Actionable Intelligence

Discovery output should:
1. **Inform decisions** - What exists that affects our approach?
2. **Map dependencies** - What connects to what?
3. **Flag risks** - What could cause problems?
4. **Assess options** - Is there one obvious path or many?

## Required Structure

```markdown
# Discovery Report: [Topic/Task]

> **Explored**: [Brief description of what was searched]
> **Scope**: [Areas of codebase examined]

---

## Existing Patterns

### [Pattern Category 1]

| File | Purpose | Relevance |
|------|---------|-----------|
| `path/to/file.ext` | [What it does] | [How it relates to task] |
| `path/to/another.ext` | [What it does] | [How it relates to task] |

**Pattern Summary**: [1-2 sentences describing the pattern]

### [Pattern Category 2]

[Same structure]

---

## Dependencies

### Direct Dependencies
What the new implementation will use:

- `path/to/service.ext` - [What it provides]
- `path/to/util.ext` - [What it provides]

### Reverse Dependencies
What might be affected by changes:

- `path/to/consumer.ext` - [How it's affected]
- `path/to/other.ext` - [How it's affected]

### External Dependencies
New libraries or services needed:

- [Library/Service] - [Why needed]
- *None identified* (if none)

---

## Risks Identified

| Risk | Type | Severity | Mitigation |
|------|------|----------|------------|
| [Risk description] | Technical/Scope/Dependency | High/Medium/Low | [How to address] |
| [Risk description] | Technical/Scope/Dependency | High/Medium/Low | [How to address] |

---

## Approach Assessment

**Single Clear Approach**: Yes | No

### If Yes:

**Suggested Approach**: [Name/Description]

**Based on**:
- [Evidence 1 - specific file/pattern found]
- [Evidence 2 - specific file/pattern found]

**Rationale**: [Why this is the obvious choice]

### If No:

**Why Multiple Options**:
[Explain what makes this decision non-obvious]

**Potential Directions**:
1. [Direction A] - [Brief description]
2. [Direction B] - [Brief description]
3. [Direction C] - [Brief description]

---

## Clarification Needs

Questions that should be answered before planning:

- [ ] [Question 1 - what's unclear]
- [ ] [Question 2 - what's unclear]
- *None identified* (if requirements are clear)
```

## Formatting Rules

### Existing Patterns Section
- Use tables for multiple related files
- Group by pattern category (e.g., "Authentication", "Form Handling", "API Routes")
- Always include file paths (specific, not generic)
- "Relevance" column explains why this matters for the task

### Dependencies Section
- Three categories: Direct, Reverse, External
- Use bullet lists with file paths
- Brief explanation of each dependency
- If none, explicitly state "*None identified*"

### Risks Section
- Use table format for scanability
- Types: Technical, Scope, Dependency
- Severity: High (blocker), Medium (concern), Low (minor)
- Always include mitigation suggestion

### Approach Assessment Section
- **CRITICAL**: Must clearly state Yes or No for "Single Clear Approach"
- If Yes: Provide specific evidence (file paths, patterns)
- If No: List 2-3 potential directions briefly

### Clarification Needs Section
- Checkbox format for easy tracking
- Only include genuine unknowns
- If requirements are clear, state explicitly

## Risk Types

| Type | Description | Example |
|------|-------------|---------|
| **Technical** | Implementation complexity, unknown territory | "Using unfamiliar API" |
| **Scope** | Task might be bigger than expected | "May require DB migration" |
| **Dependency** | External factors, other teams | "Blocked by auth team" |

## Risk Severity

| Severity | Meaning | Action |
|----------|---------|--------|
| **High** | Could block or derail implementation | Must address in plan |
| **Medium** | Significant concern, manageable | Should address in plan |
| **Low** | Minor issue, can handle during impl | Note for awareness |

## Assessment Decision Tree

```
Did you find existing patterns that clearly apply?
├── Yes: Is there only ONE sensible way to follow them?
│   ├── Yes → Single Clear Approach = Yes
│   └── No → Single Clear Approach = No (explain options)
└── No: Is this a greenfield implementation?
    ├── Yes → Single Clear Approach = No (need to design)
    └── No → Keep looking or explain why patterns don't apply
```

## Quality Checklist

Before finalizing discovery output:

- [ ] All file paths are specific (not placeholders)
- [ ] Patterns section has at least one category
- [ ] Dependencies are categorized (Direct/Reverse/External)
- [ ] Risks table includes mitigation for each risk
- [ ] Approach Assessment has clear Yes/No answer
- [ ] If Yes: Evidence is specific (file paths)
- [ ] If No: At least 2 potential directions listed
- [ ] Clarification Needs are genuine questions (not rhetorical)

## After Discovery

Based on the approach assessment:

**If Single Clear Approach = Yes**:
- Present to user with `AskUserQuestion`:
  ```
  Header: "Approach"
  Question: "Discovery found a clear approach: [describe]. How to proceed?"
  Options:
    1. "Accept and continue to planning" (Recommended)
    2. "Show me alternatives anyway"
  ```

**If Single Clear Approach = No**:
- Pass to `approach-designer` agent to generate detailed options
