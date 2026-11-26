# Frontend (updated 2026-11-27 — v1 solo-admin refactor)

Next.js 16 App Router with `output: 'export'`, Tailwind 4, supabase-js. No Server Actions, no `src/app/api/`, no middleware: static files plus one Cloudflare Pages Function (`/api/rebuild`, optional).

## Layers

| Layer | Where | Holds secrets? |
|---|---|---|
| Static site (HTML/JS) | `src/app/` → `out/` | no — only the public anon key |
| Pages Function | `functions/api/rebuild.ts` (optional pre-render refresh) | deploy hook |
| Authorization, grading, storage rules | Supabase (RLS, SQL functions, Storage policies) | — |

## Hybrid content: pre-rendered, then live

* **Build:** `src/lib/content/site.ts` loads one snapshot through the anonymous role (RLS ⇒ published only) and pre-renders levels, chapters, lessons, academy, resources, announcements — fast, indexable, readable while the free DB is paused. Lesson verses are resolved at build time from the verified Tanzil bundle.
* **Browser:** `src/lib/content/live.ts` loads a *light* snapshot (no lesson bodies) once per page and swaps it in; a lesson page fetches its own full row if it changed. Newly published content appears and archived content disappears **without a rebuild**. If the DB is unreachable, the pre-rendered content stays.
* **New items:** links point to the pre-rendered URL when the item was in the build, otherwise to the live routes `/learn/?level=…&chapter=…&lesson=…` and `/academy/item/?type=…&key=…`. A shared canonical URL of a not-yet-built lesson lands on the 404 page, which forwards to `/learn/`.
* `/exams`, `/exams/:id`, `/attempts/:id`, `/certificates/:id`, `/account`, `/admin` are client-only as before.

## Files (Supabase Storage)

Uploads go from the admin UI straight to the private bucket **`materials`** (`src/components/admin/UploadWidget.tsx`, rules in `src/lib/admin/upload-rules.ts`). Storage RLS (migration 0006): insert/update/delete = super admin; read = only objects referenced by a **published** resource. Visitors get short-lived signed URLs (`ResourceItem`), so draft files can never be downloaded. Cloudflare R2 is no longer used (existing `r2` rows still render if `NEXT_PUBLIC_FILES_BASE_URL` is set).

## Solo admin (v1)

* Sidebar: الملفات والملخصات · الدروس · بنك الأسئلة والاختبارات · الإعلانات · الأكاديمية والفريق.
* The super admin publishes / archives / returns to draft in one click (`publish_content()`, recorded in `review_events`). The two-person review path, assignments, comments and `/admin/review/` remain for a future team.
* Essay/audio question types are rejected in the question builder; `/admin/grading/` is hidden from the sidebar (route, SQL and player support remain).
* New formal exams default to "requires account"; practice exams stay open to guests.

## Quranic text

`scripts/quran-setup.mjs` downloads/verifies the Tanzil Uthmani v1.1 text (SHA-256 over LF-normalized content, so Windows and Linux checkouts agree) and writes `public/quran/`. Text appears only via references.

## Tests without the live database

* `npm run test:db:pglite` — shim + migrations 0001–0006 + seed; `supabase/tests/10_*` (93 checks) and `20_*` (27 checks: direct publishing, level files, storage permissions, answer keys, guest attempt); then the test seed round trip.
* `npm run test:e2e` — starts `tests/e2e/fake-supabase-server.mjs` (PGlite + real schema + `tests/fixtures/e2e-content.sql`, serving REST/Storage/Auth), **builds the site from it**, serves `out/` with `wrangler pages dev`, and runs the browser suites. Static and live data come from the same database, so the hybrid behaviour (publish/archive without rebuild, DB-down resilience) is tested for real.

## Known workarounds

* **Windows builds:** `scripts/postbuild-flatten-segments.mjs` fixes Next 16 segment-prefetch file names (no-op on Linux).
* **Audio answers:** not available to learners (no storage path for recordings in v1).
