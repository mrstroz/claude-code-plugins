# DataForSEO Labs — Keyword Research

DataForSEO Labs derives keyword/SERP/domain metrics from DataForSEO's own database (not live SERP scraping), so it's fast and cheap — the workhorse for keyword & competitor research. All endpoints are **Live** (single POST, instant), under `POST /v3/dataforseo_labs/google/...`. Docs: https://docs.dataforseo.com/v3/dataforseo_labs/overview/

## Shared conventions

- Body is a JSON **array of task objects**. Specify location via `location_name` or `location_code`, language via `language_name` or `language_code`.
- `filters` (array, ≤8 conditions): operators `regex, not_regex, <, <=, >, >=, =, <>, in, not_in, match, not_match, like, not_like, ilike, not_ilike`; nest with `"and"`/`"or"`. Example: `[["keyword_info.search_volume", ">", 100]]`.
- `order_by` (array, ≤3 rules): e.g. `["keyword_info.search_volume,desc"]`.
- `limit` (max 1000), `offset`, `offset_token` (for sets beyond 10,000).
- `include_serp_info` adds per-keyword `serp_info`. `include_clickstream_data` adds clickstream metrics but **roughly doubles cost**.

## Shared nested result objects

These objects recur across most endpoints' `items[]`:

- **`keyword_info`**: `search_volume`, `cpc`, `competition` (0–1), `competition_level` (LOW/MEDIUM/HIGH), `low_top_of_page_bid`, `high_top_of_page_bid`, `categories[]`, `monthly_searches[]` (`{year, month, search_volume}`), `search_volume_trend` (monthly/quarterly/yearly % change).
- **`keyword_properties`**: `keyword_difficulty` (0–100), `core_keyword`, `detected_language`, `is_another_language`.
- **`search_intent_info`**: `main_intent` (informational/navigational/commercial/transactional), `foreign_intent[]`.
- **`serp_info`**: `check_url`, `serp_item_types[]`, `se_results_count`.
- **`avg_backlinks_info`**: `backlinks`, `dofollow`, `referring_pages`, `referring_domains`, `referring_main_domains`, `rank` (averages across top-ranking pages).
- **`keyword_info_normalized_with_bing` / `_with_clickstream`**: volume normalized against Bing / clickstream.

---

## Endpoints

### Keyword Ideas — `POST /v3/dataforseo_labs/google/keyword_ideas/live`
- **Answers:** other keywords sharing the same topics/categories as my seed keywords (broad topical universe).
- **Params:** `keywords[]` **(REQUIRED, ≤200 seeds)**, location (REQUIRED), language, `closely_variants` (phrase- vs broad-match), `ignore_synonyms`, `include_serp_info`, `include_clickstream_data`, `filters`, `order_by` (default `relevance,desc`), `limit` (default 700).
- **Returns:** per item `keyword` + `keyword_info`, `keyword_properties`, `search_intent_info`, `serp_info`, `avg_backlinks_info`; result-level `total_count`, `offset_token`.

### Keyword Suggestions — `POST /v3/dataforseo_labs/google/keyword_suggestions/live`
- **Answers:** long-tail keywords that **contain** my seed phrase (autocomplete-style).
- **Params:** `keyword` **(REQUIRED, single string)**, location, language, `include_seed_keyword`, `exact_match`, `ignore_synonyms`, `include_serp_info`, `filters`, `order_by` (default `keyword_info.search_volume,desc`), `limit` (default 100).
- **Returns:** result-level `seed_keyword`, `seed_keyword_data`; per item `keyword` + the shared objects.

### Related Keywords — `POST /v3/dataforseo_labs/google/related_keywords/live`
- **Answers:** keywords from Google's "searches related to" block, expandable into topic clusters.
- **Params:** `keyword` **(REQUIRED)**, location (REQUIRED), language (REQUIRED), `depth` (0–4, default 1 → up to 8/72/584/4680 keywords), `include_seed_keyword`, `replace_with_core_keyword`, `filters`, `order_by`, `limit`.
- **Returns:** items wrap `keyword_data` (keyword + shared objects) plus a `related_keywords[]` array branching from it.

### Keyword Overview — `POST /v3/dataforseo_labs/google/keyword_overview/live`
- **Answers:** the full metric profile for a **known list** of keywords (no idea generation).
- **Params:** `keywords[]` **(REQUIRED, ≤700)**, location, language, `include_serp_info`, `include_clickstream_data`.
- **Returns:** per item `keyword` + `keyword_info`, `keyword_properties`, `serp_info`, `avg_backlinks_info`, `search_intent_info`, `clickstream_keyword_info` (incl. `gender_distribution`, `age_distribution`).
- **Use when:** enriching an existing keyword list with full SEO/PPC metrics in one call.

### Bulk Keyword Difficulty — `POST /v3/dataforseo_labs/google/bulk_keyword_difficulty/live`
- **Answers:** how hard it is to rank top-10 organic for each keyword.
- **Params:** `keywords[]` **(REQUIRED, ≤1000)**, location (REQUIRED), language (REQUIRED).
- **Returns:** lean — per item `keyword` + `keyword_difficulty` (0–100). Use when scoring difficulty across a large set cheaply.

### Search Intent — `POST /v3/dataforseo_labs/google/search_intent/live`
- **Answers:** the search intent of each keyword, with confidence.
- **Params:** `keywords[]` **(REQUIRED, ≤1000)**, language (REQUIRED). **No location param** (language-only).
- **Returns:** per item `keyword`, `keyword_intent` (`{label, probability}`), `secondary_keyword_intents[]`.

### Keywords For Site — `POST /v3/dataforseo_labs/google/keywords_for_site/live`
- **Answers:** which keywords are relevant to / drive traffic for a given domain (own or competitor).
- **Params:** `target` **(REQUIRED, domain without scheme)**, location (REQUIRED), language, `include_subdomains` (default true), `include_serp_info`, `filters`, `order_by` (default `relevance,desc`), `limit`.
- **Returns:** per item `keyword` + the shared objects. (For ranked positions instead of relevance, use `ranked_keywords` — see the domain reference.)

### Historical Keyword Data — `POST /v3/dataforseo_labs/google/historical_keyword_data/live`
- **Answers:** how volume/CPC/competition changed over time (seasonality, trends).
- **Params:** `keywords[]` **(REQUIRED, ≤700)**, location (REQUIRED), language (REQUIRED).
- **Returns:** per item `keyword` + `history[]`, each entry `{year, month, keyword_info{...}}`.

---

## Request example — Keyword Suggestions

```json
[
  {
    "keyword": "running shoes",
    "location_name": "United States",
    "language_name": "English",
    "include_seed_keyword": true,
    "include_serp_info": true,
    "filters": [["keyword_info.search_volume", ">", 100]],
    "order_by": ["keyword_info.search_volume,desc"],
    "limit": 100,
    "tag": "kw-suggestions"
  }
]
```

(Keyword Ideas is identical but uses `"keywords": ["running shoes", "trainers"]` and `closely_variants` instead of `exact_match`/`include_seed_keyword`.)

## Notes

- `search_intent` is the only keyword endpoint taking language but **no location**.
- `bulk_keyword_difficulty` and `search_intent` return lean responses (no full `keyword_info`); use `keyword_overview` when you need difficulty **and** full metrics together.
- Leave `include_clickstream_data` off unless you need demographic/clickstream volume — it doubles cost.
