# Locales

## Reading

`?locale=all` is the honest read. It returns every localized field as `{pl: …, en: …}` and every non-localized one as a plain value — **at any nesting depth**, so localized leaves inside a non-localized block array show up as `{pl, en}` while their siblings stay plain. One request maps the whole document's localization.

An untranslated field either **omits the locale key entirely** or holds `null`:

```jsonc
{ "title": { "pl": "Home v2" },          // no `en` key — not translated
  "slug":  { "pl": null } }              // present but empty — also not translated
```

`?locale=en` cannot tell you this. With `fallback: true` a missing English value is served as the Polish one, so **a field that looks filled in English may just be the fallback**. Any question of the form "is this translated?" or "what still needs translating?" has to be answered from `locale=all`.

Set `--fallback-locale none` when you specifically want to see the holes at a single locale.

## Writing

One `PATCH` per locale, with `?locale=<code>`.

A write at `?locale=en` sets the English values of localized fields **and overwrites non-localized fields globally**. There is no locale-scoped write for a non-localized field — if you send `slug` in an English write and `slug` is not localized, you changed it for everyone.

## The difference that decides everything

Whether the **blocks array itself** is localized changes what a per-locale write does. Both arrangements are common, and they need opposite handling:

| | Blocks array **is** localized | Blocks array is **not** localized (leaves are) |
|---|---|---|
| What the two locales hold | Completely different block stacks | The same stack, different text |
| What `?locale=en` writes | Only the EN stack; the other locale is untouched | **The structure for both locales**; localized leaves for EN only |
| Translating a page means | Build a fresh EN array — **omit all row `id`s**, since the rows are per-locale | Re-send **the same array with row `id`s intact**, changing only the localized leaves |
| Worst case if you get it wrong | The EN stack is replaced | **Every string in the other language, inside every block you touched, is gone** |

Determine which you are in with one read (`?locale=all`, step 7 of `discovery.md`) **before** composing anything. Then say which it is in the plan you show the user, because the two produce different-looking diffs and the user should be able to catch a mismatch.

## Locale order is not a given

Projects differ on both the list and the default — `['en','pl']` defaulting to `en` in one, `['pl','en']` defaulting to `pl` in another. Never assume index 0 is the primary language, and never assume the default locale matches the language the user is speaking.

That last point is a live trap: a user writing Polish, on a project whose default locale is English, saying "zmień tekst na stronie" most likely means the **English** field, because that is what an unqualified write hits. **Ask which locale whenever the request does not name one.** One question costs a sentence; the failure — Polish copy sitting in the English field — is invisible until somebody visits the site.

## Publishing a locale is a separate decision

A project may gate a language behind its own field — a localized `localeReady` checkbox, a status, a per-locale publish flag — and that field, not the presence of translated text, is what mints the public URL.

Ticking it is a publishing decision, not a side effect of translating. Confirm it separately, and say plainly what it will do: after this, `/en/...` goes live.
