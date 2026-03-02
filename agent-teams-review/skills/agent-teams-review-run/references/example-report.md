# Agent Teams Code Review

**PR:** feature/user-profile-settings
**Date:** 2026-02-28
**Team:** Virtual Mariusz, Backend Solidifier, Frontend Virtuoso, Quality Purist, Security Sentinel

---

## Verdict & Score

**Verdict:** :large_orange_diamond: Changes Requested
**Risk:** :orange_circle: High
**AI Slop:** 6/10 — Light Slop

| | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| VMR | 0 | 1 | 1 | 1 | 3 |
| BCK | 0 | 2 | 1 | 1 | 4 |
| FRO | 0 | 0 | 1 | 1 | 2 |
| QAL | 0 | 0 | 2 | 1 | 3 |
| SEC | 0 | 1 | 1 | 0 | 2 |
| EDG | 0 | 0 | 0 | 0 | 0 |
| **Sum** | **0** | **4** | **6** | **4** | **14** |

---

## What You Need To Do

### :red_circle: Before Merge — Required

- [ ] `[SEC-001]` **Missing rate limiting on profile update** `High` — `controllers/UserProfileController.php:34` _(Security Sentinel)_
- [ ] `[BCK-001]` **N+1 query in settings loader** `High` — `models/UserSettings.php:67` _(Backend Solidifier)_
- [ ] `[BCK-002]` **Missing transaction in profile+avatar update** `High` — `services/UserProfileService.php:89` _(Backend Solidifier)_
- [ ] `[VMR-001]` **Debug var_dump left in production code** `High` — `services/UserProfileService.php:52` _(Virtual Mariusz)_

### :orange_circle: Before Merge — Recommended

- [ ] `[SEC-002]` **Avatar file upload path traversal** `Medium` ↔️CROSS _(flagged by BCK, investigated by SEC)_ — `services/UserProfileService.php:110`
- [ ] `[BCK-003]` **Missing index on user_settings.category** `Medium` — `migrations/m240228_create_user_settings.php` _(Backend Solidifier)_
- [ ] `[QAL-001]` **Method doTheUpdate() — misleading name** `Medium` — `services/UserProfileService.php:30` _(Quality Purist)_
- [ ] `[QAL-002]` **Magic number 5242880 without constant** `Medium` — `services/UserProfileService.php:95` _(Quality Purist)_
- [ ] `[VMR-002]` **SettingsFormatterInterface has single impl** `Medium` — `interfaces/SettingsFormatterInterface.php` _(Virtual Mariusz)_
- [ ] `[FRO-001]` **Missing loading state on save button** `Medium` — `components/ProfileForm.vue:45` _(Frontend Virtuoso)_

### :yellow_circle: Post-Merge — Optional

- [ ] `[SEC-003]` **Verbose error messages expose stack trace** `Medium` — `controllers/UserProfileController.php:70` _(Security Sentinel)_
- [ ] `[VMR-003]` **Unused import ArrayHelper** `Low` — `controllers/UserProfileController.php:5` _(Virtual Mariusz)_
- [ ] `[BCK-004]` **Migration down() method is empty** `Low` — `migrations/m240228_create_user_settings.php:35` _(Backend Solidifier)_
- [ ] `[FRO-002]` **Avatar preview missing alt text** `Low` — `components/AvatarUpload.vue:12` _(Frontend Virtuoso)_
- [ ] `[QAL-003]` **Inconsistent method visibility order** `Low` — `services/UserProfileService.php` _(Quality Purist)_

---

## Why — Findings By File

### `controllers/UserProfileController.php`

#### [SEC-001] Missing Rate Limiting on Profile Update `High`
_Security Sentinel_

Profile update endpoint has no rate limiting. An attacker can flood the server with update requests, potentially causing DoS or enabling brute-force attacks on profile fields.

**Current:**
```php
public function actionUpdate()
{
    // No rate limiting — accepts unlimited requests
    $model = $this->findModel(Yii::$app->user->id);
    $model->load(Yii::$app->request->post());
    $model->save();
}
```

**Fix:**
```php
public function behaviors()
{
    return array_merge(parent::behaviors(), [
        'rateLimiter' => [
            'class' => RateLimiter::class,
            'maxRequests' => 10,
            'perSeconds' => 60,
        ],
    ]);
}
```

---

#### [SEC-003] Verbose Error Messages Expose Stack Trace `Medium`
_Security Sentinel_ — Error response at line 70 returns full exception message including internal paths. Replace with generic error in production.

#### [VMR-003] Unused Import ArrayHelper `Low`
_Virtual Mariusz_ — `use yii\helpers\ArrayHelper` imported but never used. Remove.

---

### `models/UserSettings.php`

#### [BCK-001] N+1 Query in Settings Loader `High`
_Backend Solidifier_

`getUserSettings()` loads each setting category in a separate query inside a loop. For 5 categories = 5 queries instead of 1.

**Current:**
```php
foreach ($categories as $category) {
    $settings[] = UserSetting::find()
        ->where(['user_id' => $userId, 'category' => $category])
        ->all();
}
```

**Fix:**
```php
$settings = UserSetting::find()
    ->where(['user_id' => $userId, 'category' => $categories])
    ->all();
$grouped = ArrayHelper::index($settings, null, 'category');
```

---

### `services/UserProfileService.php`

#### [BCK-002] Missing Transaction in Profile + Avatar Update `High`
_Backend Solidifier_

Profile data and avatar are saved in separate operations without a transaction. If avatar save fails, profile is updated but avatar is stale — inconsistent state.

**Current:**
```php
$user->save(false);
$this->saveAvatar($user, $avatarFile);
```

**Fix:**
```php
$transaction = Yii::$app->db->beginTransaction();
try {
    $user->save(false);
    $this->saveAvatar($user, $avatarFile);
    $transaction->commit();
} catch (\Throwable $e) {
    $transaction->rollBack();
    throw $e;
}
```

---

#### [VMR-001] Debug var_dump Left in Production Code `High`
_Virtual Mariusz_

`var_dump($settings)` at line 52 will output raw data to the browser in non-CLI context.

**Fix:** Remove entirely. If logging is needed, use `Yii::debug($settings, __METHOD__)`.

---

#### [SEC-002] Avatar File Upload Path Traversal `Medium` ↔️CROSS
_Flagged by Backend Solidifier → Investigated by Security Sentinel_

Backend Solidifier noticed the avatar save uses the original filename. Security Sentinel confirmed: the filename is not sanitized, allowing path traversal (e.g., `../../etc/passwd`).

**Fix:**
```php
$filename = Yii::$app->security->generateRandomString(16) . '.' . $file->extension;
```

---

#### [QAL-001] Method doTheUpdate() — Misleading Name `Medium`
_Quality Purist_ — Method name is vague and informal. Rename to `updateProfile()` to match convention.

#### [QAL-002] Magic Number 5242880 `Medium`
_Quality Purist_ — `5242880` should be `self::MAX_AVATAR_SIZE_BYTES` constant. Magic numbers violate readability.

#### [QAL-003] Inconsistent Method Visibility Order `Low`
_Quality Purist_ — Public methods should come before protected, then private. Currently mixed.

---

### `interfaces/SettingsFormatterInterface.php`

#### [VMR-002] Single Implementation Interface `Medium`
_Virtual Mariusz_ — `SettingsFormatterInterface` has only `JsonSettingsFormatter`. No foreseeable need for alternatives. YAGNI — remove interface, use concrete class directly.

---

### `migrations/m240228_create_user_settings.php`

#### [BCK-003] Missing Index on category Column `Medium`
_Backend Solidifier_ — `user_settings.category` is used in WHERE clauses but has no index. Add composite index on `(user_id, category)`.

#### [BCK-004] Empty down() Method `Low`
_Backend Solidifier_ — Migration is not reversible. Add `$this->dropTable('user_settings')` to `down()`.

---

### `components/ProfileForm.vue`

#### [FRO-001] Missing Loading State on Save `Medium`
_Frontend Virtuoso_ — Save button has no loading/disabled state during API call. User can double-submit.

---

### `components/AvatarUpload.vue`

#### [FRO-002] Missing Alt Text `Low`
_Frontend Virtuoso_ — Avatar preview `<img>` has no `alt` attribute. Accessibility issue.

---

## AI Slop Report

**Overall Score:** 6/10

| Category | Score | Notes |
|----------|-------|-------|
| Unnecessary Abstractions | 7/10 | Minor: SettingsFormatterInterface with single implementation |
| Boilerplate Bloat | 5/10 | Excessive null checks in UserProfileService where types guarantee non-null |
| Comment Slop | 5/10 | Multiple "get the user" / "save the settings" restating-the-obvious comments |
| Premature Generalization | 7/10 | Settings provider pattern is reasonable for future extension |
| Copy-Paste Artifacts | 8/10 | Clean, no copy-paste issues detected |

**Verdict:** Light Slop

Notable examples:
- `UserProfileService.php:45` — `// Get the user` above `$user = User::findOne($id)`. Remove.
- `UserProfileService.php:78-82` — Four consecutive null checks on typed properties that cannot be null.

---

## Reviewer Verdicts

| Reviewer | Verdict | Issues | Summary |
|----------|---------|--------|---------|
| Virtual Mariusz | :large_orange_diamond: | 3 | Debug code left in, AI Slop w service layer (6/10), unnecessary interface |
| Backend Solidifier | :large_orange_diamond: | 4 | N+1 query i brak transakcji — musi być naprawione |
| Frontend Virtuoso | :white_check_mark: | 2 | Drobne UX issues, ogólnie dobrze napisane komponenty |
| Quality Purist | :warning: | 3 | Naming violations i magic numbers, ale struktura OK |
| Security Sentinel | :large_orange_diamond: | 3 | Rate limiting i path traversal — realne zagrożenia |

---

## What's Good

- :white_check_mark: Czysta separacja controller/service/model — architektura warstwowa dobrze zaimplementowana
- :white_check_mark: Composition API i poprawne typowanie TypeScript w komponentach Vue
- :white_check_mark: Konsekwentne użycie ActiveRecord patterns i Yii2 validation rules
- :white_check_mark: Dobrze zorganizowana struktura plików zgodna z konwencjami projektu
- :white_check_mark: Unit testy pokrywają główny flow aktualizacji profilu
