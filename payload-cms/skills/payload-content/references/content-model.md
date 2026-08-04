# Field shapes over REST

What each Payload field type looks like in a JSON document, and which of them behave differently on the way in than on the way out. Read this when you are about to build a document body and the copied template does not cover a field you need.

## What the API can and cannot tell you

The live API is the best available oracle for **shape**: field names, nesting, which values are ids, and — via `?locale=all` — which fields are localized. It cannot tell you about **constraints**, because a valid document does not display the rules it satisfied.

| From the API (`GET ...?depth=0&locale=all`) | From source only |
|---|---|
| Field names, including factory-generated ones | `required` |
| Nesting and array shapes | `minRows` / `maxRows` |
| Which fields are localized, at any depth | `select` options (unless the doc happens to use them all) |
| ids vs populated objects | `filterOptions` |
| Real, already-valid example values | `admin.description` — the editorial intent |
| Which blocks are actually in use | Which blocks are *available* |

The `?locale=all` trick resolves at every nesting level, not just the top. A localized leaf inside a **non-localized** array still comes back as `{pl: …, en: …}`, while its non-localized siblings come back plain — so one request maps the whole document's localization, block rows included.

## The types

**`text`, `textarea`, `email`, `number`, `date`** — scalars. Dates are ISO strings. A `number` field is a number, not a numeric string.

**`checkbox`** — a real boolean. A localized checkbox reads as `{pl: true, en: null}`.

**`select`** — the stored **value**, which is an identifier and usually differs from the label shown in the admin. `background` might store `mist` and display "Jasnoszare". Never derive a value from what the user called it; map through the field's `options`.

**`richText`** — a full Lexical editor state: `{root: {type, children, direction, format, indent, version}}`. Never a string, never HTML. See `richtext.md`.

**`upload`** — the id of a document in the upload collection. A `depth=0` read gives the bare id; `depth>=1` gives the whole media document. Write the id.

**`relationship`** — an id when `relationTo` is a single collection; `{relationTo: 'slug', value: id}` when it is polymorphic. With `hasMany: true`, an array of either. Same `depth` rule as `upload`: read shallow when the read will become a write.

**`array`** — a list of objects, each with an `id` Payload assigns. The row-id rule in `blocks.md` applies here too: rewriting an array without its ids recreates every row.

**`blocks`** — an array of objects, each with `blockType` plus the block's own fields, plus `id` and optional `blockName`. See `blocks.md`.

**`group`** — a nested object under the group's name. Localization applies per leaf, not to the group.

**`row`** and **`collapsible`** — layout only. Their children are **flat** at the parent level; there is no `row` key in the JSON.

**`tabs`** — layout only, same as `row`. A named tab (one with a `name`) *does* nest; an unnamed one does not. Both are common, so check the source rather than assuming.

**`join`** — read-only, computed from the other side of a relationship. Never write it.

**`virtual: true`** — computed on read, rejected on write. A frequent pattern pairs a rich-text field with a `<name>Html` sibling that runs the Lexical→HTML conversion in an `afterRead` hook. Strip every key ending in `Html` from a copied template, and confirm the general case with `rg "virtual: true" <source-root>`.

## Fields added by plugins

The SEO plugin adds a `meta` group (`title`, `description`, `image`) to the collections it is configured for. It is a normal group and writes normally; its leaves are localized if the plugin was configured that way, which `?locale=all` will show you.

Upload collections gain `url`, `filename`, `mimeType`, `filesize`, `width`, `height` — all computed. Write only the fields the collection declares itself, such as `alt`.

Auth collections gain `email`, `password`, `sessions`, `loginAttempts`. This skill does not write to auth collections.

## Document ids

Ask the project, don't assume. A config with `db.defaultIDType: number` (visible in `payload-types.ts`) has integer ids; other adapters use 24-character hex strings. It matters when you build a `where[id][in]=…` filter or compare ids as strings.

## Slugs are project conventions, not a Payload feature

Payload has no built-in slug field. Each project invents its own, and the conventions differ sharply — one project's page slug is a **full path with slashes** where an empty value means the home page, while its article slugs are bare leaf segments. Uniqueness may be global or per-locale. Read the collection file before writing one, and check for a collision first:

```bash
node payload-api.mjs find pages --where 'slug=oferta/wynajem' --select slug --limit 1
```
