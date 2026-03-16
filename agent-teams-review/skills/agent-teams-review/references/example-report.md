# Agent Teams Code Review

**PR:** feature/user-profile-settings
**Date:** 2026-02-28
**Team:** Virtual Mariusz, Backend Solidifier, Frontend Virtuoso, Quality Purist, Security Sentinel

**Verdict:** CHANGES REQUESTED
**AI Slop:** 6/10 — Light Slop

| | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| VM | 0 | 1 | 1 | 1 | 3 |
| BE | 0 | 2 | 1 | 1 | 4 |
| FE | 0 | 0 | 1 | 1 | 2 |
| QA | 0 | 0 | 2 | 1 | 3 |
| SC | 0 | 1 | 1 | 0 | 2 |
| **Sum** | **0** | **4** | **6** | **4** | **14** |

---

## Action Items

### Critical

(none)

### High (4)

- [ ] `[SC-001]` **Missing rate limiting on profile update** — `controllers/UserProfileController.php:34` _(Security Sentinel)_
- [ ] `[BE-001]` **N+1 query in settings loader** — `models/UserSettings.php:67` _(Backend Solidifier)_
- [ ] `[BE-002]` **Missing transaction in profile+avatar update** — `services/UserProfileService.php:89` _(Backend Solidifier)_
- [ ] `[VM-001]` **Debug var_dump left in production code** — `services/UserProfileService.php:52` _(Virtual Mariusz)_

### Medium (6)

- [ ] `[SC-002]` **Avatar file upload path traversal** CROSS _(flagged by BE -> SC)_ — `services/UserProfileService.php:110`
- [ ] `[BE-003]` **Missing index on user_settings.category** — `migrations/m240228_create_user_settings.php` _(Backend Solidifier)_
- [ ] `[QA-001]` **Method doTheUpdate() — misleading name** — `services/UserProfileService.php:30` _(Quality Purist)_
- [ ] `[QA-002]` **Magic number 5242880 without constant** — `services/UserProfileService.php:95` _(Quality Purist)_
- [ ] `[VM-002]` **SettingsFormatterInterface has single impl** — `interfaces/SettingsFormatterInterface.php` _(Virtual Mariusz)_
- [ ] `[FE-001]` **Missing loading state on save button** — `components/ProfileForm.vue:45` _(Frontend Virtuoso)_

### Low (4)

- [ ] `[SC-003]` **Verbose error messages expose stack trace** — `controllers/UserProfileController.php:70` _(Security Sentinel)_
- [ ] `[VM-003]` **Unused import ArrayHelper** — `controllers/UserProfileController.php:5` _(Virtual Mariusz)_
- [ ] `[BE-004]` **Migration down() method is empty** — `migrations/m240228_create_user_settings.php:35` _(Backend Solidifier)_
- [ ] `[FE-002]` **Avatar preview missing alt text** — `components/AvatarUpload.vue:12` _(Frontend Virtuoso)_
- [ ] `[QA-003]` **Inconsistent method visibility order** — `services/UserProfileService.php` _(Quality Purist)_

---

## Findings

### Critical

(none)

### High

#### `controllers/UserProfileController.php`

##### [SC-001] Missing Rate Limiting on Profile Update
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

#### `models/UserSettings.php`

##### [BE-001] N+1 Query in Settings Loader
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

#### `services/UserProfileService.php`

##### [BE-002] Missing Transaction in Profile + Avatar Update
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

##### [VM-001] Debug var_dump Left in Production Code
_Virtual Mariusz_

`var_dump($settings)` at line 52 will output raw data to the browser in non-CLI context.

**Fix:** Remove entirely. If logging is needed, use `Yii::debug($settings, __METHOD__)`.

### Medium

#### `services/UserProfileService.php`

##### [SC-002] Avatar File Upload Path Traversal — CROSS
_Flagged by Backend Solidifier -> Investigated by Security Sentinel_

Backend Solidifier noticed the avatar save uses the original filename. Security Sentinel confirmed: the filename is not sanitized, allowing path traversal (e.g., `../../etc/passwd`).

**Fix:**
```php
$filename = Yii::$app->security->generateRandomString(16) . '.' . $file->extension;
```

##### [QA-001] Method doTheUpdate() — Misleading Name
_Quality Purist_ — Method name is vague and informal. Rename to `updateProfile()` to match convention.

##### [QA-002] Magic Number 5242880
_Quality Purist_ — `5242880` should be `self::MAX_AVATAR_SIZE_BYTES` constant. Magic numbers violate readability.

#### `interfaces/SettingsFormatterInterface.php`

##### [VM-002] Single Implementation Interface
_Virtual Mariusz_ — `SettingsFormatterInterface` has only `JsonSettingsFormatter`. No foreseeable need for alternatives. YAGNI — remove interface, use concrete class directly.

#### `migrations/m240228_create_user_settings.php`

##### [BE-003] Missing Index on category Column
_Backend Solidifier_ — `user_settings.category` is used in WHERE clauses but has no index. Add composite index on `(user_id, category)`.

#### `components/ProfileForm.vue`

##### [FE-001] Missing Loading State on Save
_Frontend Virtuoso_ — Save button has no loading/disabled state during API call. User can double-submit.

### Low

#### `controllers/UserProfileController.php`

##### [SC-003] Verbose Error Messages Expose Stack Trace
_Security Sentinel_ — Error response at line 70 returns full exception message including internal paths. Replace with generic error in production.

##### [VM-003] Unused Import ArrayHelper
_Virtual Mariusz_ — `use yii\helpers\ArrayHelper` imported but never used. Remove.

#### `migrations/m240228_create_user_settings.php`

##### [BE-004] Empty down() Method
_Backend Solidifier_ — Migration is not reversible. Add `$this->dropTable('user_settings')` to `down()`.

#### `components/AvatarUpload.vue`

##### [FE-002] Missing Alt Text
_Frontend Virtuoso_ — Avatar preview `<img>` has no `alt` attribute. Accessibility issue.

#### `services/UserProfileService.php`

##### [QA-003] Inconsistent Method Visibility Order
_Quality Purist_ — Public methods should come before protected, then private. Currently mixed.

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

## What's Good

- Clean controller/service/model separation — layered architecture well implemented
- Composition API and correct TypeScript typing in Vue components
- Consistent use of ActiveRecord patterns and Yii2 validation rules
- Well-organized file structure following project conventions
- Unit tests cover the main profile update flow
