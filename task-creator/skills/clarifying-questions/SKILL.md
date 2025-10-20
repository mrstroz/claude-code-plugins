---
name: clarifying-questions
description: Defines the approach for gathering requirements through systematic clarifying questions. Use this skill to ensure all necessary information is collected before creating a task.
---

# Clarifying Questions Framework

## Purpose

Before creating any task, you MUST ask clarifying questions to gather sufficient detail. The goal is to understand the "what" and "why" of the feature, not necessarily the "how" (which the developer will figure out).

## CRITICAL: Use AskUserQuestion Tool

**You MUST use the `AskUserQuestion` tool from Claude Code to gather requirements.**

- Do NOT ask questions in plain text
- Use the tool to present structured questions with clear options
- Limit to 1-4 questions per round to avoid overwhelming the user
- Each question should have 2-4 specific options plus automatic "Other" option

## Core Question Categories

**IMPORTANT:** You do NOT need to ask questions from every category. Select only the most relevant categories based on what information is missing.

### Priority Levels

**MUST ASK (Always):**

**1. Problem & Goal**
- "What problem does this solve or what is the main goal?"

**2. Acceptance Criteria**
- "How will we know when this is successfully done?"

**3. Scope**
- "What is in scope vs out of scope for this task?"

**SHOULD ASK (When unclear):**

**4. Target User & Use Cases**
- "Who is the primary user and what key actions should they perform?"

**5. Technical Details**
- "Are there specific technical approaches, dependencies, or constraints to consider?"

**MAY ASK (If relevant):**

**6. Design & Data**
- "Are there design mockups or specific data requirements?"

**7. Edge Cases & Timeline**
- "What edge cases or error conditions should we consider? What is the timeline?"

## Question Strategy

### Adaptive Questioning
Tailor your questions based on the task type and what information is already provided:

**For Feature Tasks:**
- MUST: Problem/Goal, Acceptance Criteria, Scope
- SHOULD: Target Users, Use Cases
- MAY: Design/UI, Technical Details

**For Bug Tasks:**
- MUST: Problem description, Expected vs Actual behavior
- SHOULD: Reproduction steps, Impact/Severity
- MAY: Affected users, Error logs

**For Refactoring Tasks:**
- MUST: Current pain points, Desired improvements
- SHOULD: Scope of changes, Risks
- MAY: Backward compatibility, Testing strategy

**For Documentation Tasks:**
- MUST: Target audience, Content scope
- SHOULD: Format and structure
- MAY: Existing docs to reference

### Question Depth
- Start with **broad questions** to understand context
- Follow up with **specific questions** to fill gaps
- Limit to **1-4 questions per round** using AskUserQuestion tool
- Prioritize the most critical unknowns first

## When to Stop Asking Questions

You have enough information when you can answer:
- [ ] What problem are we solving and why?
- [ ] Who is the user and what do they need to do?
- [ ] What does success look like (acceptance criteria)?
- [ ] What are the key technical considerations?
- [ ] What is in scope vs out of scope?

If you can't answer these, keep asking questions using the AskUserQuestion tool.

## Usage Notes

- **MUST use AskUserQuestion tool** - Never ask questions in plain text
- **Always ask questions first** - Don't create a task with assumptions
- **Confirm understanding** - Summarize what you learned before creating the task
- **Iterate if needed** - If answers reveal new unknowns, ask follow-up questions with the tool
