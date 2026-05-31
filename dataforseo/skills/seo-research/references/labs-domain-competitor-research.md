# DataForSEO Labs — Domain & Competitor Research

Domain-level and competitor endpoints from DataForSEO Labs. All **Live**, under `POST /v3/dataforseo_labs/google/...`. Shared conventions (`filters`, `order_by`, `limit`/`offset`, `include_clickstream_data` doubling cost, location/language) match the keyword-research reference. Docs: https://docs.dataforseo.com/v3/dataforseo_labs/overview/

## The shared `metrics` object

`domain_rank_overview`, `competitors_domain`, `relevant_pages`, `subdomains`, and `historical_rank_overview` return a `metrics` object keyed by SERP type (`organic`, `paid`, sometimes `featured_snippet`, `local_pack`), each containing:

- Position buckets: `pos_1`, `pos_2_3`, `pos_4_10`, `pos_11_20`, … `pos_91_100` (count of ranking keywords in each band).
- `etv` — estimated monthly organic traffic (Σ CTR × search_volume).
- `count` — number of SERPs the target appears in.
- `estimated_paid_traffic_cost` — USD-equivalent monthly ad spend for that visibility.
- `is_new`, `is_up`, `is_down`, `is_lost` — rank-change counts since last update.
- clickstream fields when `include_clickstream_data` is enabled.

`bulk_traffic_estimation` returns a **reduced** `metrics` (only `etv` + `count`).

---

## Endpoints

### Ranked Keywords — `POST /v3/dataforseo_labs/google/ranked_keywords/live`
- **Answers:** which keywords a domain/subdomain/URL ranks for, at what position, with volume & traffic value.
- **Params:** `target` **(REQUIRED — domain without scheme, OR a full page URL)**, location (optional — omit = all), language (optional), `item_types` (default `["organic","paid"]`; also `featured_snippet`, `local_pack`), `historical_serp_mode` (`live`|`lost`|`all`), `load_rank_absolute`, `ignore_synonyms`, `filters`, `order_by`, `limit` (default 100).
- **Returns:** result-level aggregate `metrics`. Each item:
  - `ranked_serp_element.serp_item`: `type`, `rank_group`, `rank_absolute`, `relative_url`, `etv`, `estimated_paid_traffic_cost`, `is_new/is_up/is_down/is_lost`, `backlinks_info`, `rank_info`.
  - `keyword_data`: `keyword`, `keyword_info` (`search_volume`, `cpc`, `competition`, bids, `monthly_searches[]`), `keyword_properties.keyword_difficulty`, `search_intent_info.main_intent`.
- **Use when:** building a domain's or page's full keyword footprint; finding lost keywords (`historical_serp_mode: lost`).

### Domain Rank Overview — `POST /v3/dataforseo_labs/google/domain_rank_overview/live`
- **Answers:** one-shot domain SEO scorecard — position distribution, total ranking keywords, estimated traffic.
- **Params:** `target` **(REQUIRED, domain)**, location **(REQUIRED)**, language **(REQUIRED)**, `ignore_synonyms`.
- **Returns:** items with `metrics.organic` and `metrics.paid` (full standard pattern). Quick top-line for a dashboard.

### Competitors Domain — `POST /v3/dataforseo_labs/google/competitors_domain/live`
- **Answers:** who a domain's organic/paid competitors are, ranked by keyword overlap.
- **Params:** `target` **(REQUIRED, single domain)**, location **(REQUIRED)**, language **(REQUIRED)**, `item_types`, `max_rank_group` (top-N positions, default 100), `exclude_top_domains` (drop Wikipedia/Amazon/etc.), `exclude_domains[]`, `intersecting_domains[]` (≤20), `filters`, `order_by` (default `metrics.organic.count,desc`), `limit`.
- **Returns:** per item (a competitor) `domain`, `avg_position`, `sum_position`, `intersections` (shared-keyword count), `full_domain_metrics` (competitor's entire footprint), `metrics` (over the intersecting keywords only).
- **Note:** `target` is a single domain — competitors are discovered, not supplied.

### Domain Intersection — `POST /v3/dataforseo_labs/google/domain_intersection/live`
- **Answers:** keywords two specific domains both rank for — or the gap where target1 ranks but target2 doesn't.
- **Params:** `target1` **(REQUIRED)**, `target2` **(REQUIRED)**, location **(REQUIRED)**, language **(REQUIRED)**, `intersections` (`true` = both rank, default; `false` = target1 only = gap), `item_types`, `include_serp_info`, `filters`, `order_by` (default `keyword_data.keyword_info.search_volume,desc`), `limit`.
- **Returns:** per item `keyword_data` + `first_domain_serp_element` and `second_domain_serp_element` (each with `rank_group`, `rank_absolute`, `url`, `etv`, …).
- **Use when:** head-to-head comparison; `intersections:false` finds content/keyword gaps to exploit.

### Relevant Pages — `POST /v3/dataforseo_labs/google/relevant_pages/live`
- **Answers:** which pages of a domain rank and drive the most traffic.
- **Params:** `target` **(REQUIRED, domain)**, location, language, `item_types`, `historical_serp_mode`, `filters`, `order_by` (e.g. `metrics.organic.etv,desc`), `limit`.
- **Returns:** per item `page_address` + `metrics` (standard pattern). Use to find top landing pages, or a competitor's best pages to model.

### Subdomains — `POST /v3/dataforseo_labs/google/subdomains/live`
- **Answers:** which subdomains a domain has and how each performs.
- **Params:** `target` **(REQUIRED, domain)**, location, language, `item_types`, `filters`, `order_by`, `limit`.
- **Returns:** per item `subdomain` + `metrics`. Use to see traffic split across `blog.`, `shop.`, `support.`, etc.

### SERP Competitors — `POST /v3/dataforseo_labs/google/serp_competitors/live`
- **Answers:** given a **keyword set**, which domains dominate those SERPs.
- **Params:** `keywords[]` **(REQUIRED, ≤200)**, location **(REQUIRED)**, language **(REQUIRED)**, `include_subdomains` (default true), `item_types`, `filters`, `order_by`, `limit`.
- **Returns:** per item (a domain) `domain`, `avg_position`, `median_position`, `rating`, `etv`, `keywords_count`, `visibility`, `keywords_positions`.
- **Use when:** you have a target topic/keyword cluster and want to know who already wins it.

### Bulk Traffic Estimation — `POST /v3/dataforseo_labs/google/bulk_traffic_estimation/live`
- **Answers:** estimated monthly traffic for many targets at once.
- **Params:** `targets[]` **(REQUIRED, ≤1000 — domains/subdomains without scheme, or absolute page URLs)**, location, language, `item_types`.
- **Returns:** per item `target` + a lightweight `metrics` (each type has **only `etv` + `count`** — no position buckets). Use for fast screening across a big list.

### Historical Rank Overview — `POST /v3/dataforseo_labs/google/historical_rank_overview/live`
- **Answers:** month-by-month trend of a domain's organic + paid visibility/traffic.
- **Params:** `target` **(REQUIRED, domain)**, location **(REQUIRED)**, language **(REQUIRED)**, `date_from`/`date_to` (`yyyy-mm-dd`, default last 6 months), `correlate` (default true).
- **Returns:** per item `{year, month, metrics{organic, paid}}`. Use to chart trajectory or spot algorithm-update impact.

---

## Request examples

Competitors of a domain:
```json
[
  {
    "target": "example.com",
    "location_name": "United States",
    "language_name": "English",
    "item_types": ["organic"],
    "exclude_top_domains": true,
    "filters": [["metrics.organic.count", ">=", 50]],
    "order_by": ["metrics.organic.etv,desc"],
    "limit": 50
  }
]
```

Top-10 organic keywords a domain ranks for:
```json
[
  {
    "target": "example.com",
    "location_name": "United Kingdom",
    "language_name": "English",
    "item_types": ["organic"],
    "filters": [["ranked_serp_element.serp_item.rank_group", "<=", 10]],
    "order_by": ["keyword_data.keyword_info.search_volume,desc"],
    "limit": 100
  }
]
```

## Notes

- `target` for these is a domain **without** `https://` or `www.` (except `ranked_keywords`/`relevant_pages` where a full page URL also works as `target`).
- Only `bulk_traffic_estimation` takes a `targets[]` list; only `serp_competitors` takes a `keywords[]` list. `competitors_domain` (one `target`) and `domain_intersection` (`target1`+`target2`) take fixed inputs.
- Request bodies are bare JSON arrays (`[{...}]`), not wrapped in `{"tasks": [...]}`.
