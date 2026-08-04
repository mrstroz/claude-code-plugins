# Querying the Payload REST API

`payload-api.mjs` takes `--where` either as JSON or as a shorthand, and serializes it into Payload's bracket query syntax. Both of these produce the same request:

```bash
--where 'slug=oferta'
--where '{"slug":{"equals":"oferta"}}'
```

Shorthand covers the common case: `field=value` means `equals`, `field:operator=value` picks another operator, and several clauses joined with `&` are combined with `and`.

```bash
--where 'title:like=cennik&published=true'
```

Anything beyond that — `or`, mixed nesting — is easier as JSON.

## Operators

| Operator | Matches |
|---|---|
| `equals` / `not_equals` | Exact value |
| `greater_than` / `greater_than_equal` | Numbers and dates |
| `less_than` / `less_than_equal` | Numbers and dates |
| `like` | Contains the words, case-insensitive — the usual choice for text search |
| `contains` | Contains the string |
| `in` / `not_in` | A comma-separated list. The client turns a JSON array into one |
| `all` | An array field containing all the given values |
| `exists` | `true` / `false` — has a value at all |
| `near` | Point fields, `<lng>,<lat>,<maxMeters>,<minMeters>` |

## Combining

```json
{"and": [
  {"category": {"equals": 3}},
  {"or": [
    {"publishedAt": {"greater_than": "2026-01-01"}},
    {"featured": {"equals": true}}
  ]}
]}
```

`and` and `or` take arrays of clause objects and nest freely.

## Paths into nested data

Dot notation reaches into groups, arrays and across relationships:

```bash
--where 'meta.title:like=cennik'          # into a group
--where 'categories.slug=news'             # across a relationship, by the related doc's field
--where 'hero.slides.image=42'            # into an array inside a block — useful for reference checks
```

### `blockType` — the field has to match the block

Filtering by block type works, but the block must belong to the block set of the field you name:

| Query | Result |
|---|---|
| `hero.blockType=heroBanner` — a hero block on the hero field | 200 |
| `layout.blockType=textWithImage` — a body block on the body field | 200 |
| `layout.blockType=heroBanner` — a hero block on the body field | **500** |
| `hero.blockType=textWithImage` — a body block on the hero field | **500** |
| `layout.blockType=noSuchBlock` — a block that exists nowhere | **500** |
| `where[layout][blockType][equals]=…` — the nested form | **400** |

Payload builds the query against the tables joined for that field, so a block that field never accepts has nothing to match and the query fails outright. **A 500 here means you named the wrong field, not that filtering is unavailable** — check the block index for which field lists that block and re-query.

Fall back to fetch-and-scan only when you need several fields at once, or do not know which field holds the block:

```bash
node "$API_SCRIPT" find pages --read-only --limit 50 --depth 0 --out /tmp/p.json --raw > /dev/null
node -e "
for (const d of require('/tmp/p.json').docs)
  for (const b of [...(d.hero||[]), ...(d.layout||d.sections||[])])
    if (b.blockType==='heroBanner') { console.log(d.id, d.slug); break; }
"
```

## A malformed filter widens the match

A `where` Payload cannot resolve is ignored rather than rejected, so a broken filter returns **everything** and looks like a legitimate result. `alt[exists]=false` — bracket syntax written into the shorthand — used to sail through and return the whole media library.

Three things now catch this:

- The client **rejects a field name containing `[` or `]`**, which is always a bracket form in the wrong place, and shows the two correct spellings.
- The client **rejects an unknown operator**, so `title:contain=x` fails instead of matching nothing in particular.
- Whenever `--where` is given, the client runs one extra unfiltered count and **warns if the filter matched every document in the collection**. That is sometimes legitimate, which is why it is a warning and not an error — but it is also exactly what an ignored filter looks like, so confirm the field name before acting on it.

None of that catches a well-formed filter on a field that does not exist. When a count comes back suspiciously round, check it against the collection before letting it drive a bulk operation.

## Shaping the response

| Option | Effect |
|---|---|
| `--depth 0` | Relationships stay as ids. The default, and the right choice for audits and anything that will become a write |
| `--depth 1` | One level populated — enough to read a page's media alt text or a related title |
| `--select a,b,c` | Only those fields. On a listing question, the difference between 2 KB and 200 KB |
| `--limit` / `--page` | Default limit is 10. `--limit 0` returns everything, which on a large collection is rarely what you want |
| `--sort field` | Prefix `-` for descending: `--sort -publishedAt` |

Depth cost compounds: at `--depth 2` every relationship of every relationship is inlined, and a page with a dozen media references becomes hundreds of kilobytes. Raise depth for one document, never for a listing.

## Counting

`find` reports `totalDocs` regardless of how many documents it returns, so the cheapest count is:

```bash
node "$API_SCRIPT" find articles --read-only --where 'category=3' --limit 1 --select id
```

The response also carries `totalPages`, `page`, `hasNextPage`, `hasPrevPage`.

## Locales

`--locale all` returns every localized field as `{pl: …, en: …}`, at every nesting depth — including localized leaves inside a block array whose array is not itself localized. It is the only way to answer "what is translated": at a single locale, `fallback` serves the other language and an untranslated field looks filled.

An untranslated field either omits its locale key or holds `null`:

```jsonc
{"title": {"pl": "Cennik"},    // no `en` key — untranslated
 "slug":  {"pl": null}}        // present, empty — also untranslated
```

`--fallback-locale none` shows the holes at a single locale instead.

## Globals

```bash
node "$API_SCRIPT" get-global footer --read-only --depth 1 --locale all
```

Globals have no ids and no listing — one document per slug.

## Exporting

Save the raw response and work from the file rather than from a paste:

```bash
node "$API_SCRIPT" find articles --read-only --limit 0 --depth 0 --locale all \
  --out ./articles-export.json --raw > /dev/null
```

For a spreadsheet, convert after the fact — `--select` first so the columns are decided by the query rather than by trimming afterwards.
