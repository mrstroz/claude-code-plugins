# DataForSEO Keywords Data API

Returns search volume, CPC, and competition sourced from **Google Ads** (plus trend interest from Google Trends) — the canonical source for keyword demand. Docs: https://docs.dataforseo.com/v3/keywords_data/overview/

This reference covers the **Live** Google Ads + Google Trends endpoints. Body is a JSON array of task objects.

**Google Ads volume vs DataForSEO Labs:** Google Ads `search_volume` is a **monthly-averaged, rounded** figure straight from the Ads API — official, but less granular than Labs' `keyword_info`/`keyword_overview` (more precise, clickstream-enriched). Use Google Ads endpoints when you need the official Ads numbers; use Labs for higher precision and richer metrics.

Other subgroups (by name only): Bing (`bing/search_volume`, `bing/keywords_for_site`, `bing/keywords_for_keywords`), `clickstream_data`, `dataforseo_trends`.

---

### Google Ads — Search Volume — `POST /v3/keywords_data/google_ads/search_volume/live`
- **Answers:** official Google Ads volume/CPC/competition for an explicit keyword list.
- **Params:** `keywords[]` **(REQUIRED, ≤1000; ≤80 chars / ≤10 words each)**, location, language, `search_partners` (default false), `date_from`/`date_to` (`yyyy-mm-dd`; ≤4 yrs back), `include_adult_keywords`, `sort_by` (`relevance`|`search_volume`|`competition_index`|`low_top_of_page_bid`|`high_top_of_page_bid`).
- **Returns:** `keyword`, `competition` (HIGH/MEDIUM/LOW), `competition_index` (0–100), `search_volume` (monthly avg, rounded), `low_top_of_page_bid`, `high_top_of_page_bid`, `cpc`, `monthly_searches[]` (`{year, month, search_volume}`).

### Google Ads — Keywords For Keywords — `POST /v3/keywords_data/google_ads/keywords_for_keywords/live`
- **Answers:** related/suggested keywords for seed terms, with Ads metrics.
- **Params:** `keywords[]` **(REQUIRED, ≤20 seeds)**, location, language, `search_partners`, dates, `sort_by`, `include_adult_keywords`.
- **Returns:** same metric fields as search_volume + `keyword_annotations` (a `concepts` array with `name`/`concept_group`).

### Google Ads — Keywords For Site — `POST /v3/keywords_data/google_ads/keywords_for_site/live`
- **Answers:** keywords relevant to a domain or page, with Ads metrics (returns up to ~2000).
- **Params:** `target` **(REQUIRED — domain or URL)**, `target_type` (`site`|`page`, default `page`), location, language, `search_partners`, dates, `sort_by`, `include_adult_keywords`.
- **Returns:** same metric fields + `keyword_annotations`.

### Google Ads — Ad Traffic By Keywords — `POST /v3/keywords_data/google_ads/ad_traffic_by_keywords/live`
- **Answers:** forecast ad impressions/clicks/cost for keywords at a given bid & match type.
- **Params:** `keywords[]` **(REQUIRED, ≤1000)**, `bid` **(REQUIRED)**, `match` **(REQUIRED: `exact`|`broad`|`phrase`)**, location, language, dates **or** `date_interval` (`next_week`|`next_month`|`next_quarter`), `sort_by` (`impressions`|`ctr`|`average_cpc`|`cost`|`clicks`|`relevance`).
- **Returns:** `keyword`, `impressions`, `ctr`, `average_cpc`, `cost`, `clicks`. Rate-limited (~12 req/min). Use for forward-looking PPC forecasting.

### Google Trends — Explore — `POST /v3/keywords_data/google_trends/explore/live`
- **Answers:** relative interest-over-time (0–100, **not** absolute volume) and geo/topic data.
- **Params:** `keywords[]` **(REQUIRED, ≤5)**, location (omit = global), language, `type` (`web`|`news`|`youtube`|`images`|`froogle`), `category_code`, `date_from`/`date_to` (web earliest 2004-01-01) **or** `time_range` (`past_7_days` … `past_5_years`), `item_types` (`google_trends_graph`|`_map`|`_topics_list`|`_queries_list`).
- **Returns:** items by type — graph: `data[]` with `values[]` (0–100 per keyword over time); map: geo `values`; topics/queries lists: `top[]`/`rising[]`.
- **Use when:** you want trend direction/seasonality and relative popularity, not absolute numbers.

---

## Request example — Search Volume

```json
[
  {
    "keywords": ["seo tools", "keyword research", "backlink checker"],
    "location_name": "United States",
    "language_name": "English",
    "sort_by": "search_volume",
    "tag": "demand-sizing"
  }
]
```

## Notes
- `location_name`/`location_code` and `language_name`/`language_code` are alternatives — one of each suffices.
- Bids/CPC are in the account currency (USD by default). Restricted ad categories (weapons, tobacco, etc.) are excluded.
- Get valid locations/languages from `GET /v3/keywords_data/google_ads/locations` and `.../languages`.
