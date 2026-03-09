# Acme App Testing Scenarios — Version 2.4.0
**Version:** 2.4.0 | **Branches:** quality vs master | **Generated:** 2026-03-09

## Summary
8 tasks to test | 34 files changed | 2 uncovered changes

## Testing Scenarios

| Task | Testing Scenario |
|------|-----------------|
| [ACME-301](https://acme.atlassian.net/browse/ACME-301) | **Bulk order import via CSV** |
| Story · High · In Progress | Verify that CSV upload processes all rows correctly. • Check validation errors for missing required fields and duplicate entries. • Test with large files (500+ rows) to confirm no timeout. |
| [ACME-302](https://acme.atlassian.net/browse/ACME-302) | **Date range filter on orders page** |
| Story · Medium · In Progress | Confirm the new date range picker returns correct results for all ranges. • Check edge cases: empty range, future dates, same start/end date. • Verify existing saved filters still work. |
| [ACME-305](https://acme.atlassian.net/browse/ACME-305) | **Customer dashboard redesign** |
| Story · High · Done | Check that all dashboard widgets load correctly with the new layout. • Verify responsive behavior on mobile and tablet viewports. • Confirm that widget position preferences persist across sessions. |
| [ACME-310](https://acme.atlassian.net/browse/ACME-310) | **Payment retry mechanism** |
| Feature · High · In Review | Verify that failed payments trigger an automatic retry after 30 seconds. • Confirm the user sees a clear status message during retry. • Test with multiple payment methods to ensure retry works for all. |
| [ACME-312](https://acme.atlassian.net/browse/ACME-312) | **Fix: checkout fails with discount codes** |
| Bug · Critical · Done | Confirm that checkout completes successfully with both percentage and fixed-amount discount codes. • Test applying and removing codes multiple times. • Verify the order total recalculates correctly. |
| [ACME-315](https://acme.atlassian.net/browse/ACME-315) | **Email notification templates update** |
| Task · Medium · Done | Verify that all transactional emails (order confirmation, shipping, password reset) render correctly. • Check that dynamic fields (name, order number) populate. • Test in multiple email clients if possible. |
| [ACME-318](https://acme.atlassian.net/browse/ACME-318) | **API rate limiting for public endpoints** |
| Story · High · In Review | Confirm that public API endpoints return 429 status after exceeding the rate limit. • Verify that authenticated endpoints are not affected. • Check that rate limit headers are present in responses. |
| [ACME-320](https://acme.atlassian.net/browse/ACME-320) | **Fix: product images not loading on slow connections** |
| Bug · Major · Done | Verify that product images load with lazy loading on the catalog page. • Check that placeholder images display while loading. • Test on throttled connection (3G simulation). |

## High Risk Areas
- **Frontend / UI** — 14 files changed across dashboard and order components. Pay extra attention to layout consistency and responsive behavior after the dashboard redesign.
- **API** — rate limiting added to 4 endpoint files. Verify that existing integrations are not broken by the new limits.

## Uncovered Changes
- **Configuration** — `docker-compose.yml` and `.env.example` updated with new Redis configuration. Verify that the deployment environment has the required Redis settings.
- **Tests** — 6 new test files added. No manual testing needed, but confirms that the above features have automated coverage.
