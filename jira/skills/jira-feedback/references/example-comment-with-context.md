# Example: Comment with Thread Context

**Issue:** TES-1234 — "API regression: /orders endpoint returns 500 for filtered queries"

**Existing comments on the issue (last 3):**

1. (Maria, 2 days ago): "The 500 error started appearing after the v2.3 deploy. I think it's related to the new date range validation in OrderQueryService."

2. (Piotr, 1 day ago): "I checked OrderQueryService — the validation looks correct. The issue might be in the SQL builder. The WHERE clause uses `BETWEEN` but the params are passed as strings, not DateTime objects."

3. (Anna, 2h ago): "Can anyone confirm if this also reproduces on staging? And does it happen with all filter combinations or just the date range?"

**User input:** "yeah I checked staging and it does happen there too, same 500 when you use both start and end date, works fine with just one of them"

**Thread context note (shown to user in Step 5):**

> **Thread context:** Technical discussion about OrderQueryService date range handling. Anna's last comment (2h ago) asks two specific questions: staging reproduction and which filter combinations trigger the error. Draft framed as direct answers to both questions, using thread terminology.

**Draft:**

```
Confirmed on staging — same 500 error with the date range filter. It triggers when both `startDate` and `endDate` are passed together. Using either parameter alone works fine, so the issue is specifically the combination.

This aligns with Piotr's theory about the `BETWEEN` clause in the SQL builder — the paired parameters are likely where the string-vs-DateTime mismatch causes the failure.
```

Compare with [example-comment.md](example-comment.md) — same user input, but the thread-aware version directly answers Anna's two questions and references Piotr's SQL builder analysis rather than being a standalone observation.
