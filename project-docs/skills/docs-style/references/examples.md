# Worked examples

Four document types, each shown as it should look. Where a failure mode is common, the bad version comes first so the difference is visible rather than described.

The examples use a fictional project: a webhook worker that receives Stripe events and stores them in a database. Task prefix `WH`.

## Contents

1. [A complete ADR](#1-a-complete-adr)
2. [A spec section opening — bad and good](#2-a-spec-section-opening)
3. [A milestone file](#3-a-milestone-file)
4. [The roadmap "State today" — bad and good](#4-the-roadmap-state-today)

---

## 1. A complete ADR

62 lines, inside the 40–80 budget. Every claim in Context points at a file. Options considered is a table, not prose. "When to revisit" states a condition, not a date.

```markdown
# ADR-0003: Reject duplicate events by `event.id`, not by payload hash

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-03-14 |
| **Applies to** | webhook ingestion |

## Context

Stripe retries a webhook until it gets a 2xx, with no upper bound on attempts
within 3 days. Our handler writes to two tables (`payments`, `audit_log`), so a
retry after a partial write leaves a payment row without its audit row
(`src/handlers/webhook.ts:41-58`).

Retries are not rare. In the 2026-03-01 to 2026-03-13 logs, 4.1% of deliveries
were retries, and 11 of them arrived after the first attempt had already
committed to `payments`.

Stripe guarantees `event.id` is stable across retries of the same event and
unique across events. It does not guarantee the payload is byte-identical:
`request.idempotency_key` and expanded objects can differ between attempts.

## Decision

Deduplicate on `event.id`, stored with a unique constraint. A second delivery
of a known id is acknowledged with 200 and does nothing else.

## Consequences

**Positive**

- The two-table write becomes safe without a distributed transaction.
- The check is one indexed lookup, so it costs nothing on the hot path.
- Replaying a webhook by hand is safe, which makes incident recovery cheaper.

**Negative**

- The id table grows without bound. It needs a retention job; 90 days is
  enough, since Stripe stops retrying after 3.
- A genuinely re-sent event — the same id deliberately replayed after a bug
  fix — is silently swallowed. Forcing a reprocess means deleting the row first.

**Requirements**

- A unique index on `processed_events.event_id` before this ships.
- A retention job, tracked as WH-19.

## Options considered

| Option | Why rejected |
|---|---|
| Hash of the full payload | Payloads differ between retries of the same event, so retries would slip through |
| Idempotency key from the `Idempotency-Key` header | Stripe does not send one on webhooks; the field exists only on API requests |
| Database transaction across both tables | The audit write goes to a different store, so no single transaction covers both |
| No deduplication, make handlers idempotent individually | Every future handler has to get it right; one that does not fails silently |

## When to revisit

- If a second event source is added whose retry ids are not globally unique.
  The unique constraint would then need a source column.
- If the id table's retention job proves unreliable and the table grows past
  what the index fits in memory.
```

### The same ADR done badly

Recognisable failures, all of them common:

```markdown
## Kontekst biznesowy

W dzisiejszych czasach niezawodność systemów płatniczych jest kluczowym
elementem budowania zaufania użytkowników. Warto zauważyć, że webhooki
stanowią fundament nowoczesnej integracji.        ← warm-up, judging adjectives, zero facts

Stripe prawdopodobnie ponawia webhooki kilka razy.  ← unverified claim

## Decyzja

Zdecydowaliśmy się — po analizie dostępnych opcji — na deduplikację, która
jest szybka, prosta i skuteczna.                    ← dash as glue, rule of three, says nothing

## Konsekwencje

Rozwiązanie przyniesie wiele korzyści dla zespołu i pozwoli nam skalować
system w przyszłości.                               ← no positive/negative split, unfalsifiable

## Podsumowanie

Podsumowując, deduplikacja po event.id to dobry wybór.  ← closing summary of what was just read
```

---

## 2. A spec section opening

**Bad** — three sentences that could be deleted with no loss:

```markdown
## 4. Ingestion

This section aims to comprehensively describe the ingestion process, which is
a key component of the system. Below we will discuss the endpoint, its
validation and its error handling. Understanding this section is important
before reading the following ones.
```

**Good** — starts at the first sentence that says something, and the constraint that drives everything else is stated once, up front:

```markdown
## 4. Ingestion

One endpoint, `POST /webhook`. It answers 200 to everything it can parse and
2xx to everything it cannot, because Stripe treats any non-2xx as a failed
delivery and retries (see [ADR-0003](../adr/0003-reject-duplicates-by-event-id.md)).
A validation error is therefore logged, not returned.
```

---

## 3. A milestone file

Note what is *not* here: no explanation of how deduplication works. That lives in the spec, and the tasks link to it.

```markdown
# M1. Ingestion

**Goal:** events arrive, survive retries and land in both tables.

**End of milestone:** a replayed webhook from the Stripe CLI is stored once,
and the audit row always exists when the payment row does.

**External dependencies:** the webhook signing secret in the deploy environment,
tracked as INFRA-2 in [06 §1](../spec/06-dependencies.md#1-status).

## Tasks

- [x] (^) **WH-08** `POST /webhook`: signature check, parse, always 2xx
      Spec: [04 §1](../spec/04-ingestion.md#1-the-endpoint) · Depends on: WH-03
      Done when: an unparseable body answers 200, not 400
      **Done 2026-03-12.** The signature check runs before the parse, because a
      forged body should never reach the parser.

- [x] (=) **WH-09** Deduplicate on `event.id`
      Spec: [04 §3](../spec/04-ingestion.md#3-duplicates) · ADR: [0003](../adr/0003-reject-duplicates-by-event-id.md) · Depends on: WH-08
      Done when: the same event delivered twice writes one payments row

- [ ] (=) **WH-10** Audit row written in the same commit as the payment row
      Spec: [04 §4](../spec/04-ingestion.md#4-the-two-table-write) · Depends on: WH-09

- [ ] (v) **WH-19** Retention job for `processed_events`
      Spec: [04 §3](../spec/04-ingestion.md#3-duplicates) · Depends on: WH-09
      Done when: rows older than 90 days are gone after one scheduled run

- [-] (=) **WH-21** ~~Replay endpoint for failed events~~
      **Rejected 2026-03-14.** Stripe replays from its own dashboard, so this
      only added a second way to produce duplicates.

## Notes

WH-10 came out of WH-09 rather than being planned: the unique constraint made
the ordering of the two writes matter, which it had not before.
```

Only WH-08 is `(^)`, although WH-09 and WH-10 are both named in the end-of-milestone line. That is the distinction the marker carries: all three are necessary, but the endpoint is what the other two wait on. Marking all three would have sorted nothing.

WH-21 keeps its number and its priority token after rejection, and the reason is mandatory — a struck-through line with no explanation invites the next reader to put it back.

---

## 4. The roadmap "State today"

**Bad** — the failure mode that kills this system fastest. Each session appended and nobody pruned:

```markdown
| **Last completed** | WH-09 on 2026-03-13: deduplication landed, using a unique
index rather than a check-then-insert, because the check-then-insert raced under
concurrent delivery and we measured it at 3 collisions in 10k. Before it, WH-08
the same day: the endpoint exists and answers 2xx, verified against the Stripe
CLI as well as the test suite; the signature check runs first because... Before
it, WH-03 on 2026-03-11: the schema... Before it, WH-02... |
```

Within a week this cell is the longest thing in the repository, and the one place everyone was told to start becomes the one place nobody reads.

**Good** — replaced each time, one task, the detail living on the task itself:

```markdown
## State today

| Field | Value |
|---|---|
| **Milestone** | M1. Ingestion — 2 of 4, 1 rejected. M0 closed 2026-03-11 |
| **Last completed** | [WH-09](02-ingestion.md) deduplication on `event.id`, unique index rather than check-then-insert ([ADR-0003](../adr/0003-reject-duplicates-by-event-id.md)) |
| **Next** | [WH-10](02-ingestion.md) the two-table write. WH-19 is unblocked and can go in parallel |

This table is replaced by whoever finishes a task. It is the only place anyone
needs to look at the start of a session.
```
