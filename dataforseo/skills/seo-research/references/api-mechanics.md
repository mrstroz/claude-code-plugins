# DataForSEO API v3 — Mechanics

How auth, requests, responses, costs, and locations work. This applies to **every** endpoint, so understanding it once lets you call anything. Docs: https://docs.dataforseo.com/v3/

## Base URLs

- Production: `https://api.dataforseo.com` (paths start with `/v3/...`)
- Sandbox: `https://sandbox.dataforseo.com` — returns **dummy data with identical structure and field names**, and your account is **not charged**. Use it to validate payloads and response shapes before spending. The `dfs.mjs` script exposes this via `--sandbox`.

## Authentication

HTTP **Basic Auth** only — no login call, no session/token.

- Login = your DataForSEO account login (email).
- Password = the **API password** generated in the dashboard at https://app.dataforseo.com/api-access. This is **not** your account password.
- Header: `Authorization: Basic base64("login:password")`. The script builds this from `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`.

## Request shape

Every POST body is a **JSON array of task objects** (even for a single task), and you can batch up to 100 tasks per call:

```json
[
  { "keyword": "example", "location_name": "United States", "language_name": "English" },
  { "keyword": "another",  "location_code": 2840,           "language_code": "en" }
]
```

GET is used only for list/utility endpoints (locations, languages) and `*_get` task retrieval.

## Response envelope

Top-level fields on every response:

| Field | Meaning |
|---|---|
| `version` | API version |
| `status_code` | overall request status — **20000 = Ok** |
| `status_message` | e.g. `"Ok."` |
| `time`, `cost` | processing time; **total USD cost of this call** |
| `tasks_count`, `tasks_error` | number of tasks; number that errored |
| `tasks[]` | array of task objects |

Each object in `tasks[]`: `id`, `status_code`, `status_message`, `cost`, `result_count`, `path`, `data` (your params echoed back), and `result[]`.

**Nesting:** `tasks[] → result[] → items[]`. The `result[]` object carries query metadata + totals (`total_count`, `items_count`); the actual data rows live in `result[].items[]`.

Always check the top-level `status_code` AND each task's `status_code` — the envelope can be `20000` while one task in a batch fails.

## LIVE vs STANDARD (task) methods

| | **Live** (`.../live`) | **Standard / Task** (`task_post` → `task_get`) |
|---|---|---|
| Flow | one call, immediate result | post tasks, poll `tasks_ready`, fetch by `id` |
| Cost | higher | cheaper |
| Latency | instant | seconds–minutes (queued) |
| Best for | interactive research | large/cheap batches; supports `pingback_url`/`postback_url` webhooks and `priority` 1 (normal) / 2 (high) |

**Prefer LIVE for interactive research** — no polling. DataForSEO Labs, Backlinks, and Domain Analytics are Live-only. SERP, Keywords Data, and On-Page offer both.

## Status codes

Success: `20000` Ok · `20100` Task Created (the normal `task_post` per-task status — queued, results not yet ready).

Common errors: `40100` auth failed · `40200` payment required · `40210` insufficient funds · `40202` rate limit (max 2000/min) · `40209` too many simultaneous queries · `40400`/`40401` not found · `40501` invalid field · `40502` empty POST data · `40503` invalid POST data · `50000` internal error · `50401` internal timeout. Server errors are `50000`-series.

## Cost

Cost is reported per call (top-level `cost`) and per task (`tasks[].cost`) in USD — read it straight from the response; there's no separate billing call. `dfs.mjs` prints it to stderr after each call. Report it back to the user. Live endpoints cost more than task-based; enabling `include_clickstream_data` (Labs) roughly doubles cost; SERP `live/advanced` costs more than `live/regular`.

## Rate limits

2000 API calls/minute (else `40202`); max 100 tasks per POST (else `40006`); a simultaneous-query cap (`40209`). Identical-task throttles cap duplicate tasks per hour/day.

## Locations & languages

Most endpoints need a location and language, given as either name or code:
- Location: `location_name` (e.g. `"United States"`) or `location_code` (e.g. `2840`)
- Language: `language_name` (e.g. `"English"`) or `language_code` (e.g. `"en"`)

Each API namespace has its own list endpoint (GET). Examples:
- DataForSEO Labs: `GET /v3/dataforseo_labs/locations_and_languages`
- SERP (Google): `GET /v3/serp/google/locations`, `GET /v3/serp/google/languages`
- Keywords Data (Google Ads): `GET /v3/keywords_data/google_ads/locations`, `.../languages`

List-endpoint items include `location_code`, `location_name`, `country_iso_code`, `location_type`, and `available_languages[]`. Russia and Belarus locations are no longer supported.

## Reading big responses efficiently

Responses can be hundreds of KB (e.g. 1000 ranked keywords with deep nesting). The script always saves the full JSON to a file; pull only the fields you need with `jq` rather than reading the whole file into context:

```bash
# top organic keywords a domain ranks for: keyword + position + volume
jq -r '.tasks[0].result[0].items[]
        | [.keyword_data.keyword,
           .ranked_serp_element.serp_item.rank_absolute,
           .keyword_data.keyword_info.search_volume] | @tsv' OUTPUT.json | head -50
```

If `jq` is unavailable, use a short `node -e` snippet, or `Read` the file with a small `limit`. Use `--preview N` on the script for a quick look at the first N items' shape.
