# DataForSEO On-Page API & Domain Analytics API

Secondary (non-priority) coverage for technical SEO audits and domain intelligence. Body is a JSON array of task objects. Docs: https://docs.dataforseo.com/v3/on_page/overview/ and https://docs.dataforseo.com/v3/domain_analytics/overview/

---

## On-Page API (technical SEO audit)

Crawls a site like a search bot and reports technical issues (broken links, duplicate/missing tags, slow pages, indexability, thin content). A full crawl is **task-based**; single-URL audits are **Live** via `instant_pages`. Charged per crawled page.

### `instant_pages` (LIVE) — `POST /v3/on_page/instant_pages`
- **Answers:** full technical audit of a **single known URL**, instantly (no crawl/polling).
- **Params:** `url` **(REQUIRED, absolute)**, `enable_javascript`, `enable_browser_rendering` (for Core Web Vitals), `load_resources`, `custom_user_agent`, `browser_preset` (`desktop`/`mobile`/`tablet`), `check_spell`, `validate_micromarkup`.
- **Returns (per page):** `onpage_score` (0–100), `status_code`, meta (`title`, `description`, `canonical`, lengths, `internal_links_count`, `external_links_count`, `images_count`), `content` (`plain_text_word_count`, readability indices, title/description-to-content consistency), `page_timing` (`largest_contentful_paint`, `time_to_interactive`, TTFB `waiting_time`…), `cumulative_layout_shift`, `checks` (40+ booleans like `no_h1_tag`, `title_too_long`, `no_image_alt`, `high_loading_time`, `canonical`, `is_broken`), `broken_resources`, `broken_links`.
- **Use when:** auditing one page (e.g. a landing page) with no crawl overhead.

### Full crawl (TASK) — `task_post` → `summary` → `pages`
- Start: `POST /v3/on_page/task_post` — `target` **(REQUIRED, domain)**, `max_crawl_pages` **(REQUIRED)**, plus `start_url`, `respect_sitemap`, `enable_javascript`, `enable_browser_rendering`, `custom_js`, `load_resources`, `pingback_url`. Returns a task `id`.
- Progress + site-wide health: `GET /v3/on_page/summary/$id` — `crawl_progress`, `crawl_status` (`pages_crawled`, `pages_in_queue`), `domain_info` (+ `checks`: `sitemap`, `robots_txt`, `ssl`, `http2`…), `page_metrics` (`onpage_score`, `broken_links`, `duplicate_title`, `non_indexable`, …) and `page_metrics.checks` (site-wide issue counts).
- Per-page detail: `GET /v3/on_page/pages/$id` — one item per page with `onpage_score`, `meta` (incl. `title_length`, `description_length`), `meta.content.plain_text_word_count`, `page_timing`, per-page `checks`, `click_depth`.
- **Use when:** auditing an entire site (more than one page); tolerate async polling.

### `lighthouse/task_post` (TASK; a `lighthouse/live` also exists)
- Runs Google Lighthouse: `url` **(REQUIRED)**, `for_mobile`, `categories` (`seo`, `performance`, `best_practices`, `accessibility`).
- Returns category scores (0–1 scale) + individual audits (FCP, LCP, TBT, CLS, Speed Index). Use for Google-aligned performance/SEO scoring (note: `onpage_score` is 0–100, Lighthouse scores are 0–1).

---

## Domain Analytics API

Intelligence about the domain itself rather than page content. Both sub-APIs are **Live-only**.

### Technologies — `POST /v3/domain_analytics/technologies/domain_technologies/live`
- **Answers:** the tech stack a site runs on.
- **Params:** `target` **(REQUIRED, domain)**.
- **Returns:** `domain`, `title`, `description`, `domain_rank`, `country_iso_code`, `language_code`, `phone_numbers[]`, `emails[]`, `social_graph_urls[]`, and `technologies` grouped category → group → list (e.g. `content.cms`, `ecommerce`, `web_development.javascript_libraries`, `servers.cdn`, `analytics`).
- **Use when:** profiling a competitor's/prospect's CMS, e-commerce platform, analytics, CDN, JS libraries.

### Whois Overview — `POST /v3/domain_analytics/whois/overview/live`
- **Answers:** WHOIS registration data enriched with aggregate SEO/traffic/backlink metrics, with server-side filtering.
- **Params:** `limit`/`offset`/`offset_token`, `filters` (≤8), `order_by` (≤3), `tag`.
- **Returns (per item):** `domain`, `tld`, `registrar`, `created_datetime`, `expiration_datetime`, `registered`, `epp_status_codes[]`, a `metrics` object (`organic`/`paid` with `pos_*`, `count`, `etv`, `estimated_paid_traffic_cost`), and `backlinks_info` (`referring_domains`, `backlinks`, `dofollow`…).
- **Use when:** finding/filtering domains by registration date, expiry, registrar, or SEO strength (e.g. expiring domains with strong backlinks).

---

## Request example — instant_pages (LIVE)

```json
[
  {
    "url": "https://example.com/landing-page",
    "enable_javascript": true,
    "enable_browser_rendering": true,
    "check_spell": true,
    "browser_preset": "desktop"
  }
]
```
