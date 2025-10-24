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

Ask clarifying questions using the `AskUserQuestion` tool if you don't have enough information to create a complete task.

### Step 4: Create Task Based on Complexity

**If Task Complexity is "Simple":**

- Create the task directly based on the task details provided
- Do NOT analyze the application in-depth
- Focus on creating a straightforward task definition with basic information
- Structure the task with essential fields only (title, description, type, acceptance criteria)

**If Task Complexity is "Complex":**

- Use the `tasks:task-creator` agent to perform deep analysis of requirements and create the task
- The agent will analyze the application context and dependencies
- **CRITICAL:** You MUST use the Claude Code agent system (Task tool) for complex tasks - do not attempt to create complex tasks yourself

### Step 5: Task Output

Return the task output in a standardized, structured, and consistent format. Use skill `tasks:task-output`. Review and present the task to the user for approval.
