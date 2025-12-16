---
name: dev-plan-output
description: Defines the standard output format and template for creating development plans. Use this skill to ensure consistent, well-structured development plan formatting across any project type and technology stack.
---

# Development Plan Output Format Specification

## Overview

A Development Plan transforms task descriptions into actionable implementation steps. It ensures consistent patterns across the codebase while maintaining quality standards and architectural integrity.

## Target Audience

Assume the primary reader of the development workflow is a **junior developer** who will implement the feature with awareness of the existing codebase context.

## Document Structure

### File Naming

Save as: `{prefix}-{TASK-KEY}-{brief-description}.md`, `{TASK-KEY}-{brief-description}.md`, or `{brief-description}.md` in the project's designated development plans directory.

- `{prefix}` - Optional system name (e.g., `jira`, `gh` for GitHub, `linear`, etc.)
- `{TASK-KEY}` - Optional task identifier from your project management system
- `{brief-description}` - Short, kebab-case description of the task

Examples:

- `jira-PROJ-123-add-user-authentication.md`
- `gh-456-fix-login-bug.md`
- `FEAT-789-implement-search-feature.md`
- `add-user-authentication.md`

### Required Sections

```markdown
# Development Plan: [Task ID] - [Brief Description]

> **Task Reference**: [Link to task if available]
> **Type**: [Feature/Bug Fix/Refactoring/Integration/etc.]

## Goal

[Describe what needs to be achieved, why it's needed, the technical approach, and measurable success criteria]

## Relevant Files

- `path/to/file1.ext` - Brief description of why this file is relevant (e.g., Contains the main component/service for this feature)
- `path/to/file1.test.ext` - Unit tests for `file1.ext`
- `path/to/file2.ext` - Brief description (e.g., API route handler, database model, utility functions)
- `path/to/file2.test.ext` - Unit tests for `file2.ext`
- `path/to/config/file.ext` - Brief description (e.g., Configuration file for feature flags, environment settings)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `Component.tsx` and `Component.test.tsx` in the same directory)
- Include the test command for the project (e.g., `npm test`, `pytest`, `cargo test`, etc.)
- List any specific testing patterns or conventions used in the project

## Tasks

- [ ] 1.0 Parent Task Title
  - [ ] 1.1 [Sub-task description 1.1]
  - [ ] 1.2 [Sub-task description 1.2]
- [ ] 2.0 Parent Task Title
  - [ ] 2.1 [Sub-task description 2.1]
- [ ] 3.0 Parent Task Title (may not require sub-tasks if purely structural or configuration)
```

This streamlined format ensures efficient, high-quality implementation while maintaining consistency with project standards and architectural patterns.
