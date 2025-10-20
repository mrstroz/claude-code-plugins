---
description: Create a new task for software development projects
---

## Workflow

### Step 1: Task Details

Task details provided: $ARGUMENTS

If no arguments are provided, ask the user to provide task details or description.

### Step 2: Gather Clarifying Questions

**MUST ask clarifying questions** to gather all necessary information before creating the task.

### Step 3: Delegate to Task Creator Agent

Use the `@task-creator` agent to analyze requirements and create the task.

**CRITICAL:** You MUST use the Claude Code agent system (Task tool) for this step - do not attempt to create the task yourself.

### Step 4: Task Output

Return the task output in a standardized, structured, and consistent format. Review and present the task to the user for approval.
