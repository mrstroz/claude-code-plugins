# Example: Bug

**User says:** "When saving a user with an email containing a + alias (like john+test@example.com), the system strips the + and everything after it"

**Clarification via `AskUserQuestion`:**

```json
{
  "questions": [
    {
      "question": "When does the email get modified?",
      "header": "Repro scope",
      "options": [
        {"label": "Create only", "description": "Only when registering a new user"},
        {"label": "Edit only", "description": "Only when updating an existing user profile"},
        {"label": "Both", "description": "Happens on both registration and profile edit"}
      ],
      "multiSelect": false
    },
    {
      "question": "I found `UserService.normalizeEmail()` in the API. Where is the issue?",
      "header": "Root cause",
      "options": [
        {"label": "API normalization (Recommended)", "description": "Fix normalizeEmail() — the frontend sends the correct value with +"},
        {"label": "Frontend formatting", "description": "The frontend strips the + before sending to the API"},
        {"label": "Not sure", "description": "Needs investigation on both sides"}
      ],
      "multiSelect": false
    }
  ]
}
```

**User selects:** "Both" + "API normalization"

**Draft:**

```
## Fix email address validation strips valid + aliases on user save

**Type:** Bug
**Subsystem(s):** backend-api

### Description
When saving a user with an email address that includes a `+` alias (e.g., `john+test@example.com`), the system strips the `+` and everything after it, storing the email as `john@example.com`. The frontend sends the correct value — the issue is in the API-side normalization logic. Affects both user registration and profile editing.

### Steps to Reproduce
1. Open Settings → Edit profile (or register a new account)
2. Enter email with a + alias, e.g., `john+test@example.com`
3. Save the profile
4. Re-open the profile — email is stored as `john@example.com` (alias stripped)

### Acceptance Criteria
- [ ] Email addresses with `+` aliases are stored and returned correctly
- [ ] Fix applies to both registration and profile update operations
- [ ] Existing users with incorrectly stored emails are not affected (no migration)

### Technical Details
- `backend-api/src/modules/user/user.service.ts` — review `normalizeEmail()` method, likely strips characters after `+` as part of normalization
- `backend-api/src/modules/user/user.model.ts` — verify email field validation allows `+` in local part
```
