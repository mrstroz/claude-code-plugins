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

## Step 3: Format and Present Review Report

1. Format the review report output using the `dev-plan:review-output` skill
2. Present the architectural review report to the user
3. Highlight key findings:
   - Overall assessment (Approved/Approved with Recommendations/Requires Revision/Rejected)
   - Critical and high priority issues that need attention
   - Consistency violations with project standards
   - Positive aspects of the plan
