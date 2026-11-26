# Frontend (2026-11-26)

Next.js 16 App Router with `output: 'export'`, Tailwind 4, supabase-js. No Server Actions, no `src/app/api/`, no middleware: the site is static files plus two Cloudflare Pages Functions.

## Three layers, kept separate

| Layer | Where | Holds secrets? |
|---|---|---|
| Static site (HTML/JS) | `src/app/` → `out/` | no — only the public anon key |
| Pages Functions | `functions/api/upload.ts`, `functions/api/rebuild.ts` | R2 binding, deploy hook |
| Authorization + grading | Supabase (RLS + SQL functions) | — |

The Functions authorize by calling `is_content_staff()` / `is_publisher()` with the caller's token, so Postgres stays the single source of truth.

## Content pages are built, not queried

`src/lib/content/site.ts` loads one snapshot per build through the **anonymous** client, so RLS guarantees only `status = 'published'` content can be exported (a second filter in code is defence in depth). Any DB error fails the build. Dynamic routes with no published rows export a `_` placeholder page (export mode rejects empty `generateStaticParams`). Publishing → "rebuild site" → `/api/rebuild` → Pages deploy hook.

Lesson URLs use codes from the schema: `/levels/<level.code>/<chapter.code>/<lesson.code>/`.

## Client-only routes

`/exams/:id`, `/attempts/:id`, `/certificates/:id` are exported once as `/<route>/_/`. `public/_redirects` rewrites (status 200) any id to that shell; `next dev` mirrors it with dev-only rewrites. The page reads the id from `window.location` (`src/lib/shell-route.ts`), so direct open, refresh and links all work. Links to these routes are plain `<a>`.

## Exams

All grading, release rules and key hiding happen in SQL. The browser keeps a guest attempt's one-time token in `localStorage` (`src/lib/exams/attempt-store.ts`) to resume, submit, reopen results and later claim the attempt into an account. Unsaved answers are kept locally until the server confirms them. The timer uses `server_now` from the paper; the server enforces the deadline.

## Quranic text

`scripts/quran-setup.mjs` (runs before dev/build) downloads the Tanzil Uthmani v1.1 text, refuses to continue unless the SHA-256 matches the pinned value, and writes `public/quran/<surah>.json` verbatim with Tanzil's copyright block. Text appears only via references (`quranic_examples`, question `quran_ref`, or `[[quran:2:121]]` in Markdown). `quranic_examples.display_text` is not used.

## Testing without the live database

* `npm run test:db:pglite` — PGlite (Postgres in WebAssembly) runs the shim, all migrations, the seed and the 93 DB checks; then the test seed and its cleanup.
* `npm run test:e2e` — builds from `tests/fixtures/site.fixture.json` (`HAQQ_CONTENT_FIXTURE`, refused on Cloudflare builds), serves it with `wrangler pages dev`, and routes every `/rest/v1` call to PGlite running the real schema (`tests/e2e/pglite-api.mjs`).
* `tests/fixtures/exam-fixture.mjs` is the single source for the e2e exams and `scripts/test_seed.sql`.

## Known workarounds

* **Windows builds:** Next 16 writes segment-prefetch files into nested folders on Windows; `scripts/postbuild-flatten-segments.mjs` renames them to the flat names the router requests. No-op on Linux (Cloudflare).
* **Audio answers:** `audio_response` parts show "not available yet" — there is no storage path for learner recordings in the schema.
