# Mapping a Payload project you have never seen

Payload projects share an API and almost nothing else. Two real projects side by side had three collection slugs in common (`pages`, `media`, `users`), one block slug — whose fields were entirely different — and opposite answers on whether the page's block array is localized. Anything you assume instead of check is a coin flip, and on the write path a wrong coin flip is unrecoverable.

So: seven cheap steps, once per session, ending in a session card you keep in context.

**Doing read-only work?** Stop after step 4. Steps 5–7 exist to make writes safe.

## 1. Find the project

```bash
git rev-parse --show-toplevel
```
Then glob `**/payload.config.{ts,js,mjs}`, excluding `node_modules` — the extension is the project's choice. The config's directory is the Payload project, which is not always the repo root: one real project sits at the root, another is a child of a monorepo. More than one match means more than one Payload project: ask which.

## 2. Read `payload.config.ts` in full

One `Read`, and the highest fact-per-token step in the routine. It gives you the `collections` and `globals` arrays **and the import paths they come from**, `localization` (`locales`, `defaultLocale`, `fallback`), the root `editor`, `cors`, any custom top-level `endpoints`, the plugin list, and the database adapter.

Two things here decide whether the client can talk to the project at all:

- **`routes.api`** — `/api` is only the default. If the config overrides it, pass `--api-route <path>`.
- **Which collection has `auth: true`** — `users` is a convention, not a rule. If it is something else, pass `--auth-collection <slug>`.

Configs run 200–300 lines. Read the whole thing rather than grepping it — the parts you would skip are where the surprises live.

## 3. Index every slug in the source tree

Take the **source root from where the config actually lives** (`dirname` of `payload.config.ts`) rather than assuming `src/`, and match either quote style:

```bash
rg -n --glob '!node_modules' "slug:\s*['\"]" <source-root>
```

One command covers collections, globals and blocks at once, and it does not care how the project arranges them — flat, nested, grouped by feature, or declared inline. You get slug → file path for everything: typically 60–90 lines. Classify by path afterwards; the directory names are the project's choice, not Payload's.

If that returns nothing useful, the project builds slugs some other way (a factory, a constant, a generated list). Fall back to the import paths from step 2 and read the collection files themselves.

**Do not read a block file yet.** Reading them all costs tens of thousands of tokens and you will need at most two. The index tells you which two.

## 4. Base URL, and whether anything is listening

Candidates, in order: an explicit URL from the user → `PAYLOAD_BASE_URL` → `http://localhost:3000` (confirmed by a `next dev` script in `package.json`) → a URL in `.env` or `wrangler.jsonc`.

Probe the local candidate with a cheap authenticated read (`whoami`).

> **If localhost is dead, ask. Never promote a non-localhost candidate on your own.** Within reach in a typical repo are `SITE_URL`, `PREVIEW_URL`, a `workers.dev` name — and sometimes a production API key sitting in a gitignored `.env`. Falling through to one of those writes to a live site while the user believes they are testing. The mirror image is just as bad: the user wants a live fix, you write to an empty local database, and report success.

## 5. Auth mode

```bash
rg -n "useAPIKey|auth:" --glob '!node_modules' <source-root>
```
`auth: true` tells you which collection authenticates — pass it as `--auth-collection` when it is not `users`. `useAPIKey` present means the project supports `Authorization: <collection> API-Key <key>`; absent means email/password login is the only route. `payload-api.mjs` handles the handshake either way.

Then run `whoami` and read its output as a pair: **base URL and authenticated email**. An API key authenticates against whichever database holds that user, so a production key silently makes every request a production request. The URL alone does not tell you where you are.

If the project has no API key support and the user wants one, that is a change to the auth collection plus a migration — describe it and hand it back. Do not make it.

## 6. The body blocks field, and whether it is localized

Two questions with two different sources.

**The name comes from source.** Read the collection file you are targeting and find `type: 'blocks'`. Real projects call the body field `sections` or `layout`; the hero field is usually `hero` with `maxRows: 1`. Watch for `tabs` — they are presentational grouping, and the fields inside them are still top-level keys in the JSON.

**Whether it is localized comes from the live API:**

```bash
node payload-api.mjs find <collection> --limit 1 --depth 0 --locale all
```

A localized field comes back as `{pl: …, en: …}`; a non-localized one comes back as a bare value. This beats reading the source because it survives tabs, field factories and config-level overrides — and the same request hands you a real, already-validated block instance to copy, which is the foundation of everything in `blocks.md`.

## 7. The deploy endpoint and the project's own rules

```bash
rg -n -i "deploy|revalidate|webhook" --glob '!node_modules' <source-root>
```
Record whatever you find — a top-level endpoint, a global-scoped one, a stored hook URL, a revalidation route — or nothing, which is also an answer: a server-rendered site needs no publish step. **Do not call it.** Publishing is the user's decision, and it ships everyone's pending changes, not just yours.

Then read `CLAUDE.md` **in the Payload directory and at the git root** — one real project keeps it in the payload dir, another at the monorepo root. It carries the migration policy, the database gotchas, and whatever local convention overrides what this skill assumes.

## The session card

Condense all of it into ~15 lines and keep them in context. Every value below is a **placeholder showing the shape of the answer** — fill each one from what the steps above actually returned, and leave out any row the project has no equivalent for:

```
project        acme-cms  (/path/to/acme-cms)
base           http://localhost:3000      auth: API-Key as editor@example.com      LOCAL
locales        <code> (default), <code>   fallback: true|false
collections    <the slugs step 3 returned>
globals        <the slugs step 3 returned>
blocks         <n> indexed, in <the paths step 3 returned>
<coll>.hero    blocks, localized|NOT localized
<coll>.<body>  blocks, localized|NOT localized   ← the name differs per project
<coll>.slug    <this project's slug convention>
publish gate   <the field, if any, that makes a locale public>
deploy         <method and path>          (never fired automatically)
notes          <where CLAUDE.md lives; migration policy; anything that overrides defaults>
```

## Do not cache this

The instinct is to write the card to a file and skip the routine next time. Don't. The content model changes the moment someone adds a block, and a stale card is exactly the kind of confidently-wrong input that produces a bad write. Seven cheap steps once per session is the right price for knowing you are current.
