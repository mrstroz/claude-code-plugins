---
name: payload-content
description: Create, update and delete content in a Payload CMS project through its REST API — new pages, blog posts and articles, edits to existing copy, composing and reordering the block/section stack, rich text written from markdown, media uploads with alt text, relationships, and per-locale translations. Discovers the project's collections, blocks, locales and auth mode at runtime, copies a real document as the shape template, backs up every document before overwriting it, and verifies each write by re-reading. Use this whenever the user wants to CHANGE what is in the CMS — "dodaj nowy wpis na blogu", "stwórz stronę o nas", "zmień tekst w hero na stronie oferta", "popraw opis w tej sekcji", "dodaj sekcję FAQ na stronie głównej", "przestaw bloki", "usuń ten blok", "wgraj te zdjęcia do media", "ustaw alt dla tych plików", "podmień zdjęcie w hero", "przetłumacz tę stronę na angielski", "uzupełnij wersję EN", "zaktualizuj globala stopka", "dodaj przekierowanie", "napisz artykuł i wrzuć go do CMS-u", "add a blog post", "create a page", "change the hero heading", "upload these images", "translate this page to English", "reorder the sections", "delete this document", "update the footer global" — and whenever Payload, payloadcms, the CMS, blocks, hero or the media library come up alongside a change to content. Also use it when content was drafted in the chat or sits in a markdown file and now has to land in Payload, and for bulk imports of many entries. It reads whatever it needs along the way, so a read that precedes a write belongs here. For read-only questions with no change intended — searching, counting, inspecting, auditing, exporting, "znajdź", "ile mamy", "pokaż", "sprawdź", "wyeksportuj" — use payload-cms:payload-query instead. It does not change the content MODEL — adding a field, a block type or a collection is a code change in the project's source, and migrations are left to the user.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion]
argument-hint: "[what to change, e.g. \"dodaj wpis na blogu o X\" or \"zmień hero na stronie oferta\"]"
---

# Writing content to Payload

Payload projects share an API and almost nothing else. Two real projects side by side had three collection slugs in common, one block slug — with entirely different fields — and opposite answers on whether a page's block array is localized. So this skill **discovers the content model at runtime** and hardcodes nothing beyond the REST contract itself.

The other thing that shapes every decision here: these projects typically have **no drafts and no version history**. A write is live the moment it lands and there is no undo but the backup you took a second earlier. That is why the loop below reads before it writes, diffs before it sends, and re-reads after.

## Credentials

`payload-api.mjs` resolves auth in this order:

- `PAYLOAD_API_KEY` (+ `PAYLOAD_API_KEY_COLLECTION` if the auth collection is not `users`)
- `PAYLOAD_TOKEN` — an existing JWT
- `PAYLOAD_EMAIL` + `PAYLOAD_PASSWORD` — logs in and caches the token

A project keeping its key in a gitignored `.env` that nothing loads can pass `--env-file .env`. If none of these is set, name all three routes and stop — do not try to work around missing credentials.

If the project has no API key support and the user wants one, that is an edit to the auth collection plus a migration. Describe what is needed and hand it back; do not make the change.

## The loop

### 1. Locate the scripts

```
Glob: **/payload-content/scripts/payload-api.mjs   → API_SCRIPT
Glob: **/payload-content/scripts/lexical-md.mjs    → LEXICAL_SCRIPT
```
Resolve with Glob rather than hardcoding — the plugin install path varies.

### 2. Map the project

Run the routine in [references/discovery.md](references/discovery.md) and hold its ~15-line session card in context. It costs about five tool calls once per session and answers the questions everything else depends on: which collections exist, what the body blocks field is called, whether it is localized, which locales there are, and where the deploy endpoint is.

Do not cache the card to a file. The content model changes the moment someone adds a block, and a stale card is exactly the kind of confidently-wrong input that produces a bad write.

### 3. Establish and state the target

```bash
node "$API_SCRIPT" whoami --base <url>
```

Read the output as a pair: **base URL and authenticated email.** Credentials are scoped to one database, so an API key from another environment resolves to nobody rather than erroring — `whoami` exits non-zero when that happens.

Ask the user which target before the first write of the session, showing the full URLs you found. Keep the choice for the session, and restate it before every destructive operation. The script refuses writes to a non-localhost host unless `--yes` is passed, so a live write is always a deliberate act.

### 4. Compose

| What you are building | Read |
|---|---|
| A page/post body — hero, sections, layout | [references/blocks.md](references/blocks.md) |
| A field type you have not seen in the template | [references/content-model.md](references/content-model.md) |
| Formatted text of any length | [references/richtext.md](references/richtext.md) |
| Images, video, anything with a file | [references/media.md](references/media.md) |
| A second language, or a translation | [references/localization.md](references/localization.md) |
| A call that failed | [references/troubleshooting.md](references/troubleshooting.md) |

A single leaf field on a document you already fetched needs none of them — go straight to step 5.

The rule that governs composition: **copy a real document as the shape template.** A fetched block carries the exact `blockType`, every field name including the ones a field factory generated, and values that already passed validation. Building one from the source file instead produces something structurally valid and semantically empty — Payload accepts it, and an empty band appears on the live site after the next deploy.

### 5. Write

Order matters:

1. Upload media, collect the returned ids.
2. Resolve relationship targets to ids.
3. Build the **complete** arrays in memory — never a partial one.
4. `--dry-run`, and read the diff.
5. One write.

```bash
node "$API_SCRIPT" update pages 12 --base <url> --locale pl --data-file /tmp/page.json --dry-run
node "$API_SCRIPT" update pages 12 --base <url> --locale pl --data-file /tmp/page.json --yes
```

`update` and `delete` save a backup to `.payload-backups/` first. Offer to add that directory to `.gitignore` the first time it appears — it holds full document snapshots.

There is no server-side dry run. Payload has no validation endpoint, so `--dry-run` shows what *would* be sent, never that the server would accept it.

### 6. Verify by re-reading

```bash
node "$API_SCRIPT" get pages 12 --base <url> --depth 0 --locale all
```

Three checks, every time:

1. The intended change landed.
2. The other locale's values are unchanged.
3. **The set of block/array row ids is identical to before.**

A 200 is not proof. Hooks rewrite values, `filterOptions` rejects references, and a changed row-id set means rows were recreated — which means the other locale just lost data, while the one you were looking at renders perfectly.

### 7. Report, and offer the deploy

Say what changed, in which locale, and where the backup is. Then: if the public site is statically generated, it will not change until someone publishes. Name the deploy endpoint from the session card and **offer** it.

Never fire it yourself. Publishing ships everyone's pending changes since the last deploy, not just yours.

## The rule with the worst failure mode

> **An update to a blocks or array field is a read-modify-write of the whole array with row `id`s intact.**

Row ids are how Payload matches an incoming row to the stored one. A row arriving without its `id` is a *new* row: Payload creates it and discards the old one along with everything hanging off it.

- Blocks array localized → you lose the other locale's entire stack.
- Blocks array not localized, leaves localized → you lose **every string in the other language** inside every block you touched.

No drafts, no versions, no warning in the admin. The symptom appears days later when someone opens the other language. `payload-api.mjs update` warns when the outgoing array carries fewer ids than the stored one — treat that warning as a stop.

## Guard rails

- **Read at `depth=0` whenever the read will become a write.** A `depth>=1` read returns populated relationship objects, and writing one back rewrites the related document. `--depth 0` is the script's default for exactly this reason.
- **Confirm before**: any write to a blocks array, any delete, any bulk (`where`-scoped) write, any write to a non-local base, any global write, and anything that publishes a locale.
- **List before bulk.** Run the same `where` as a `find`, show the ids and the count, and get a yes. One request, N documents, no undo.
- **Never retry a failed write.** On Workers/D1 a timeout can mean the write committed; a retried `POST` duplicates the document. Verify with a read, then decide.
- **Ask which locale** whenever the request does not name one. A user writing Polish on a project whose default locale is English will hit the English field by default, and the mistake is invisible until someone visits the site.
- **Strip every key ending in `Html`** from a copied template. Those are computed on read and rejected on write.

## Out of scope

- **The content model.** Adding a field, a block type or a collection is a source change in the project. Describe what is needed and hand it back.
- **Migrations.** Projects disagree sharply — one uses Drizzle dev-push locally and forbids `payload migrate`, another runs migrations-first and leaves them to the user. Read the project's `CLAUDE.md` and do neither.
- **Auth collections.** Creating or modifying admin accounts over the API is not this skill's job.
- **Firing the deploy hook.** Offer, never act.

## Raw API access

For anything the script does not cover — custom endpoints, `payload-preferences`, a plugin's own route — call the REST API directly with the same credentials. Reads run freely; anything that changes state gets the same treatment as above: state the target, back up, confirm, verify.
