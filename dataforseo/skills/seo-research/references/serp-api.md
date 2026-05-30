# DataForSEO SERP API

The SERP API returns **live actual search results** (real-time scraping) for Google/Bing/Yahoo/YouTube and others, depersonalized and tailored to keyword + location + language. Use it for rank checking and analyzing SERP features. Docs: https://docs.dataforseo.com/v3/serp/overview/

Body is a JSON array of task objects (≤100 tasks/POST).

---

## Live Advanced — `POST /v3/serp/google/organic/live/advanced`
- **Answers:** the complete SERP — all organic/paid results **plus every SERP feature** (featured snippet, PAA, knowledge graph, local pack, video, images, AI overview, …), with positions. Highest cost, lowest latency.
- **Key params:** `keyword` **(REQUIRED, ≤700 chars)**, `location_code`/`location_name`, `language_code`/`language_name`, `device` (`desktop`/`mobile`), `os`, `depth` (default 10, max 200 — cost rises with depth), `se_domain` (e.g. `google.co.uk`), `people_also_ask_click_depth` (1–4), `calculate_rectangles`, `target` (filter to a domain), `tag`.
- **Returns:** per-task `result`: `keyword`, `se_results_count` (total SERP results), `items_count`, `item_types[]` (which element types are present), and `items[]`.
  - `items[].type` values: `organic`, `paid`, `featured_snippet`, `answer_box`, `people_also_ask`, `knowledge_graph`, `local_pack`, `map`, `video`, `images`, `related_searches`, `top_stories`, `shopping`, `carousel`, `ai_overview`, and more.
  - Organic item fields: `rank_group` (position among same-type items), `rank_absolute` (position among all elements), `domain`, `title`, `url`, `description`, `breadcrumb`, plus optional `rating`, `links`, `timestamp`.

## Live Regular — `POST /v3/serp/google/organic/live/regular`
- Cheaper, stripped-down: returns only `organic`, `paid`, `featured_snippet` with `rank_group`/`rank_absolute`/`domain`/`title`/`url`/`description`/`breadcrumb`.
- **Use Regular** when you only need rankings/positions; **use Advanced** when you need SERP-feature analysis. (An HTML function type also exists, returning raw SERP HTML.)

## Task-based (cheaper, queued) — `task_post` → `tasks_ready` → `task_get`
- Submit: `POST /v3/serp/google/organic/task_post` (same params; `priority` 1 normal / 2 high).
- Poll: `GET /v3/serp/google/organic/tasks_ready`.
- Fetch: `GET /v3/serp/google/organic/task_get/regular/$id` (or `/advanced/$id`, `/html/$id`).
- Webhooks instead of polling: `pingback_url` (GET on completion) or `postback_url` (POSTs gzipped results; set `postback_data` to `regular`/`advanced`/`html`).
- **Use when:** cost-sensitive or high-volume batches where seconds-to-minutes latency is fine.

## Locations & languages
- `GET /v3/serp/google/locations` (or `/locations/$country`) → items with `location_code` (the integer to pass), `location_name`, `country_iso_code`, `location_type`.
- `GET /v3/serp/google/languages` → items with `language_name`, `language_code` (ISO 639-1).

## Other engines
Same structure for `bing`, `yahoo`, `youtube`, `baidu`, `naver`, `seznam` (e.g. `/v3/serp/bing/organic/...`), each with its own locations/languages.

---

## Request example — Live Advanced

```json
[
  {
    "keyword": "best running shoes",
    "location_code": 2840,
    "language_code": "en",
    "device": "desktop",
    "depth": 20,
    "people_also_ask_click_depth": 2,
    "tag": "rank-check"
  }
]
```

## Notes
- To **check a specific domain's position** for a keyword, fetch the SERP and find the organic item whose `domain` matches; `rank_group` is its organic position, `rank_absolute` its position among all SERP elements.
- SERP API hits live results (good for current rankings & SERP features). For ranking data across *many* keywords for a domain without per-keyword SERP calls, prefer DataForSEO Labs `ranked_keywords` instead.
