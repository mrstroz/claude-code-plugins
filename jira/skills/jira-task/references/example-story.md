# Example: Story

**User says:** "We want users to be able to add notes with attachments to customer profiles — text, maybe files, and show who added it"

**Clarification via `AskUserQuestion`:**

```json
{
  "questions": [
    {
      "question": "Should notes support rich text or plain text only?",
      "header": "Content type",
      "options": [
        {"label": "Plain text + attachments (Recommended)", "description": "Simple text notes with optional file attachments"},
        {"label": "Rich text (WYSIWYG)", "description": "Formatted text with bold, lists, links, etc."}
      ],
      "multiSelect": false
    },
    {
      "question": "Should notes be visible to all users, or only to the note author?",
      "header": "Visibility",
      "options": [
        {"label": "All users (Recommended)", "description": "Any user in the same organization can see all notes on a customer"},
        {"label": "Author only", "description": "Notes are private to the user who created them"},
        {"label": "Configurable", "description": "Each note can be marked as private or shared"}
      ],
      "multiSelect": false
    }
  ]
}
```

**User selects:** "Plain text + attachments" + "All users"

**Draft:**

```
## Customer notes — allow users to add notes with attachments to customer profiles

**Type:** Story
**Subsystem(s):** backend-api, web-app

### Description
As a user, I want to add text notes with optional file attachments to customer profiles, so that I can keep track of interactions and share context with my team. Notes are visible to all users in the same organization.

### Features

**1. Create a note**
- User can add a plain-text note to any customer from the customer detail page
- Optional file attachments (images, PDFs, documents) — max 5 files, 10 MB each
- Author and creation timestamp are saved automatically

**2. Notes list on customer profile**
- All notes for a customer are displayed in reverse chronological order (newest first)
- Each note shows: author name, date, text content, attachment count
- Attachments are downloadable via click

**3. Edit and delete notes**
- Author can edit their own notes (edited flag + timestamp shown)
- Author can delete their own notes (soft delete)
- Other users cannot edit or delete notes they didn't create

**4. API endpoints**
- `POST /customers/{id}/notes` — create note with optional attachments
- `GET /customers/{id}/notes` — list notes for a customer (paginated)
- `PUT /customers/{customerId}/notes/{noteId}` — edit own note
- `DELETE /customers/{customerId}/notes/{noteId}` — soft-delete own note

### Acceptance Criteria
- [ ] User can create, view, edit, and delete notes on a customer profile
- [ ] File attachments upload and download correctly
- [ ] Notes are visible to all users in the same organization
- [ ] Notes list is paginated and sorted newest-first
- [ ] Only the note author can edit or delete their own notes

### Technical Details
- `backend-api/src/modules/customer/` — new `Note` model + `NoteController` in customer module
- `backend-api/src/modules/upload/upload.service.ts` — reuse existing file upload logic for attachments
- `web-app/src/pages/customers/CustomerDetail.tsx` — add notes tab/section to customer detail page
- `web-app/src/hooks/useCustomerNotes.ts` — new hook for notes CRUD
```
