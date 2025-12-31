---
description: Create a comprehensive development plan from a task description or requirement
---

# Workflow

## Step 1: Task Details

Task details provided: $ARGUMENTS

If no arguments are provided, ask the user to provide task details or description.

## Step 2: Create Development Plan

Use the `dev-plan:dev-plan-creator` agent to create a comprehensive development plan:

- The agent will analyze the application context and dependencies
- The agent will transform the task description into a detailed, actionable implementation roadmap
- **CRITICAL:** You MUST use the Task tool with `subagent_type: "dev-plan:dev-plan-creator"` to create the development plan

## Step 3: Format and Save Development Plan

1. **CRITICAL:** You MUST use the Skill tool to invoke `dev-plan:dev-plan-output` skill to format the development plan output according to the standard template
2. Save the formatted development plan to `docs/dev-plans/` directory with a descriptive filename:
   - Format: `{prefix}-{TASK-KEY}-{brief-description}.md`, `{TASK-KEY}-{brief-description}.md`, or `{brief-description}.md`
   - Where `{prefix}` is the system name (e.g., `jira`, `gh` for GitHub, `linear`, etc.) if applicable
   - Example: `jira-PROJ-123-add-user-authentication.md` or `gh-456-fix-login-bug.md`
3. Present the formatted development plan to the user for review
