---
description: Generate and compare 2-3 implementation approaches with trade-offs analysis - standalone options comparison
---

# /options Command

Generate and compare multiple implementation approaches for a task.

## Description

Standalone options generation. Use this when you:
- Already understand the codebase context
- Want to quickly compare different approaches
- Need to present trade-offs to stakeholders
- Are deciding between architectural choices

## Arguments

`$ARGUMENTS` - Task or decision to generate options for.

## Workflow

### Step 1: Get Task

If `$ARGUMENTS` is empty:
- Use `AskUserQuestion` to ask user to describe the task or decision

### Step 2: Quick Context Gathering

Before generating options, do a lightweight discovery:

**CRITICAL**: Use Task tool to invoke the discovery agent:
```
Task tool with subagent_type: "dev-plan-v2:discovery-agent"
```

Provide the agent with:
- Task from arguments
- Instruction: "Quick context gathering only - focus on existing patterns and constraints that affect approach options. Skip detailed risk analysis."

### Step 3: Generate Options

**CRITICAL**: Use Task tool to invoke the approach designer agent:
```
Task tool with subagent_type: "dev-plan-v2:approach-designer"
```

Provide the agent with:
- Task description
- Quick discovery context
- Instruction to generate 2-3 viable approaches with trade-offs

### Step 4: Format Output

**CRITICAL**: Use Skill tool to invoke `dev-plan-v2:options-output` to format the options comparison.

### Step 5: Present and Select

Agent will present options and use `AskUserQuestion` for selection:
- Header: "Approach"
- Question: "Which approach would you like to proceed with?"
- Options: [Generated options + "None - just exploring"]

### Step 6: Next Steps

**IF user selected an approach**:
- Use `AskUserQuestion`:
  - Header: "Next"
  - Question: "Would you like to create a detailed plan for this approach?"
  - Options:
    1. "Yes - create plan" (Recommended)
    2. "No - done for now"

**IF "Yes - create plan"**:
- Invoke plan-writer agent directly with selected approach
- Skip discovery (already done) and options (already selected)

**IF user selected "None - just exploring"**:
- End gracefully, thank user for exploring options

## Use Cases

### Use Case 1: Architecture decision
```
User: /options state management for React app

Output:
- Option A: Redux (enterprise-grade, verbose)
- Option B: Zustand (lightweight, simple)
- Option C: React Context (built-in, limited)

User: Selects Zustand, creates plan
```

### Use Case 2: Quick comparison for stakeholder
```
User: /options caching strategy for API

Output:
- Option A: Redis (distributed, setup needed)
- Option B: In-memory (simple, not shared)
- Option C: CDN edge caching (external, cost)

User: Takes comparison to stakeholder meeting
```

### Use Case 3: Refactoring strategy
```
User: /options migrating from REST to GraphQL

Output:
- Option A: Big bang migration
- Option B: Gradual with BFF pattern
- Option C: Hybrid - new features only

User: Selects gradual approach
```

## Output Example

```markdown
# Options: Implementing User Notifications

## Quick Context
- Existing: REST API, PostgreSQL, no real-time features
- Constraints: Must work with mobile app

---

## Options Overview

| Approach | Complexity | Risk | Scalability | Best For |
|----------|------------|------|-------------|----------|
| A: Polling | S | Low | ⭐ | MVP/Simple |
| B: WebSockets | M | Medium | ⭐⭐⭐ | Real-time |
| C: Server-Sent Events | S | Low | ⭐⭐ | One-way updates |

---

## Option A: Short Polling

**Summary**: Client polls `/notifications` endpoint every N seconds.

**Pros**:
- Simple implementation
- Works everywhere
- No infrastructure changes

**Cons**:
- Not real-time (delay)
- Increased server load
- Battery drain on mobile

**Best when**: MVP, low traffic, real-time not critical.

---

## Option B: WebSockets

**Summary**: Persistent bidirectional connection for instant updates.

**Pros**:
- True real-time
- Efficient once connected
- Bidirectional communication

**Cons**:
- Infrastructure complexity
- Connection management
- Scaling challenges

**Best when**: Real-time is critical, high engagement expected.

---

## Option C: Server-Sent Events (SSE)

**Summary**: Server pushes updates over HTTP connection.

**Pros**:
- Simpler than WebSockets
- Native browser support
- Works with HTTP/2

**Cons**:
- One-way only
- Limited browser connections
- No mobile native support

**Best when**: One-way updates sufficient, web-focused.

---

## Recommendation

**Recommended: Option C (SSE)** for initial implementation

**Reasons**:
1. Balances simplicity and real-time capability
2. Lower complexity than WebSockets
3. Can upgrade to WebSockets later if needed

**Trade-offs accepted**:
- Mobile app will need different approach (polling fallback)
```
