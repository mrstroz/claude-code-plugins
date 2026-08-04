# Mapping a Payload project you have never seen

Payload projects share an API and almost nothing else. Two real projects side by side had three collection slugs in common (`pages`, `media`, `users`), one block slug — whose fields were entirely different — and opposite answers on whether the page's block array is localized. Anything you assume instead of check is a coin flip, and on the write path a wrong coin flip is unrecoverable.

So: eight cheap steps, once per session, ending in a session card you keep in context.

**Doing read-only work?** Stop after step 4. Steps 5–8 exist to make writes safe.

## 1. Find the project

```bash
git rev-parse --show-toplevel
```
Then glob `**/payload.config.ts`, excluding `node_modules`. The config's directory is the Payload project — which is not always the repo root. One real project sits at the root; another is a child of a monorepo. More than one match means more than one Payload project: ask which.

## 2. Read `payload.config.ts` in full

One `Read`, and the highest fact-per-token step in the routine. It gives you the `collections` and `globals` arrays, `localization` (`locales`, `defaultLocale`, `fallback`), the root `editor`, `cors`, any custom top-level `endpoints`, the plugin list, and the database adapter. Configs run 200–300 lines. Read the whole thing rather than grepping it — the parts you would skip are where the surprises live.

## 3. Collection and global slugs

```bash
rg -o "slug: '[^']+'" src/collections src/globals
```
About 25 lines mapping slug to file. Collections declared inline in the config are already covered by step 2.

## 4. Index the blocks — index only

```bash
rg -n "slug: '" src/blocks/
```
Recursive, so it handles both a flat `src/blocks/*.ts` and a nested `src/blocks/{,sections/,blog/}`. You get slug → file path for every block: 30–40 lines.

**Do not read a block file yet.** Reading all of them costs tens of thousands of tokens and you will need at most two. The index tells you which two.

## 5. Base URL, and whether anything is listening

Candidates, in order: an explicit URL from the user → `PAYLOAD_BASE_URL` → `http://localhost:3000` (confirmed by a `next dev` script in `package.json`) → a URL in `.env` or `wrangler.jsonc`.

Probe the local candidate with a cheap authenticated read (`whoami`).

> **If localhost is dead, ask. Never promote a non-localhost candidate on your own.** Within reach in a typical repo are `SITE_URL`, `PREVIEW_URL`, a `workers.dev` name — and sometimes a production API key sitting in a gitignored `.env`. Falling through to one of those writes to a live site while the user believes they are testing. The mirror image is just as bad: the user wants a live fix, you write to an empty local database, and report success.

## 6. Auth mode

```bash
rg -n "useAPIKey" src/collections/
```
Present means the project supports `Authorization: <collection> API-Key <key>`. Absent means email/password login is the only route, and `payload-api.mjs` handles the handshake either way.

Then run `whoami` and read its output as a pair: **base URL and authenticated email**. An API key authenticates against whichever database holds that user, so a production key silently makes every request a production request. The URL alone does not tell you where you are.

If the project has no API key support and the user wants one, that is a change to `Users.ts` plus a migration — describe it and hand it back. Do not make it.

## 7. The body blocks field, and whether it is localized

Two questions with two different sources.

**The name comes from source.** Read the collection file you are targeting and find `type: 'blocks'`. Real projects call the body field `sections` or `layout`; the hero field is usually `hero` with `maxRows: 1`. Watch for `tabs` — they are presentational grouping, and the fields inside them are still top-level keys in the JSON.

**Whether it is localized comes from the live API:**

```bash
node payload-api.mjs find <collection> --limit 1 --depth 0 --locale all
```

A localized field comes back as `{pl: …, en: …}`; a non-localized one comes back as a bare value. This beats reading the source because it survives tabs, field factories and config-level overrides — and the same request hands you a real, already-validated block instance to copy, which is the foundation of everything in `blocks.md`.

## 8. The deploy endpoint and the project's own rules

```bash
rg -n "deploy" src/endpoints src/globals src/payload.config.ts
```
Record whatever you find — a top-level endpoint, a global-scoped one, a stored hook URL. **Do not call it.** Publishing is the user's decision, and it ships everyone's pending changes, not just yours.

Then read `CLAUDE.md` **in the Payload directory and at the git root** — one real project keeps it in the payload dir, another at the monorepo root. It carries the migration policy, the database gotchas, and whatever local convention overrides what this skill assumes.

## The session card

Condense all of it into ~15 lines and keep them in context:

```
project        ledlive-payload  (/home/mstroz/apps/extra/ledlive/ledlive-payload)
base           http://localhost:3000      auth: API-Key as biuro@ledlive.pl      LOCAL
locales        pl (default), en           fallback: true
collections    pages articles realizations media logos marquees map-links
               categories article-categories redirects quote-requests users
globals        navigation footer-navigation footer settings deployment
blocks         38 indexed (src/blocks/), factories in src/fields/
pages.hero     blocks, NOT localized
pages.layout   blocks, NOT localized   ← structure shared across locales; leaves are localized
pages.slug     full path, no leading slash, empty = home
publish gate   localeReady (localized checkbox) is what mints the /en/ URL
deploy         POST /api/deploy-site      (never fired automatically)
notes          CLAUDE.md at monorepo root; push:false — the USER runs migrations
```

## Do not cache this

The instinct is to write the card to a file and skip the routine next time. Don't. The content model changes the moment someone adds a block, and a stale card is exactly the kind of confidently-wrong input that produces a bad write. Eight cheap steps once per session is the right price for knowing you are current.
