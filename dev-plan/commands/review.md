---
description: Review a development plan or implementation proposal for architectural soundness and consistency
---

# Workflow

## Step 1: Development Plan Input

Development plan provided: $ARGUMENTS

If no arguments are provided, ask the user to provide:

- A file path to the development plan (e.g., `docs/dev-plans/add-authentication.md`)
- Or the development plan content directly

## Step 2: Review Development Plan

Use the `dev-plan:dev-plan-reviewer` agent to conduct a comprehensive architectural review:

- The agent will analyze the plan from multiple technical dimensions
- The agent will identify architectural issues, inconsistencies, and violations
- The agent will compare the approach with existing project patterns
- The agent will provide actionable recommendations for improvements
- **CRITICAL:** You MUST use the Task tool with `subagent_type: "dev-plan:dev-plan-reviewer"` to review the development plan

## Step 3: Format and Save Review Report

1. Format the review report output using the `dev-plan:review-output` skill
2. Save the review report to `docs/plan-reviews/` directory with the same filename as the development plan:
   - If the development plan was at `docs/dev-plans/TASK-123-feature.md`, save review to `docs/plan-reviews/TASK-123-feature.md`
   - Extract the filename from the development plan path and use it for the review file
   - Ensure the `docs/plan-reviews/` directory exists (create it if needed)
3. Inform the user that the review has been saved and provide the file path

## Step 4: Ask About Applying Corrections

Use the `AskUserQuestion` tool to ask if the user wants to apply the corrections suggested in the review:

1. **Apply Corrections**: Ask the user if they want to apply corrections to the development plan:
   - Yes
   - No

**CRITICAL:** You MUST use the `AskUserQuestion` tool for this question - do not ask in plain text.

If the user selects "No", end the workflow here.

If the user selects "Yes", proceed to Step 5.

## Step 5: Gather Implementation Preferences for Issues

For each **Critical** and **High** severity issue identified in the review, use the `AskUserQuestion` tool to ask how the user wants to implement the fix:

1. For each issue, create a question with the issue title as the header
2. Provide implementation options based on the recommendations in the review:
   - Implement as recommended
   - Skip this issue
   - Custom approach (user will provide details in "Other")

**CRITICAL:** You MUST use the `AskUserQuestion` tool for these questions - do not ask in plain text.

## Step 6: Apply Corrections to Development Plan

1. Based on the user's choices, update the development plan file in `docs/dev-plans/`
2. Apply the recommended changes for issues where user selected "Implement as recommended"
3. For "Custom approach", incorporate the user's provided details
4. Skip issues where user selected "Skip this issue"
5. Format the updated development plan using the `dev-plan:dev-plan-output` skill to ensure consistency
6. Save the updated development plan to the same file
7. Inform the user that the corrections have been applied and provide a summary of changes made
