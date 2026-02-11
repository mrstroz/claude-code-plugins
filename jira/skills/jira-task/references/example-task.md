# Example: Task

**User says:** "Add the ability to sort products by date added on the product listing page"

**Clarification via `AskUserQuestion`:**

```json
{
  "questions": [
    {
      "question": "Where should the sort by creation date be available?",
      "header": "Scope",
      "options": [
        {"label": "Main list only (Recommended)", "description": "Sort only on the main /products listing page"},
        {"label": "All product lists", "description": "Also in products shown within categories, collections, and search results"}
      ],
      "multiSelect": false
    },
    {
      "question": "How should the sort option be presented in the UI?",
      "header": "UI placement",
      "options": [
        {"label": "Existing dropdown (Recommended)", "description": "Add alongside current sort options (price, name) in the existing sort dropdown"},
        {"label": "Separate control", "description": "Add a dedicated date sort toggle next to the dropdown"}
      ],
      "multiSelect": false
    }
  ]
}
```

**User selects:** "Main list only" + "Existing dropdown"

**Draft:**

```
## Add sort by creation date on product listing page

**Type:** Task
**Subsystem(s):** backend-api, web-app

### Description
Add the ability to sort products by creation date (newest/oldest first) on the main product listing page. The option should appear alongside existing sort fields (price, name) in the current sort dropdown.

### Acceptance Criteria
- [ ] Product list supports ascending and descending sort by creation date
- [ ] Sort option is available in the existing sort dropdown alongside price and name
- [ ] Default sort order is newest first

### Technical Details
- `backend-api/src/modules/product/product.controller.ts` — add `createdAt` to allowed sort fields in list endpoint
- `web-app/src/pages/products/ProductList.tsx` — add sort option to the existing sort dropdown component
- `web-app/src/hooks/useProducts.ts` — pass sort param to API request
```
