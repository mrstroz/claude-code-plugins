---
description: Create a new task for software development projects
---

## Workflow

### Step 1: Task Details

Task details provided: $ARGUMENTS

If no arguments are provided, ask the user to provide task details or description.

### Step 2: Determine Task Type and Complexity

Use the `AskUserQuestion` tool to gather essential task metadata:

1. **Task Type**: Ask the user to select the type of task:
   - Task
   - Story
   - Bug

2. **Task Complexity**: Ask the user to indicate the complexity level:
   - Simple
   - Complex

**CRITICAL:** You MUST use the `AskUserQuestion` tool for these questions - do not ask in plain text.

### Step 3: Gather Clarifying Questions

Ask clarifying questions using the `AskUserQuestion` tool **only if** you don't have enough information to create a complete task.

### Step 4: Delegate to Task Creator Agent

Use the `@task-creator` agent to analyze requirements and create the task.

**CRITICAL:** You MUST use the Claude Code agent system (Task tool) for this step - do not attempt to create the task yourself.

### Step 5: Task Output

Return the task output in a standardized, structured, and consistent format. Review and present the task to the user for approval.
