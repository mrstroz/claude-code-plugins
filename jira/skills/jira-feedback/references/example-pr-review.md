# Example: PR Review

**Source:** `docs/reviews/feature-user-profile-settings-2026-02-28-triage.md`

**Issue:** PROJ-89 — "User profile settings implementation"

**Input:** User provides the triage report path. The triage classified 12 active findings into: Fix Now (3 groups, 6 findings, ~25 min), Fix Later (3 findings), Skip (3 findings). 2 items were in Won't Implement from a previous triage. Verdict: APPROVED WITH COMMENTS.

**Draft:**

```
**Code Review: feature/user-profile-settings** | 2026-02-28 | Verdict: APPROVED WITH COMMENTS
VM, BE, FE, QA, SC | 12 findings | ~25 min

### Fix Now (3 groups, ~25 min)

**1. UserProfileService Cleanup** _(3 findings, proximity)_
- [ ] `[VM-001]` **Debug var_dump in production** — `services/UserProfileService.php:52` — `var_dump($settings)` outputs raw data to browser. Fix: remove or replace with `Yii::debug()`
- [ ] `[QA-001]` **Method doTheUpdate() misleading name** — `services/UserProfileService.php:30` — Fix: rename to `saveProfileSettings()`
- [ ] `[QA-002]` **Magic number 5242880** — `services/UserProfileService.php:95` — Fix: extract to `self::MAX_AVATAR_SIZE`
> Same file, all quick fixes. var_dump is production-visible — fix first, names while you're there.

**2. Database Safety** _(2 findings, dependency)_
- [ ] `[BE-001]` **N+1 query in settings loader** — `models/UserSettings.php:67` — Loads each category in a separate query inside a loop. Fix: single query with `WHERE category IN (...)` + `ArrayHelper::index()`
- [ ] `[BE-002]` **Missing transaction in profile+avatar update** — `services/UserProfileService.php:89` — Avatar failure leaves inconsistent state. Fix: wrap in `beginTransaction()`/`commit()`/`rollBack()`
> Both affect data integrity. Fix N+1 first — the transaction wrapper depends on the refactored query.

**3. Upload Security** _(1 finding)_
- [ ] `[SC-002]` **Avatar upload path traversal** ↔️CROSS _(BE → SC)_ — `services/UserProfileService.php:110` — User-supplied filename used in path without sanitization. Fix: use `basename()` + UUID rename
> Security finding — validated by cross-reviewer analysis. Blocks merge if unaddressed.

### Fix Later (3 findings)
- `[BE-003]` Missing index on user_settings.category — `migrations/m240228_create_user_settings.php`
- `[FE-001]` Missing loading state on save — `components/ProfileForm.vue:45`
- `[DV-001]` Race condition on concurrent profile saves — `services/UserProfileService.php:89`

Skip: 3 findings omitted | Full report: `docs/reviews/feature-user-profile-settings-2026-02-28.md`
```

Notes:
- Triage groups preserved with names, execution order, and grouping reasons (proximity, dependency)
- Fix Now items have full detail including fix suggestions and triage reasoning blockquotes
- Fix Later items are flat one-liners — just enough for awareness
- Skip items collapsed to a count — no need to list what was intentionally excluded
- Won't Implement items (2 from previous triage) omitted entirely
- Cross-reviewer finding `[SC-002]` retains its `↔️CROSS` attribution
- Total effort estimate in header (~25 min) taken from triage output
