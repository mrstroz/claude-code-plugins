---
description: Explore codebase to find existing patterns, dependencies, and potential approaches - standalone discovery without full planning
---

# /discover Command

Explore the codebase to understand existing patterns, dependencies, and potential approaches for a task - without creating a full plan.

## Description

Standalone discovery phase. Use this when you want to:
- Understand what already exists before planning
- Find similar implementations in the codebase
- Identify dependencies and potential impacts
- Get a quick assessment of complexity

## Arguments

`$ARGUMENTS` - Topic, feature, or task to explore.

## Workflow

### Step 1: Get Topic

If `$ARGUMENTS` is empty:
- Use `AskUserQuestion` to ask:
  - Header: "Topic"
  - Question: "What would you like me to explore in the codebase?"
  - Options:
    1. "Similar implementations" - Find code that does something similar
    2. "Dependencies" - Map what depends on what
    3. "Patterns" - Understand architectural patterns used
    4. "General exploration" - Broad exploration of a topic

### Step 2: Run Discovery

**CRITICAL**: Use Task tool to invoke the discovery agent:
```
Task tool with subagent_type: "dev-plan-v2:discovery-agent"
```

Provide the agent with:
- Topic/task from arguments
- Instruction to explore thoroughly
- Focus based on user's selection (if from Step 1)

### Step 3: Format Output

**CRITICAL**: Use Skill tool to invoke `dev-plan-v2:discovery-output` to format the findings.

### Step 4: Present Results

Display the formatted discovery report to the user.

### Step 5: Offer Next Steps

Use `AskUserQuestion`:
- Header: "Next"
- Question: "What would you like to do next?"
- Options:
  1. "Create a plan" - Continue to full planning workflow
  2. "Explore more" - Dig deeper into a specific area
  3. "Done" - Finish exploration

**IF "Create a plan"**:
- Invoke `/plan` command with the original topic and discovery context

**IF "Explore more"**:
- Ask what to explore deeper
- Re-run discovery with more specific focus

**IF "Done"**:
- End gracefully

## Use Cases

### Use Case 1: Pre-planning exploration
```
User: /discover authentication patterns

Output: Shows existing auth implementations, patterns used, dependencies

User: Selects "Create a plan" to continue
```

### Use Case 2: Understanding existing code
```
User: /discover how does payment processing work

Output: Maps out payment flow, services involved, external integrations

User: Selects "Done" - just needed to understand
```

### Use Case 3: Impact analysis
```
User: /discover what uses the UserService

Output: Lists all dependencies on UserService, potential impacts

User: Uses info for manual planning
```

## Output Example

```markdown
# Discovery Report: Authentication Patterns

## Existing Patterns Found

### Authentication Flow
- `src/auth/AuthService.ts` - Main auth service
- `src/auth/middleware/authMiddleware.ts` - Request authentication
- `src/auth/strategies/` - Strategy pattern for different auth methods

### Related Components
- `src/users/UserService.ts` - User management (used by auth)
- `src/sessions/SessionStore.ts` - Session management

## Dependencies

**Direct**:
- AuthService → UserService
- AuthService → SessionStore
- authMiddleware → AuthService

**Reverse** (what depends on auth):
- All API routes use authMiddleware
- `src/api/admin/*` - Admin routes require elevated auth

## Risks Identified

- **Technical**: SessionStore uses in-memory storage (not scalable)
- **Scope**: Auth changes may affect all 47 protected routes

## Approach Assessment

**Single Clear Approach**: Yes

**Suggested Approach**:
Follow existing strategy pattern in `src/auth/strategies/`

**Rationale**:
Project already has established pattern for auth extensions.
3 existing strategies follow identical structure.
```
