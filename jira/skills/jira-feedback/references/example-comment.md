# Example: Comment

**Issue:** TES-1234 — "API regression: /orders endpoint returns 500 for filtered queries"

**Existing comment on the issue:** "Can anyone confirm if this also reproduces on the staging environment?"

**User input:** "yeah so um I checked staging today and basically it does happen there too, like the same 500 error when you use the date range filter, you know the one with start date and end date params, and uh I also noticed that it works fine if you only pass one of them, like just start date or just end date, so it seems like it's specifically the combination of both filters that breaks it"

**Draft:**

```
Confirmed — the same 500 error happens on staging too. It happens when the date range filter uses both `startDate` and `endDate` at the same time.

If we pass only one of them, it works fine. So the problem is the two date filters together in one request.
```
