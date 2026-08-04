# Media uploads

An upload collection takes `multipart/form-data` with exactly two parts: `file` (the binary) and `_payload` (a JSON **string** holding every non-file field). `payload-api.mjs upload` assembles both:

```bash
node payload-api.mjs upload media --file ./hero.jpg \
  --base http://localhost:3000 --yes \
  --data '{"alt":"Ekran LED na elewacji biurowca","category":"hero"}'
```

The response carries the new document's `id`, `url`, `filename`, `mimeType`, `filesize`, `width` and `height`. The `id` is what you put into an upload field.

## `alt` is content, not metadata

Upload collections commonly mark `alt` required, so a missing one fails the upload outright. Generate it from context — but **show it to the user before sending**. Alt text is published copy: it is read aloud by screen readers and indexed by search engines, and a plausible-sounding wrong description ships as easily as a right one.

## No image sizes

These projects run on Workers without `sharp`, so `crop` and `focalPoint` are off and **no size variants are generated**. The response has no `sizes` object — do not reach for `sizes.card.url`. One file, one URL.

## Treat `url` as opaque

Payload de-duplicates filenames by appending `-1`, `-2`, so a second `hero.jpg` is stored as `hero-1.jpg`. Never build a URL from the name you uploaded; use the `url` the response gives you. `payload-api.mjs upload` says so explicitly when the stored filename differs from what you sent.

## The `filterOptions` trap

This is the failure whose symptom does not point at its cause.

An upload field can restrict which media documents it accepts:

```ts
{ name: 'image', type: 'upload', relationTo: 'media',
  filterOptions: { category: { equals: 'hero' } } }
```

That constraint is re-validated **when the parent document is saved**, not only when the admin picker is open. So:

1. You upload a file with no `category`. It succeeds.
2. You reference it from a hero slide and save the page. **The page save fails**, and the error names the *page*, not the file.

Some projects deliberately give such fields no `defaultValue`, because a Payload default becomes a column default and changing one later forces a SQLite table rebuild that a hosted D1 cannot perform on a populated table. So the empty value is intentional and will not fix itself.

**Before referencing any media document from an upload field:**

1. Read that field's `filterOptions` in the block or collection source.
2. Either pick a document that already satisfies it —
   `node payload-api.mjs find media --where 'category=hero' --select 'filename,alt' --limit 10`
   — or update the document's field first, before the parent save.

Most upload fields also constrain `mimeType` (`contains: 'image'`, `contains: 'video'`). A PDF in a picture field fails the same way, at the same late moment.

## Bulk uploads run one at a time

Concurrent writes contend on D1, and large batches hit SQLite's variable limit. Upload sequentially and report each returned id as it lands, so a partial failure leaves the user knowing exactly what exists.

## Before deleting media, check what points at it

A required upload foreign key is typically `ON DELETE SET NULL` against a `NOT NULL` column, so deleting a referenced image can leave the parent document unloadable. Look first:

```bash
node payload-api.mjs find pages --where 'hero.slides.image=42' --select slug --depth 0
```

Check every collection and every field that could reference the id. If anything does, fix the reference before deleting — or leave the file alone and say why.
