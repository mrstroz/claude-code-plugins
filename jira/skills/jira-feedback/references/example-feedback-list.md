# Example: Feedback List

**Issue:** PROJ-89 — "Implement CSV export for monthly reports"

**User input:** "ok so I went through the export feature and um there are a few things, first the big one is that the date columns are not formatted correctly, they come out as like unix timestamps instead of human readable dates which is kind of a blocker, also the CSV doesn't include the report title in the filename it's just like export.csv which makes it hard to find later, um what else, oh yeah the column headers are using the internal field names like created_at instead of the display names we show in the UI, and uh the export takes about 20 seconds for a monthly report which seems slow but I'm not sure if that's expected, and one more thing the decimal numbers use dots but our users expect commas for the decimal separator"

**Draft:**

```
Reviewed the CSV export for monthly reports. Here is the feedback:

- Date columns export as Unix timestamps instead of human-readable dates — this is a blocker for end users
- Decimal numbers use dot separators instead of commas — needs to follow the locale format our users expect
- Column headers use internal field names (e.g., `created_at`) instead of the display names shown in the UI
- Export filename is generic `export.csv` — should include the report title for easier identification
- Export takes ~20 seconds for a monthly report — worth checking if this is within expected range
```
