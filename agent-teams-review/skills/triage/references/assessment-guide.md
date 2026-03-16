# Triage Assessment Guide

Detailed criteria for evaluating findings and grouping them into work packages.

## Seven Dimensions of Assessment

### 1. Real Impact

The most important dimension. Ignore the severity label — ask: **what happens to users if we ship this?**

| Real impact | Triage signal |
|-------------|---------------|
| Users lose data, money, or access | Fix Now |
| Users see broken UI or wrong results | Fix Now |
| Users experience slower response under load | Fix Later (unless already slow) |
| Developers have harder time maintaining code | Fix Later |
| Code doesn't follow style guide perfectly | Skip |
| Theoretical vulnerability with no practical exploit path | Skip or Fix Later |

**Key question:** Can you describe a realistic scenario where a real user is harmed by this? If the scenario requires multiple unlikely conditions to align, the real impact is low regardless of the label.

**Watch for reviewer overreach:** Security Sentinel tends to flag theoretical vulnerabilities as Critical. Backend Solidifier tends to elevate performance issues that only matter at 100x current scale. Quality Purist marks naming issues as Medium when they're cosmetic. Triage's job is to ground these assessments in reality.

### 2. Blast Radius

How many users or system flows does this affect?

| Blast radius | Examples |
|-------------|----------|
| **Wide** — most users, most requests | N+1 on a listing page, broken auth middleware, missing CSRF on public form |
| **Narrow** — specific flow, specific role | Admin-only endpoint issue, edge case in export feature, rarely-used settings page |
| **Internal** — developers only | Code quality, naming, missing tests, documentation |

Wide blast radius amplifies real impact. A Medium-severity finding with wide blast radius deserves more attention than a High-severity finding that only affects one admin flow.

### 3. Effort

How long will the fix actually take?

| Effort level | Time | Examples |
|-------------|------|----------|
| **Trivial** | < 5 min | Remove unused import, add constant, rename variable, add type hint |
| **Quick** | 5-15 min | Add database index, wrap in transaction, add input validation |
| **Moderate** | 15 min - 1h | Extract service class, add loading state to component, fix N+1 query |
| **Significant** | 1h+ | Refactor controller architecture, redesign state management, add rate limiting system |

**The quick-win rule:** Trivial and Quick fixes go to Fix Now regardless of severity, because the cost of tracking and scheduling them later exceeds the cost of just doing them. You spend more time writing the JIRA ticket than fixing the code.

**The risk-effort tradeoff:** Significant effort + high regression risk = Fix Later, even if the finding is important. Rushing a big refactor into a feature PR is how bugs get introduced.

### 4. Location

Where is the finding relative to what the PR changed?

| Location | Triage signal |
|----------|---------------|
| **In changed code** — lines the PR modified or added | Higher priority. The PR introduced or touched this, the developer has context, and the diff is already being reviewed. |
| **Adjacent code** — same file but untouched lines | Medium priority. Developer is in the file and has context, but the finding is pre-existing. |
| **Distant code** — different file not touched by PR | Lower priority. The finding is pre-existing. Unless it's a security or data-loss issue, defer to Fix Later or Skip. |

**How to check:** Compare finding file paths and line numbers against `git diff --name-only` output. If the finding's file isn't in the diff, it's distant. If it's in the diff, check whether the specific lines were changed.

### 5. Regression Risk

Could the fix introduce new problems?

| Risk level | Signals | Triage implication |
|-----------|---------|-------------------|
| **Low** | Additive change (adding validation, index, constant). No behavior change for existing paths. | Safe for Fix Now |
| **Medium** | Changes existing behavior but in a contained way (renaming method, extracting class). Has test coverage. | Fix Now if effort is low, Fix Later if effort is high |
| **High** | Changes core flow, touches multiple files, no test coverage, or interacts with external systems. | Fix Later unless the current code is actively dangerous |

**The rule of scope:** If a fix requires touching 3+ files or changing a public API, it should not be squeezed into the current PR unless it's addressing a Critical real-impact issue.

### 6. Dependencies Between Findings

Some findings are connected:

| Dependency type | What to do |
|----------------|------------|
| **A enables B** — fixing A makes B trivial or automatic | Group together in that order. Both go to same triage bucket (use the higher-priority one). |
| **A blocks B** — can't fix B without fixing A first | Group together. If B is Fix Now, A must be Fix Now too. |
| **A and B conflict** — fixing both as described is contradictory | Flag the conflict. Propose which approach to take and why. |
| **A makes B unnecessary** — fixing A resolves B as a side effect | Group together. Note that B is resolved by A. |

**Cross-reviewer dependencies are especially valuable.** When BE-002 (extract service) resolves QA-003 (method too long) as a side effect, grouping them saves duplicate work.

### 7. Nature

The type of issue affects urgency regardless of other factors:

| Nature | Default urgency |
|--------|----------------|
| **Security** — actual exploitable vulnerability | Fix Now (but verify it's actually exploitable, not theoretical) |
| **Data integrity** — data loss, corruption, inconsistent state | Fix Now |
| **Correctness** — wrong results, broken logic | Fix Now |
| **Performance** — slow queries, excessive rendering | Fix Later (unless already causing user-visible lag) |
| **Code quality** — structure, patterns, SOLID principles | Fix Later |
| **Stylistic** — naming, formatting, comment quality | Skip (unless trivial to fix while in the file) |

---

## Smart Grouping Strategies

### 1. Proximity Clustering

**Rule:** Findings in the same file within ~30 lines of each other belong together.

**Why:** The developer will be looking at the same code. Context-switching between files is expensive; fixing two things at line 45 and line 67 in one pass is natural.

**Cross-category pull:** If one finding is Fix Now and a nearby finding would be Fix Later, pull the Fix Later item into Fix Now — the marginal effort of fixing it "while you're already there" is near zero.

**Example:**
```
[SC-001] Missing CSRF — UserController.php:34     → Fix Now (security)
[QA-002] Missing type hint — UserController.php:45 → Would be Skip, but PULLED to Fix Now
> Same file, 11 lines apart. Fix the type hint while you're fixing CSRF.
```

### 2. Domain Clustering

**Rule:** Findings addressing the same logical concern across different files become one coherent task.

**Why:** The developer enters a mental mode ("I'm fixing validation now") and can sweep through all related issues efficiently. Scattering them across the triage makes them feel like separate tasks when they're really one pass.

**Naming:** Give the group a descriptive action name: "Input Validation Pass", "Error Handling Cleanup", "Auth Middleware Hardening".

**Example:**
```
Group: "Input Validation Pass"
- [SC-002] Path traversal in avatar upload — UserProfileService.php:110
- [SC-005] Unvalidated email format — UserRegistrationController.php:45
- [BE-007] Missing type check on settings value — SettingsService.php:78
> All input validation. Same concern, same mental mode.
```

### 3. Pattern Clustering

**Rule:** Identical or near-identical fix types repeated across files become a single checklist task.

**Why:** The fix is mechanical and repetitive. The developer can batch it: open file, apply pattern, next file, repeat. No design thinking needed, just execution.

**Example:**
```
Group: "Add strict_types declarations"
- [QA-001] UserController.php — missing declare(strict_types=1)
- [QA-004] SettingsService.php — missing declare(strict_types=1)
- [QA-006] OrderRepository.php — missing declare(strict_types=1)
- [QA-009] PaymentService.php — missing declare(strict_types=1)
> Mechanical fix, same pattern in every file. Batch in one pass.
```

### 4. Dependency Chaining

**Rule:** When findings have a logical dependency (A enables B, A blocks B, A makes B unnecessary), chain them with a suggested execution order.

**Why:** Without this, the developer might fix B first and then discover that A changes the approach entirely. Or fix A and not realize B is now trivially resolved.

**Format:** Number the chain steps and explain the dependency:
```
Group: "Service Layer Extraction" (dependency chain)
1. [BE-002] Extract order logic to OrderService — OrderController.php:45
2. [BE-004] Add DI for OrderService — after step 1
3. [QA-003] Method too long — RESOLVED by step 1 (extraction splits the method)
> Do in order. Step 3 resolves automatically from step 1.
```

### 5. Effort Bundling

**Rule:** Multiple trivial/quick fixes in the same file become a single "cleanup" task.

**Why:** Three separate "Fix Now" items in the same file feel like three tasks. One "Cleanup UserController.php" task with three bullet points feels like one task. Psychologically and practically, it's better.

**Threshold:** 3+ trivial fixes in the same file = bundle them.

**Example:**
```
Group: "UserController.php cleanup" (3 quick fixes bundled)
- [VM-003] Remove unused ArrayHelper import — line 5
- [QA-005] Rename $d to $data — line 42
- [SC-003] Replace verbose error with generic message — line 70
> All in same file, each under 2 minutes. One pass, done.
```

---

## Resolving Reviewer Conflicts

When two reviewers make contradictory recommendations, the triage must flag the conflict and propose a resolution.

**Common conflicts:**

| Conflict type | Example | Resolution approach |
|--------------|---------|-------------------|
| Abstraction level | VM: "extract to class" vs DV: "premature abstraction" | Consider the actual code — if there's only one use case, DV is probably right. If there are 2+ consumers, VM is right. |
| Error handling | BE: "add error handling" vs VM: "too much boilerplate" | Check if the error case is realistic. If yes, handle it. If it's a theoretical scenario, skip. |
| Performance vs readability | BE: "optimize this query" vs QA: "keep it readable" | Measure or estimate actual impact. If the query runs once per page load for 100 users, readability wins. If it runs in a loop for 10k records, optimize. |

**Format in output:**
```
> Conflict: VM-002 recommends extracting to a class, but DV-001 flags this as
> premature abstraction. Resolution: only one consumer exists — keep inline,
> extract when a second consumer appears.
```
