# حَقَّ تِلَاوَتِهِ — HAQQ TILAWATUHU

«رحلتك نحو إتقان تلاوة القرآن الكريم» — a free, public Tajweed learning platform. Open the link, choose a level, study, download, practise, take an exam and see the result — no account, no payment.

## Status (v2, 2026-11-26)

| Part | State | Verified how |
|---|---|---|
| Curriculum map: منهاج الدارسين (ط2، 2026) — 4 levels, 16 chapters, 101 lessons with page refs | Done | checked against the book's TOC and divider pages |
| Database (6 migrations): content, scientific review, question bank with versions, guest + account exams, partial/automatic/manual grading, progress, certificates (no Ijazah type), announcements, Academy tables; 0005 aligns grants/extension paths with the live project | Done | `npm run test:db:pglite` — **93 checks**, in an environment that mirrors the live Supabase project |
| Next.js static site (Arabic RTL): home, about, levels → chapters → lessons, encyclopedia, Academy, resources, announcements, search, certificate verification | Done | `npm run test:e2e` (public-site suite) |
| Exam player: guest/account attempts, all 11 part types, autosave, resume, server-synced timer, results with release rules, pending manual grading | Done | `npm run test:e2e` (exam-flow suite, against the real exam SQL) |
| Optional accounts + team dashboard: content editors, review queue, question bank, exam builder, grading, announcements, team roles | Done | `npm run test:e2e` (admin-flow suite, every role) |
| v1 solo-admin refactor: brand + mobile bottom nav, level hubs, hybrid live content (no rebuild after publishing), Supabase Storage uploads, one-click publishing, auto-graded questions only | Done | `npm run test:db:pglite` (120 checks) and `npm run test:e2e` |
| Optional Pages Function `/api/rebuild` (refresh pre-rendered pages) | Built | needs a deploy hook in Cloudflare |
| Lesson content (transcription + scientific review) | Not started | all 101 seeded lessons are drafts; nothing is public until reviewed |

## Docs

* `docs/02-architecture.md` — architecture, zero-cost hosting and its limits
* `docs/06-frontend.md` — how the static frontend, client-only routes and tests work
* `docs/05-revision-2026-11-26.md` — what changed from the multi-mosque design and why
* `docs/04-roadmap.md` — release plan
* `docs/03-database.md` — migrations and function reference
* `docs/01-curriculum-analysis.md` — curriculum findings and reviewer questions
* `docs/content/about.ar.md` — About page text

## Develop

```bash
npm install
npm run dev            # http://localhost:3000 (downloads + verifies the Tanzil text first)
npm run build          # static export to out/ (reads PUBLISHED content from Supabase)
npm run preview        # serves out/ + functions/ on the Cloudflare Pages emulator
```

## Checks

```bash
npm run typecheck      # app + Pages Functions
npm run lint
npm test               # unit tests (Quran bundle, references, routes, question schemas)
npm run test:db:pglite # 120 DB checks + test-seed round trip, in-process (no Docker)
npm run test:e2e       # builds from a local Supabase stand-in (PGlite) and runs the browser suites — never the live DB
```

`test:e2e` leaves a TEST build in `out/` — run `npm run build` again before deploying.

## Backend setup (Supabase Free)

1. Apply the migrations (`supabase db push`, or paste them in order in the SQL editor), including `20261126000500_live_api_grants.sql` and `20261127000600_solo_admin_materials.sql` (creates the private `materials` storage bucket and its policies).
2. Run `supabase/seed/0001_minhaj_al_darisin.sql` (curriculum structure; `db push` does not run seeds).
3. Make yourself super admin: `insert into platform_role_assignments (user_id, role) values ('<your user id>', 'super_admin');`
4. Check what visitors can see (read-only): `node --env-file=.env.local scripts/check-live-access.mjs`

Optional test data (reversible, run by you in the SQL editor): `scripts/test_seed.sql` adds one published lesson and three published exams marked «[تجريبي]»; `scripts/test_seed_cleanup.sql` removes them and every attempt on them.

## Deploy (Cloudflare Pages Free)

| Setting | Value |
|---|---|
| Build command / output | `npm run build` / `out` |
| Build env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Functions vars (optional) | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (same public values) and secret `PAGES_DEPLOY_HOOK_URL` — only for "refresh pre-rendered pages"; published content is live without it |
| File storage | Supabase Storage bucket `materials` (migration 0006) — no Cloudflare R2 needed |
| Supabase Auth | Site URL and redirect URL: `https://<your-site>/account/` |

## Rules

* Postgres enforces every permission (RLS + checked functions); the static site holds no secrets.
* No answer key reaches a learner before the exam's release setting allows it.
* Nothing is public until a scientific reviewer approves it; curriculum-derived content keeps its page reference.
* Quranic text is rendered only from the checksum-verified Tanzil Uthmani text (Hafs), by reference — never hand-typed or copied from the PDF.
* Platform certificates are educational certificates, never an Ijazah.
* The platform is independent; using the Ministry's published curriculum does not imply affiliation.
