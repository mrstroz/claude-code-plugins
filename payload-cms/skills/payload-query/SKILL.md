---
name: payload-query
description: Read and search content in a Payload CMS project through its REST API without changing anything — find documents by any field, filter with where-operators, count, paginate, read a document across all locales, dump rich text as readable markdown, inspect which blocks a collection allows and what fields a block has, and audit content for missing translations, empty fields or broken references. Discovers the project's collections, globals, blocks and locales at runtime from payload.config.ts and the live API, so it works on any Payload 3 project rather than assuming a template. Use this whenever the user asks what is IN the CMS — "znajdź wszystkie realizacje z kategorią X", "ile mamy wpisów na blogu", "pokaż mi stronę oferta", "co jest w hero na stronie kontakt", "jakie bloki są na stronie głównej", "jakie bloki są w ogóle dostępne", "które strony mają wersję angielską", "czego brakuje w tłumaczeniu", "wypisz media bez alt", "gdzie używamy bloku heroBanner", "sprawdź globala stopka", "sprawdź czy ten slug jest zajęty", "wyeksportuj artykuły do JSON", "find all pages using block X", "list the blog posts", "show me what's on this page", "which documents are missing an EN translation", "count the articles", "export the media library", "what blocks are available" — and to audit content before a bulk edit or a migration. This skill only reads — it passes --read-only to the API client, which refuses any non-GET request. To create, change, upload, translate or delete anything, use payload-cms:payload-content instead.
allowed-tools: [Bash, Read, Glob, Grep, AskUserQuestion]
argument-hint: "[what to find, e.g. \"realizacje z kategorią LED\" or \"pages without an EN version\"]"
---

# Reading content from Payload

Answer questions about what is in a Payload CMS by querying its REST API. Nothing here changes anything — every call goes through `payload-api.mjs --read-only`, which refuses any request that is not a GET, so the contract is enforced mechanically rather than by intention.

Payload projects share an API and almost nothing else, so the collections, blocks and locales all come from **discovery at runtime**, not from assumption.

## 1. Locate the scripts

```
Glob: **/payload-content/scripts/payload-api.mjs   → API_SCRIPT
Glob: **/payload-content/scripts/lexical-md.mjs    → LEXICAL_SCRIPT
```
They live under the sibling skill because the write path needs all of them; resolve with Glob rather than hardcoding.

## 2. Map the project

Run steps 1–4 of the discovery routine — find the project, read `payload.config.ts`, index every slug in the source tree, resolve the base URL. That is the whole read-side subset; the remaining steps exist to make writes safe.

```
Glob: **/payload-content/references/discovery.md
```

Reads fall back to `http://localhost:3000` when no base is given. Say which base you used in your answer, because a local dev database and the deployed one hold different content, and an answer from the wrong one is worse than no answer.

## 3. Query

```bash
node "$API_SCRIPT" find articles --read-only \
  --where 'categories.slug=news' --select 'title,slug,publishedAt' --sort -publishedAt --limit 20
```

Operators, nesting, pagination and the rest: [references/querying.md](references/querying.md).

**Cost discipline.** These responses get large fast — a page document with a full block stack is tens of kilobytes.

- `--depth 0` (the default) leaves relationships as ids. Raise it only when you actually need the related document's fields.
- `--select a,b,c` trims the response to the fields you will use. On a listing question this is the difference between 2 KB and 200 KB.
- `--limit` deliberately. For a count, ask for `--limit 1` and read `totalDocs`.

## 4. Answer

| The user wants | The move |
|---|---|
| "znajdź / ile mamy / pokaż listę" | `find` with `--where` and `--select`; answer with a compact table. For a count, `--limit 1` and report `totalDocs` |
| "co jest na stronie X" | `find --where 'slug=X' --depth 1`, then walk the block array and describe it as a list of sections. Render rich text via `lexical-md.mjs --to-markdown` rather than pasting Lexical JSON |
| "jakie bloki są dostępne / co ma blok Y" | The block index from discovery, then read that one block's source file — and every field factory it imports, because a factory call hides the whole shape of the field it generates |
| "czego brakuje" (an audit) | `--locale all` and compare. A field is untranslated when its locale key is absent or null; `?locale=en` cannot tell you, because `fallback` serves the other language and it looks filled |

Present results as a table sized to the question, not as raw JSON. When a query returns more than it is useful to show, say how many there were and show the relevant slice.

## Reading rich text

A `richText` field is a Lexical editor state, and pasting it raw burns context and tells the user nothing:

```bash
node "$API_SCRIPT" get articles 12 --read-only --depth 0 --out /tmp/a.json --raw > /dev/null
node -e "console.log(JSON.stringify(require('/tmp/a.json').layout[1].body))" \
  | node "$LEXICAL_SCRIPT" --project-dir <project> --to-markdown
```

The conversion round-trips faithfully for everything markdown can express — headings, emphasis, links, lists, quotes, rules and embedded uploads. `--check` exits 1 if the tree holds a node type that would not survive, which on a read is a signal to describe that part rather than convert it.

## Two traps worth knowing before you query

**Filtering by `blockType` needs the right field.** `hero.blockType=heroBanner` and `layout.blockType=textWithImage` both work; naming a field whose block set does not contain that block — a hero block on the body field, or the reverse — answers **HTTP 500**, as does a block type that exists nowhere. A 500 here means wrong field, not "filtering is unavailable": check the block index for which field lists that block. The nested form `where[layout][blockType][equals]` answers 400; use the dotted path.

**A malformed `where` does not error — it widens the match.** A filter Payload cannot resolve is ignored, and everything comes back looking like a legitimate result. The client now rejects field names containing brackets and unknown operators, and warns when a filter matches every document in the collection. That warning is sometimes a true result, so read it rather than dismissing it — and never let an unverified count drive a bulk operation.

## When the question is actually a write

"Sprawdź, czy ten slug jest wolny, i jak tak, to dodaj stronę" starts here and ends somewhere else. Answer the read, then hand over to `payload-cms:payload-content` for the change — do not attempt the write from here; the client will refuse it anyway.
