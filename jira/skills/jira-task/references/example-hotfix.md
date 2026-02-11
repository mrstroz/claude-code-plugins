# Example: Hotfix

**User says:** "Production is down — users can't log in for the last 10 minutes, JWT tokens are not being generated"

**Clarification via `AskUserQuestion`:**

```json
{
  "questions": [
    {
      "question": "Does this affect all users or only specific ones?",
      "header": "Impact",
      "options": [
        {"label": "All users", "description": "Nobody can log in — complete authentication failure"},
        {"label": "Some users", "description": "Only certain accounts or regions are affected"}
      ],
      "multiSelect": false
    },
    {
      "question": "Was there a recent deployment or config change?",
      "header": "Trigger",
      "options": [
        {"label": "Recent deploy", "description": "A deployment happened shortly before the issue started"},
        {"label": "No changes", "description": "No known deployments or config changes"},
        {"label": "Not sure", "description": "Needs investigation"}
      ],
      "multiSelect": false
    }
  ]
}
```

**User selects:** "All users" + "Recent deploy"

**Draft:**

```
## [HOTFIX] JWT token generation failure blocking all logins

**Type:** Hotfix
**Subsystem(s):** backend-api

### Description
All users are unable to log in on production. JWT token generation fails during authentication. The issue started after the most recent deployment. Requires immediate rollback or fix.

### Steps to Reproduce
1. Open the application login page (production)
2. Enter valid credentials and submit
3. Login fails — no JWT token is returned in the response
4. API returns 500 or empty token field

### Acceptance Criteria
- [ ] All users can log in successfully on production
- [ ] JWT tokens are generated and returned correctly
- [ ] Root cause identified and documented in post-mortem

### Technical Details
- `backend-api/src/modules/auth/auth.controller.ts` — check `login()` token generation logic
- `backend-api/src/config/auth.config.ts` — verify JWT secret key and expiration config
- Check recent deployment diff for changes to auth-related files
```
