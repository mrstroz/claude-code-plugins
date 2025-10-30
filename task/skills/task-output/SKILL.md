---
name: task-output
description: Defines the standard output format and template for task creation. Use this skill to ensure consistent, well-structured task formatting.
---

# Task Output Format Specification

## Target Audience

Assume the primary reader of the task is a junior developer. Therefore, the requirements should be explicit and unambiguous, and jargon should be avoided where possible. Provide enough detail to enable them to understand the purpose of the task and its core logic.

## Creating Tasks

- The title and description must always be in English.
- The description should contain all required sections in Markdown format.
- **Never** create a task before returning the proposed version to the console for user review.

## Task Categories

Tasks should be categorized based on their nature:

- **Story**: New functionality or feature development
- **Task**: General development work, refactoring, or improvements
- **Bug**: Fixing defects or issues in existing functionality
- **Epic**: Large features that span multiple stories/tasks
- **Subtask**: Smaller work items that are part of a larger story/task

## Title Naming Convention

Task titles should follow these patterns based on category:

- **Story**: `[Feature] <Action> <Object>` - e.g., "Add OAuth2 authentication to login"
- **Task**: `<Action> <Object>` - e.g., "Refactor user authentication service"
- **Bug**: `Fix <Issue Description>` - e.g., "Fix login failing with special characters"
- **Epic**: `<Feature Name>` - e.g., "User Authentication System"
- **Subtask**: `<Parent Context> - <Specific Action>` - e.g., "OAuth2 - Add frontend integration"

**General Title Rules:**

- Use imperative mood (Add, Fix, Update, Remove, Implement)
- Be specific and concise (max 80 characters)
- Avoid technical jargon when possible
- Don't include issue numbers or prefixes in the title

## Task Description Structure

A good task description should contain the following sections:

### Goal

A brief description (1-2 sentences) of _why_ this task is needed. What problem does it solve or what business value does it provide?

### Acceptance Criteria

A list of specific, verifiable conditions that must be met to consider the task **done**. Present them as a checklist.

### Technical Details / Implementation Hints (Optional)

Technical guidance that can speed up the work. Not a full instruction manual, but helpful information about key files, libraries, patterns, and implementation approach.

This section should be included for **Complex** tasks to provide deep technical context and implementation guidance.

### Designs & Attachments (Optional)

Links to mockups, documentation, API specifications, logs, or other materials needed to complete the task.

### Related Issues (Optional)

Dependencies or related tasks. Include URLs if using a task management system.

### Reviewer Comments (Only for Plan Reviews)

This section is populated only during development plan reviews. It contains additional changes and recommendations identified during the architectural review process. When creating a new development plan, leave this section empty.

If populated during review, this section should include:

- Critical or high-priority issues that require attention
- Recommended changes to improve the implementation
- References to existing patterns that should be followed
- Brief rationale for suggested modifications

## Quality Requirements Checklist

When creating any task, ensure you follow these requirements:

**Titles:**

- [ ] Use imperative mood (Add, Fix, Update, Remove, Implement)
- [ ] Be specific and descriptive (max 80 characters)
- [ ] Follow the category naming convention

**Goal Section:**

- [ ] Keep to 1-2 sentences explaining WHY, not WHAT
- [ ] Clearly state business value or problem being solved

**Acceptance Criteria:**

- [ ] 3-6 essential criteria only (avoid overwhelming lists)
- [ ] Each criterion is unique and specific
- [ ] All criteria are testable and verifiable
- [ ] Use checkbox format for trackability

**Technical Details:**

- [ ] 3-5 main points maximum
- [ ] Mention key files/components that need modification
- [ ] Include essential patterns or existing code to follow
- [ ] Avoid obvious implementation details

**Overall Task:**

- [ ] Keep entire description under 50 lines
- [ ] Include all required sections (even if some are brief)
- [ ] Use proper Markdown formatting
- [ ] Write for the implementing developer

## Output Format Requirements

When displaying a task to the user, the format MUST be:

1. **Title**: Clear, concise task title following naming conventions
2. **Description**: Structured markdown content containing all the sections above (Goal, Acceptance Criteria, Technical Details, Designs & Attachments, Related Issues if applicable)
3. **Proper Markdown formatting**: Use headers, bullet points, checkboxes, and code blocks as shown in examples
4. **Complete structure**: Every task MUST include all required sections, even if some are brief
5. **Conciseness**: Keep the entire task description focused and readable (typically under 50 lines)

## Complete Output Format Example

```markdown
**Title:** [Feature] Add OAuth2 authentication to login system

**Description:**

## Goal

The goal is to implement OAuth2 authentication to improve security and enable single sign-on capabilities for enterprise customers, reducing friction in the login process.

## Acceptance Criteria

- [ ] User can authenticate using Google OAuth2 provider
- [ ] OAuth2 flow redirects correctly after authentication
- [ ] User profile data is stored securely after first login
- [ ] Error messages display clearly for authentication failures
- [ ] Unit tests cover the OAuth2 flow logic
- [ ] Documentation updated with OAuth2 setup instructions

## Technical Details / Implementation Hints

- Changes affect the `AuthService` and the `LoginForm.tsx` React component
- Use the `passport-google-oauth20` library for OAuth2 integration
- Remember to add unit tests for the new logic in `AuthService`
- The new authentication logic should be covered by a feature flag named `OAUTH2_ENABLED`
- API endpoints: `GET /auth/google` (initiate) and `GET /auth/google/callback` (callback)
- Store OAuth tokens securely using the existing `TokenManager` service

## Designs & Attachments

- **Mockup:** [Login Screen with OAuth2 Button](https://figma.com/file/xyz789/login-oauth)
- **API Docs:** [OAuth2 Integration Guide](https://docs.google.com/oauth2)
- **Security Guidelines:** [Authentication Best Practices](https://security.example.com/oauth2)

## Related Issues

- Related to: Authentication System Refactoring
- Depends on: User Profile Database Schema Update
- Blocks: Single Sign-On Implementation for Enterprise
```

## Quick Reference Examples

### Bug Task

```markdown
**Title:** Fix PDF export failing intermittently

## Goal
Fix intermittent PDF export failures (~20% rate) to reduce support tickets.

## Acceptance Criteria
- [ ] Export success rate > 99%
- [ ] No timeout errors for documents up to 100 pages
- [ ] Error logging captures failure details

## Technical Details / Implementation Hints
- Issue likely in `services/pdfExport.ts` - memory leak suspected
- Add resource cleanup after export completion/failure
- Implement timeout monitoring and alerting
```

### Simple Task

```markdown
**Title:** Update documentation for API v2 endpoints

## Goal
Update API docs to reflect v2 changes and improve developer onboarding.

## Acceptance Criteria
- [ ] All v2 endpoints documented with examples
- [ ] Authentication section updated
- [ ] Code examples in JavaScript and Python

```

## Usage Notes

- Always adapt the template to fit the specific task - not every section needs extensive content
- For simple tasks, some sections can be brief
- For complex tasks, expand sections as needed but stay focused
- Consistency is key - use the same structure for similar task types
- Include links, references, and context generously
- Write for the developer who will implement this, not for yourself
