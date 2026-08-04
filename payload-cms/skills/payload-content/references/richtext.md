# Rich text (Lexical)

A `richText` field holds a full Lexical editor state — never a string, never HTML. Hand-writing that JSON for anything longer than a sentence is slow and goes wrong in ways that only show up on the live site.

**Use `lexical-md.mjs` in both directions.** Markdown is the working representation: a ten-paragraph body is ~2 KB of markdown against ~15 KB of Lexical, and the round-trip is byte-identical for everything markdown can express.

```bash
# markdown → Lexical, refusing anything that would not survive
node lexical-md.mjs --project-dir <project> --in body.md --out body.json --check

# Lexical → markdown, for reading content without drowning in JSON
node payload-api.mjs get articles 12 --depth 0 --out /tmp/a.json --raw > /dev/null
node -e "console.log(JSON.stringify(require('/tmp/a.json').layout[1].body))" \
  | node lexical-md.mjs --project-dir <project> --to-markdown
```

The script resolves `@payloadcms/richtext-lexical` from the **target project's** `node_modules`, so the converter is always the same version as the validator. It refuses to fall back to another copy.

## What round-trips

`root`, `paragraph`, `heading`, `text`, `linebreak`, `tab`, `link`, `autolink`, `list`, `listitem`, `quote`, `horizontalrule`, `upload`.

An upload node is `![media:<id>]()` in markdown and comes back as a real upload node — so images inside a body survive the trip.

Anything else — `relationship` nodes, inline blocks — does not. `--check` reports the node types and exits 1 when it finds one outside the safe set, because losing a node silently out of an article body is worse than a loud refusal. When you hit that, edit the field as Lexical JSON instead of converting it.

## Node shapes, for hand-patching a single node

```jsonc
{ "root": { "type": "root", "format": "", "indent": 0, "version": 1, "direction": "ltr",
  "children": [

    { "type": "heading", "tag": "h2", "version": 1,
      "format": "", "indent": 0, "direction": null, "children": [ /* text nodes */ ] },

    { "type": "paragraph", "version": 1, "textFormat": 0, "textStyle": "",
      "format": "", "indent": 0, "direction": null, "children": [ /* text nodes */ ] },

    { "type": "text", "text": "bold", "format": 1,
      "detail": 0, "mode": "normal", "style": "", "version": 1 },

    { "type": "link", "version": 3, "format": "", "indent": 0, "direction": null,
      "fields": { "linkType": "custom", "url": "https://example.com", "newTab": false },
      "children": [ /* text nodes */ ] }
  ] } }
```

`format` on a **text** node is a bitmask: bold 1, italic 2, strikethrough 4, underline 8, inline code 16, subscript 32, superscript 64. Combine by adding — bold italic is 3. `format` on a *block* node is an alignment string, which is a different field with the same name.

An empty field is a `root` with one empty `paragraph`, not `null` and not `{}`.

## Links: use `linkType: 'custom'`

`linkType: 'internal'` stores a document reference that the frontend has to resolve. A hand-rolled serializer that does not implement it renders `href="#"` — a dead link that looks fine in the admin. The converter emits `custom` with an explicit `url`, which is the safe default. Before using `internal`, check that the frontend's serializer actually handles it.

The same caution applies to `relationship` nodes: they are valid Lexical and some frontends drop them entirely.

## Blocks inside rich text

The default feature set has no `BlocksFeature`, so a rich-text field cannot contain Payload blocks unless the project added it. Check the `editor:` argument in `payload.config.ts` and any per-field override before assuming otherwise.

## Restricted editors

A block can narrow its own editor — reserving h1 for the hero and allowing only h2–h4 in the body is common:

```ts
editor: lexicalEditor({ features: ({ defaultFeatures }) => [
  ...defaultFeatures.filter((f) => f.key !== 'heading'),
  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
]}),
```

Pass the same restriction to the converter:

```bash
node lexical-md.mjs --project-dir <project> --headings h2,h3,h4 --in body.md
```

**A `#` in the markdown then becomes a plain paragraph, silently** — the text survives but stops being a heading. So write the markdown at the levels the block allows: start at `##`. Check for per-field `editor:` overrides with `rg -n "lexicalEditor" <source-root>` before converting a long body.

## The `<name>Html` sibling

Some projects pair each rich-text field with a `virtual: true` `<name>Html` field that renders the Lexical to HTML in an `afterRead` hook. It appears in every read and is rejected on every write. Strip every key ending in `Html` before sending a copied template back.
