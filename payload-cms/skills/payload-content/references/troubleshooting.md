# When a call fails

`payload-api.mjs` flattens Payload's nested error shape into `path — message` lines and exits 1 on an HTTP error, 2 on usage/auth/guard problems, 3 on network failure. What each one usually means:

## `whoami` prints "user: NONE" and exits 2

The credentials are valid *syntax* but unknown at this base URL. Credentials live in one database, so a key created against production resolves to nobody against a local server — and `/me` answers **HTTP 200 with `user: null`** rather than erroring, which is why this check exists.

Fix the pairing, not the key: either point `--base` at the environment the key belongs to, or use credentials that exist where you are pointing. Reads may still work because most content collections are publicly readable — that is what makes this failure quiet.

## 401 / 403

The request reached Payload and was rejected. The script prints which auth mode it used. Check `whoami` first. A 403 on a write with a valid user usually means collection access control denies it — read the collection's `access` block rather than retrying.

## 404

Payload returns 404 both for an unknown collection slug and an unknown document id. Check the slug against your block/collection index before assuming the document is missing.

## `ValidationError` — the flattened lines

```
  layout.3.slides.0.image — The following field is invalid: image
```

The path is the fix. Common causes, in the order worth checking:

1. A `filterOptions` constraint on that field is not satisfied — see `media.md`. This is the most common and the least obvious, because the error names the parent document.
2. A required field is missing, or an array is under `minRows` / over `maxRows`.
3. A `select` got a label instead of its stored value.
4. A relationship or upload field got a populated **object** instead of an id — you read at `depth>=1` and wrote it straight back.
5. A `virtual: true` field was included. Strip every key ending in `Html`.
6. A rich-text value is a string or HTML rather than a Lexical editor state.

## HTTP 500 on a read

The query itself is malformed in a way the adapter cannot execute. The known case: **filtering by `blockType`** — `where[layout.blockType][equals]=heroSlider` returns 500 on the D1/SQLite adapter, for real and nonexistent block types alike. Fetch a page of documents and scan them locally instead.

## The response was not JSON

A Next.js dev server serves an HTML error page while it is still compiling. Safe to retry a **GET** once. Never retry a write on this.

## Unique constraint on a slug

Uniqueness may be global or per-locale, and one project's page slug is a full path where another's is a leaf segment. Check before writing:

```bash
node payload-api.mjs find pages --where 'slug=oferta/wynajem' --select slug --limit 1
```

## "too many SQL variables"

A single write carrying too many rows. D1 enforces SQLite's bind-parameter limit. Split the change — but split it along block boundaries you control, and re-read between writes so each one starts from current row ids.

## A timeout, or any network error, on a write

**Do not retry.** On Workers/D1 a request that timed out may have committed. A retried `POST` creates a duplicate document; a retried `PATCH` may re-apply against state you have not re-read. Verify with a `GET` first, then decide.

## The write succeeded but the site did not change

Expected, if the public site is statically generated. Content lands in the CMS immediately; the site rebuilds only when someone publishes. Report the deploy endpoint and offer — do not fire it. Publishing ships everyone's pending changes, not just yours.

## Something went wrong and there is no undo

Every `update` and `delete` writes a backup first, unless `--no-backup` was passed:

```bash
node payload-api.mjs update pages 12 --base <url> --yes \
  --data-file .payload-backups/pages-12-2026-08-04T10-15-00-000Z.json
```

The backup is taken at `depth=0&locale=all`, so it restores every locale. Restore promptly — the longer you wait, the more likely someone edited the document in the admin in the meantime.
