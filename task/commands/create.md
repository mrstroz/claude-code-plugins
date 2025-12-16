---
description: Create a new task for software development projects
---

# Workflow

## Step 1: Gather Task Details

Task details provided: $ARGUMENTS

If no arguments provided, ask the user to provide task details or description.

## Step 2: Clarify Requirements (if needed)

If the provided details are incomplete or ambiguous, use skill `task:task-clarifying-questions` to gather missing information via `AskUserQuestion` tool.

## Step 3: Determine Task Metadata

Use `AskUserQuestion` tool to gather task metadata in a **single call**:

1. **Task Type**:
   - Story (new functionality)
   - Task (refactoring, improvements)
   - Bug (fixing defects)
   - Epic (large feature spanning multiple tasks)
   - Subtask (part of larger story/task)

2. **Task Complexity**:
   - Simple (straightforward, no deep analysis needed)
   - Complex (requires codebase analysis, multiple components)
**CRITICAL:** You MUST use the `AskUserQuestion` tool for these questions - do not ask in plain text.

## Step 4: Create Task

**Simple tasks:**

- Create directly based on provided details
- No in-depth application analysis
- Essential fields only: title, goal, acceptance criteria

**Complex tasks:**

- Use `task:task-creator` agent (Task tool) for deep analysis
- Agent analyzes application context, dependencies, and patterns
- **CRITICAL:** Always use the agent for complex tasks

## Step 5: Output and Review

Use skill `task:task-output` to format the task. Present to user for approval before finalizing.
