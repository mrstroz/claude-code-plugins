---
description: Create a comprehensive development plan with hybrid workflow - discovery, optional clarification, optional alternatives, detailed planning, and sanity check
---

# /plan Command

Create a comprehensive development plan using a hybrid workflow that adapts to task complexity.

## Description

Orchestrates the full planning workflow: Discovery → Clarify → Options (if needed) → Plan → Sanity Check.

## Arguments

`$ARGUMENTS` - Task description or requirement to plan for.

## Workflow

### Step 1: Get Task Details

If `$ARGUMENTS` is empty:
- Use `AskUserQuestion` to ask user to provide task details or description
- Wait for response before proceeding

### Step 2: Discovery Phase 🔍

**CRITICAL**: Use Task tool to invoke the discovery agent:
```
Task tool with subagent_type: "dev-plan-v2:discovery-agent"
```

Provide the agent with:
- Task description from arguments
- Instruction to explore codebase thoroughly
- Instruction to assess if single or multiple approaches exist

**CRITICAL**: After agent completes, use Skill tool to invoke `dev-plan-v2:discovery-output` to format the findings.

Present discovery summary to user.

### Step 3: Clarification Phase ❓ (Conditional)

Check discovery output for `Clarification Needs` section.

**IF clarifications needed**:

Use Task tool to invoke the clarifier agent:
```
Task tool with subagent_type: "dev-plan-v2:clarifier-agent"
```

Provide the agent with:
- Task description
- Discovery findings
- Identified clarification needs

Agent will use `AskUserQuestion` to gather answers.

Collect clarified requirements.

**IF no clarifications needed**: Skip to Step 4.

### Step 4: Approach Decision Point 🎯

Check discovery output for `Approach Assessment` section.

**IF Single Clear Approach = Yes**:

Use `AskUserQuestion` with these options:
- Header: "Approach"
- Question: "Discovery found one clear approach: [describe the approach]. How would you like to proceed?"
- Options:
  1. "Accept this approach" (Recommended) - Proceed to planning with suggested approach
  2. "Show me alternatives" - Generate alternative approaches for comparison

**IF user selects "Accept this approach"**:
- Store the suggested approach
- Skip to Step 5

**IF user selects "Show me alternatives"**:
- Continue to OPTIONS phase below

**IF Single Clear Approach = No**:
- Continue to OPTIONS phase below

---

**OPTIONS Phase** (when needed):

Use Task tool to invoke the approach designer agent:
```
Task tool with subagent_type: "dev-plan-v2:approach-designer"
```

Provide the agent with:
- Task description
- Discovery findings
- Clarified requirements (if any)

**CRITICAL**: After agent completes, use Skill tool to invoke `dev-plan-v2:options-output` to format options.

Agent will present 2-3 approaches and use `AskUserQuestion` to get user's selection.

Store the selected approach.

### Step 5: Plan Writing Phase 📝

Use Task tool to invoke the plan writer agent:
```
Task tool with subagent_type: "dev-plan-v2:plan-writer"
```

Provide the agent with:
- Task description
- Discovery findings
- Clarified requirements (if any)
- Selected/approved approach
- Instruction to create detailed plan with dependency mapping

**CRITICAL**: After agent completes, use Skill tool to invoke `dev-plan-v2:plan-output` to format the plan.

### Step 6: Sanity Check Phase ✓

Use Task tool to invoke the sanity checker agent:
```
Task tool with subagent_type: "dev-plan-v2:sanity-checker"
```

Provide the agent with:
- The complete plan from Step 5
- Discovery findings (for cross-reference)
- Instruction to validate completeness and consistency

**IF sanity check PASSED**:
- Proceed to Step 7

**IF sanity check NEEDS REVISION**:
- Take the feedback
- Go back to Step 5 with feedback for plan-writer to revise
- Maximum 2 revision cycles (then save with notes)

### Step 7: Save Plan

1. Create `docs/plans/` directory if it doesn't exist

2. Determine filename:
   - If task has ID: `{TASK-ID}-{brief-description}.md`
   - Otherwise: `{brief-description}.md`
   - Use kebab-case for description

3. Save the formatted plan to `docs/plans/{filename}`

4. Inform user:
   ```
   ✅ Development plan saved to: docs/plans/{filename}

   Summary:
   - Complexity: [S/M/L/XL]
   - Phases: [N] phases, [M] tasks total
   - Must-have: [X] tasks
   - Nice-to-have: [Y] tasks
   ```

## Error Handling

- If any agent fails, report the error and ask user how to proceed
- If user cancels at any decision point, gracefully exit with partial results saved (if any)
- If codebase is empty/new, skip discovery and ask user for approach directly

## Flow Diagram

```
START
  │
  ▼
┌─────────────┐
│  DISCOVERY  │──────────────────────────────┐
└─────────────┘                              │
  │                                          │
  ▼                                          │
┌─────────────┐                              │
│ Needs       │──No──────────────────────────┤
│ Clarify?    │                              │
└─────────────┘                              │
  │ Yes                                      │
  ▼                                          │
┌─────────────┐                              │
│  CLARIFY    │──────────────────────────────┤
└─────────────┘                              │
                                             │
  ◄──────────────────────────────────────────┘
  │
  ▼
┌─────────────┐
│ Single      │──Yes──┐
│ Approach?   │       │
└─────────────┘       ▼
  │ No         ┌─────────────┐
  │            │ User OK?    │──Yes──┐
  │            └─────────────┘       │
  │              │ No                │
  │              ▼                   │
  │       ┌─────────────┐            │
  └──────►│  OPTIONS    │            │
          └─────────────┘            │
                │                    │
                ▼                    │
          ┌─────────────┐            │
          │ User Select │            │
          └─────────────┘            │
                │                    │
                ▼◄───────────────────┘
          ┌─────────────┐
          │   PLAN      │◄──────┐
          └─────────────┘       │
                │               │
                ▼               │
          ┌─────────────┐       │
          │   SANITY    │──Fail─┘
          │   CHECK     │  (max 2x)
          └─────────────┘
                │ Pass
                ▼
          ┌─────────────┐
          │    SAVE     │
          └─────────────┘
                │
                ▼
              DONE
```

## Examples

**Example 1: Simple task with clear pattern**
```
User: /plan add email field to user registration form

Discovery: Found existing form pattern in src/forms/, single approach obvious
User: Accepts suggested approach
Plan: Created with 5 tasks
Sanity: Passed
Saved: docs/plans/add-email-to-registration.md
```

**Example 2: Complex task with alternatives**
```
User: /plan implement real-time notifications

Discovery: Multiple valid approaches (WebSocket, SSE, polling)
Options: Presented 3 approaches with trade-offs
User: Selected WebSocket approach
Plan: Created with 12 tasks across 3 phases
Sanity: Passed
Saved: docs/plans/implement-realtime-notifications.md
```
