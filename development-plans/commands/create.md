---
description: Create a comprehensive development plan from a task description or requirement
---

## Workflow

### Step 1: Task Details

Task details provided: $ARGUMENTS

If no arguments are provided, ask the user to provide task details or description.

### Step 2: Create Development Plan

Use the `development-plans:development-plan-creator` agent to create a comprehensive development plan:

- The agent will analyze the application context and dependencies
- The agent will transform the task description into a detailed, actionable implementation roadmap
- **CRITICAL:** You MUST use the Task tool with `subagent_type: "development-plans:development-plan-creator"` to create the development plan

### Step 3: Format and Save Development Plan

1. Format the development plan output using the `development-plans:development-plan-output` skill
2. Save the development plan to `docs/dev-plans/` directory with a descriptive filename:
   - Format: `{TASK-KEY}-{brief-description}.md` or `{brief-description}.md`
3. Present the development plan to the user for review
