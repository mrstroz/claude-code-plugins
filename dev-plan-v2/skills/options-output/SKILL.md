---
name: options-output
description: Defines the format for presenting implementation alternatives with trade-offs comparison table, pros/cons analysis, and clear recommendation.
---

# Options Output Skill

**Name**: `dev-plan-v2:options-output`

**Description**: Defines the standard format for presenting implementation alternatives with trade-offs. Designed for quick comparison and decision-making.

## When to Use

Use this skill to format the output of the `approach-designer` agent when presenting multiple implementation options to the user.

## Target Audience

Decision makers (developers, tech leads, stakeholders) who need to quickly compare approaches and make informed choices.

## Core Principle: Decision-Ready Format

Options should be:
1. **Scannable** - Overview table for quick comparison
2. **Balanced** - Fair pros/cons for each option
3. **Actionable** - Clear recommendation with rationale
4. **Decisive** - Ends with selection prompt

## Required Structure

```markdown
# Options: [Task/Decision Title]

## Context

[2-3 sentences max: What we're deciding and key constraints]

---

## Options Overview

| Approach | Complexity | Risk | [Key Factor 1] | [Key Factor 2] | Best For |
|----------|------------|------|----------------|----------------|----------|
| A: [Name] | S/M/L/XL | Low/Med/High | ⭐-⭐⭐⭐ | ⭐-⭐⭐⭐ | [Use case] |
| B: [Name] | S/M/L/XL | Low/Med/High | ⭐-⭐⭐⭐ | ⭐-⭐⭐⭐ | [Use case] |
| C: [Name] | S/M/L/XL | Low/Med/High | ⭐-⭐⭐⭐ | ⭐-⭐⭐⭐ | [Use case] |

---

## Option A: [Descriptive Name]

**Summary**: [One sentence - what this approach does]

**How it works**:
[2-3 sentences - high-level implementation approach]

**Pros**:
- [Pro 1 - specific benefit]
- [Pro 2 - specific benefit]
- [Pro 3 - specific benefit]

**Cons**:
- [Con 1 - specific drawback]
- [Con 2 - specific drawback]

**Best when**: [Scenario where this is the right choice]

---

## Option B: [Descriptive Name]

[Same structure as Option A]

---

## Option C: [Descriptive Name]

[Same structure as Option A]

---

## Recommendation

**Recommended: Option [X]** - [Name]

**Primary reasons**:
1. [Reason 1 - most important]
2. [Reason 2 - supporting]
3. [Reason 3 - if applicable]

**Trade-offs accepted**:
- [What we give up by choosing this]

**When to reconsider**:
- [Conditions that would make another option better]
```

## Formatting Rules

### Context Section
- Maximum 3 sentences
- Include key constraints that affect the decision
- No implementation details

### Overview Table
- Always include: Complexity, Risk, Best For
- Add 1-2 domain-specific factors (Scalability, Performance, Maintainability, etc.)
- Use ⭐ scale (⭐ to ⭐⭐⭐) for qualitative factors
- "Best For" should be a short use case descriptor

### Individual Options
- Summary: Exactly one sentence
- How it works: 2-3 sentences max, high-level only
- Pros: 2-4 bullet points, specific and concrete
- Cons: 2-4 bullet points, specific and concrete
- Best when: One sentence describing ideal scenario

### Recommendation Section
- State recommended option clearly at top
- Exactly 2-3 primary reasons
- Always acknowledge trade-offs
- "When to reconsider" helps future decision-making

## Complexity Scale

| Size | Meaning |
|------|---------|
| **S** | Hours of work, low risk |
| **M** | Days of work, manageable risk |
| **L** | Week+ of work, requires planning |
| **XL** | Major effort, significant risk |

## Risk Scale

| Level | Meaning |
|-------|---------|
| **Low** | Well-understood, few unknowns |
| **Medium** | Some unknowns, manageable |
| **High** | Significant unknowns, potential blockers |

## Star Rating Guide

Use for qualitative factors in overview table:

| Rating | Meaning |
|--------|---------|
| ⭐ | Poor/Low |
| ⭐⭐ | Adequate/Medium |
| ⭐⭐⭐ | Excellent/High |

## Rules for Fair Comparison

1. **No Strawmen**: Every option must be genuinely viable
2. **Balanced Pros/Cons**: Similar detail level for each option
3. **Honest Assessment**: Don't artificially favor one option
4. **Concrete Examples**: Pros/cons should be specific, not generic
5. **Context-Aware**: Consider project's specific constraints

## Anti-patterns to Avoid

❌ **Vague pros/cons**:
- "More flexible" → ✅ "Supports 5 auth providers vs 2"
- "Better performance" → ✅ "Handles 10x more requests"

❌ **Unfair comparison**:
- Option A with 5 pros, Option B with 1 pro → Balance them

❌ **Missing trade-offs**:
- Recommendation without acknowledging downsides

❌ **Too many options**:
- More than 3-4 options creates decision paralysis

## Quality Checklist

Before presenting options:

- [ ] Context is 3 sentences or less
- [ ] Overview table has consistent columns
- [ ] Each option has 2-4 pros AND 2-4 cons
- [ ] Pros/cons are specific, not generic
- [ ] All options are genuinely viable (no strawmen)
- [ ] Recommendation is clear with reasons
- [ ] Trade-offs are acknowledged
- [ ] "When to reconsider" is included

## After Presenting Options

End with `AskUserQuestion` tool:

```
Header: "Approach"
Question: "Which approach would you like to proceed with?"
Options:
  1. "Option A: [Name]" (Recommended) - if A is recommended
  2. "Option B: [Name]"
  3. "Option C: [Name]"

(User can always select "Other" for custom approach)
```
