# Task Output Examples

## Complete Feature/Story Example

```markdown
**Title:** [Feature] Add OAuth2 authentication to login system

**Description:**

## Goal

Implement OAuth2 authentication to improve security and enable single sign-on capabilities for enterprise customers, reducing friction in the login process.

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

## Bug Task Example

```markdown
**Title:** Fix PDF export failing intermittently

**Description:**

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

## Simple Task Example

```markdown
**Title:** Update documentation for API v2 endpoints

**Description:**

## Goal

Update API docs to reflect v2 changes and improve developer onboarding.

## Acceptance Criteria

- [ ] All v2 endpoints documented with examples
- [ ] Authentication section updated
- [ ] Code examples in JavaScript and Python
```

## Epic Example

```markdown
**Title:** User Authentication System

**Description:**

## Goal

Build a comprehensive authentication system supporting multiple providers and enterprise SSO requirements.

## Acceptance Criteria

- [ ] Support for email/password, Google, and Microsoft authentication
- [ ] Session management with configurable timeouts
- [ ] Role-based access control (RBAC) integrated
- [ ] Audit logging for all authentication events
- [ ] Enterprise SSO (SAML 2.0) support

## Related Issues

- Story: Add OAuth2 authentication to login system
- Story: Implement SAML 2.0 integration
- Task: Set up authentication audit logging
- Task: Configure RBAC permissions system
```

## Subtask Example

```markdown
**Title:** OAuth2 - Add frontend integration

**Description:**

## Goal

Integrate OAuth2 login button and flow into the existing login form UI.

## Acceptance Criteria

- [ ] "Sign in with Google" button displays on login page
- [ ] Button triggers OAuth2 redirect flow
- [ ] Loading state shows during authentication
- [ ] Error states handled gracefully

## Technical Details / Implementation Hints

- Modify `LoginForm.tsx` component
- Use existing `Button` component with Google icon from `assets/icons`
- Follow existing error handling pattern in `useAuth` hook
```
