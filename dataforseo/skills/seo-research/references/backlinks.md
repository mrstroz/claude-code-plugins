# DataForSEO Backlinks API

Exposes DataForSEO's backlink index — link profile, referring domains, anchors, and link quality — for any domain, subdomain, or page. All endpoints are **Live POST** under `/v3/backlinks/<endpoint>/live`. Docs: https://docs.dataforseo.com/v3/backlinks/overview/

## Shared conventions
- Body is a JSON array of task objects.
- `target` **(REQUIRED)** — interpretation varies per endpoint (domain/subdomain vs full page URL — see each).
- `backlinks_status_type`: `all` | `live` (default) | `lost`.
- `rank_scale`: `one_hundred` (0–100) | `one_thousand` (0–1000, default) — affects all `rank` fields.
- `include_subdomains`, `exclude_internal_backlinks` (default true), `internal_list_limit` (caps nested breakdown lists), `filters` (≤8), `order_by` (≤3), `limit` (default 100, max 1000), `offset`, `tag`.

The breakdown objects appear on summary/referring_domains/anchors/domain_pages items: `referring_links_tld`, `referring_links_types`, `referring_links_attributes` (nofollow, ugc, sponsored…), `referring_links_platform_types`, `referring_links_semantic_locations`, `referring_links_countries`.

---

### Summary — `POST /v3/backlinks/summary/live`
- **Answers:** aggregated backlink profile + link-quality snapshot for one target.
- **`target`:** domain, subdomain, or full page URL.
- **Returns:** `rank`, `backlinks`, `backlinks_spam_score`, `referring_domains`, `referring_main_domains`, `referring_pages`, `referring_ips`, `referring_subnets`, `*_nofollow` counterparts, `broken_backlinks`, `broken_pages`, `first_seen`, `lost_date`, plus the breakdown objects.
- **Use when:** a single high-level view of a link profile and its quality.

### Backlinks — `POST /v3/backlinks/backlinks/live`
- **Answers:** itemized list of individual backlinks to a target.
- **`target`:** domain/subdomain (no scheme/www) or absolute page URL. `mode` (`as_is` default | `one_per_domain` | `one_per_anchor`).
- **Returns (per item):** `domain_from`, `url_from`, `url_to`, `anchor`, `dofollow`, `is_new`, `is_lost`, `is_broken`, `backlink_spam_score`, `rank`, `page_from_rank`, `domain_from_rank`, `domain_from_country`, `page_from_title`, `first_seen`, `last_seen`, `item_type` (anchor/image/redirect/…), `attributes`. Deep pagination via `search_after_token` (offset max 20,000).

### Referring Domains — `POST /v3/backlinks/referring_domains/live`
- **Answers:** domains linking to a target, each with its own aggregated metrics.
- **Returns (per item):** `domain`, `rank`, `backlinks`, `backlinks_spam_score`, `first_seen`, `lost_date`, `broken_backlinks`, `referring_domains`, `referring_pages`, `*_nofollow`, `referring_ips`, plus breakdown objects.
- **Use when:** prioritizing/auditing referrers (spammy vs authoritative).

### Anchors — `POST /v3/backlinks/anchors/live`
- **Answers:** anchor texts used in backlinks, with per-anchor metrics.
- **Returns (per item):** `anchor`, `rank`, `backlinks`, `backlinks_spam_score`, `referring_domains`, `referring_pages`, `*_nofollow`, plus breakdown objects.
- **Use when:** auditing anchor-text distribution (branded vs exact-match, over-optimization).

### Domain Pages — `POST /v3/backlinks/domain_pages/live`
- **Answers:** the most-linked pages of a domain, with on-page metadata + nested backlink summary.
- **`target`:** must be a **domain or subdomain** (not a single page).
- **Returns (per item):** page info (`page`, `status_code`, `size`, …), `meta` (`title`, `canonical`, `internal_links_count`, `external_links_count`, `images_count`, `words_count`, `page_spam_score`, `h1`…), and `page_summary` (rank/backlinks/referring_* for that page).
- **Use when:** finding which pages attract the most links (content-gap & outreach targeting).

### Competitors — `POST /v3/backlinks/competitors/live`
- **Answers:** domains whose backlink profiles overlap the target's (link-graph competitors).
- **Returns (per item):** `target` (competitor domain), `rank`, `intersections` (shared referring-domain count). Flat — no nested metrics. `exclude_large_domains` (default true) drops giants.
- **Use when:** backlink gap analysis / outreach prospecting.

### Bulk Ranks — `POST /v3/backlinks/bulk_ranks/live`
- **Answers:** backlink rank score for many targets at once.
- **Params:** `targets[]` **(REQUIRED, ≤1000 — domains/subdomains/pages)**, `rank_scale`.
- **Returns (per item):** `target`, `rank`. Use to score a large list by link authority quickly.

Other endpoints (not detailed): History, Domain Pages Summary, Referring Networks, Domain/Page Intersection, Timeseries Summary, New & Lost Timeseries, and Bulk variants (Bulk Backlinks, Bulk Spam Score, Bulk Referring Domains).

---

## Request example — Summary

```json
[
  {
    "target": "example.com",
    "internal_list_limit": 10,
    "include_subdomains": true,
    "backlinks_status_type": "live",
    "rank_scale": "one_thousand",
    "tag": "backlink-summary"
  }
]
```

## Notes
- For a domain-wide profile pass the bare domain; for a single page pass the absolute URL (where the endpoint allows pages).
- `backlinks_spam_score` / `backlink_spam_score` flags low-quality links; combine with `filters` (e.g. `["dofollow", "=", true]`) to focus the analysis.
