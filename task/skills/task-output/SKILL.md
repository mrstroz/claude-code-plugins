---
name: task-output
description: Defines the standard output format and template for task creation. Use this skill when creating new tasks (stories, bugs, epics, subtasks) to ensure consistent, well-structured formatting with proper titles, goals, acceptance criteria, and technical details.
---

# Task Output Format Specification

## Target Audience

Assume the primary reader is a junior developer. Requirements should be explicit, unambiguous, and avoid jargon. Provide enough detail to understand the purpose and core logic.

## Creating Tasks

- Title and description must always be in English
- Description should contain all required sections in Markdown format
- **Never** create a task before returning the proposed version for user review

## Task Categories

- **Story**: New functionality or feature development
- **Task**: General development work, refactoring, or improvements
- **Bug**: Fixing defects or issues in existing functionality
- **Epic**: Large features spanning multiple stories/tasks
- **Subtask**: Smaller work items part of a larger story/task

## Title Naming Convention

| Category | Pattern | Example |
|----------|---------|---------|
| Story | `[Feature] <Action> <Object>` | "Add OAuth2 authentication to login" |
| Task | `<Action> <Object>` | "Refactor user authentication service" |
| Bug | `Fix <Issue Description>` | "Fix login failing with special characters" |
| Epic | `<Feature Name>` | "User Authentication System" |
| Subtask | `<Parent Context> - <Specific Action>` | "OAuth2 - Add frontend integration" |

**Rules:** Use imperative mood (Add, Fix, Update, Remove, Implement). Be specific and concise (max 80 characters). Avoid technical jargon.

## Task Description Structure

### Goal (Required)

1-2 sentences explaining _why_ this task is needed. What problem does it solve or what business value does it provide?

### Acceptance Criteria (Required)

Specific, verifiable conditions that must be met. Present as a checklist (3-6 items). Each criterion must be testable and unique.

### Technical Details / Implementation Hints (Optional)

Technical guidance for complex tasks:

- Key files/components to modify
- Libraries or patterns to use
- Important considerations (3-5 points max)

### Designs & Attachments (Optional)

Links to mockups, documentation, API specifications, or other materials.

### Related Issues (Optional)

Dependencies or related tasks with URLs if using a task management system.

## Output Format

```markdown
**Title:** [Category-appropriate title following naming convention]

**Description:**

## Goal

[1-2 sentences explaining why this task is needed]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Details / Implementation Hints

- [Key file or component]
- [Pattern or library to use]
- [Important consideration]

## Designs & Attachments

- [Link to resource]

## Related Issues

- [Related task or dependency]
```

## Examples

See [references/examples.md](references/examples.md) for complete examples of each task category.

## Quality Checklist

Before finalizing any task, verify:

- [ ] Title uses imperative mood and follows category convention
- [ ] Goal explains WHY (not WHAT) in 1-2 sentences
- [ ] Acceptance criteria are testable (3-6 items)
- [ ] Technical details mention key files/patterns (if included)
- [ ] Entire description is under 50 lines
- [ ] Proper Markdown formatting used
