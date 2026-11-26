# حَقَّ تِلَاوَتِهِ — Architecture (v2: free, public, unified)

Revised 2026-11-26 after the change of direction (see `05-revision-2026-11-26.md`).

## 1. Product in one sentence

A student receives a link from their teacher, opens it on a phone, chooses a level, studies a lesson, downloads its files, practises, takes an exam and sees the result with corrections — **no account, no payment, no mosque registration**.

## 2. Shape of the system

```
                ┌──────────────── Cloudflare Pages (free) ────────────────┐
 Browser  ───►  │ Static Next.js export: every level, chapter, lesson,    │
 (phone)        │ encyclopedia entry and academy letter is a pre-built     │
                │ HTML page + a pre-built Arabic search index (JSON).      │
                │ Pages Functions: /api/upload (R2), /api/rebuild          │
                └──────────────────────────────────────────────────────────┘
     │ downloads PDFs / audio                │ exams, optional sign-in, admin
     ▼                                       ▼
 Cloudflare R2 (free, no egress fees)    Supabase Free: Postgres + Auth
 YouTube embeds for video                 (RLS + SECURITY DEFINER functions)
                                               ▲
                     GitHub Actions (scheduled): keep-alive + nightly backup
```

**Why static first.** Reading is 95 % of traffic. Serving it as pre-built pages means reading costs nothing, never touches the database, survives traffic spikes, and **keeps working even if the free database is paused**. The database is used only for what must be live: exams, grading, the admin/review workflow and optional accounts.

**Rebuild on publish.** When a review admin publishes content, the admin dashboard calls `/api/rebuild` (a Pages Function that checks the caller is a publisher, then calls the Pages deploy hook). The build reads published content through the public API (RLS already hides drafts) and regenerates the site.

## 3. What needs an account

| Feature | Guest | Optional account | Team account |
|---|---|---|---|
| Browse levels, lessons, encyclopedia, academy; download files; watch/listen | ✓ | ✓ | ✓ |
| Practice exercises and exams, results, corrections, explanations | ✓ (unless an exam is marked account-only) | ✓ | ✓ |
| Progress & bookmarks | kept in the browser | synced across devices | |
| Exam history | in this browser (attempt links) | synced; can claim earlier guest attempts | |
| Level completion certificate | — | ✓ | |
| Admin: content, files, questions, exams, review, announcements, team roles | | | by role |

## 4. Roles (platform team only)

| Role | Can |
|---|---|
| super_admin | everything, incl. granting/removing team roles, settings, revoking certificates |
| scientific_review_admin | assign reviewers, publish/archive reviewed content, review |
| scientific_reviewer | review and approve content and answer keys (never their own) |
| content_editor | write lessons, examples, files, encyclopedia, academy, questions, exams |
| grader | grade manually marked answers (essay, audio) |
| moderator | announcements |

## 5. Content & scientific review (unchanged in spirit)

Curricula → editions → levels → chapters → lessons are data (new curricula/riwayat need no code). Every reviewable item — lessons, Quranic examples, files, encyclopedia entries, academy letters / articulation points / characteristics, question versions with their answer keys — follows one state machine:

```
draft ⇄ submitted → under_review → approved → published → archived
            ↑             ↓
            └── changes_requested (comment required)
```

Only `transition_content()` changes status; content is frozen outside draft; every step stores a full snapshot; reviewers cannot approve their own work; **only approved content is published, so everything the public sees is scientifically verified**. Quranic text is never hand-typed: examples are stored by `surah:ayah[:word]` and rendered from a verified Uthmani source.

## 6. Exams without registration

* `start_attempt(exam)` works for guests. A new guest attempt returns a random **one-time token**; only its SHA-256 hash is stored. The browser keeps the token (localStorage) to resume after a dropped connection, submit, and reopen the result.
* Papers never contain answer data; keys sit in a table guests and learners cannot read; grading runs in Postgres; double submission is harmless; time limits are enforced server-side.
* Results and model answers follow each exam's settings (immediate / on a date / manual release; model answers never / after submission / after release / after the exam closes).
* Partial marks per part; essays and audio go to a **grading queue** for platform graders; the guest sees "pending" until then and the final score afterwards via the same link.
* **Abuse limits without accounts:** new guest attempts are rate-limited per network address (default 30/hour, stored only as a salted hash) plus a global hourly ceiling; guest attempts are deleted after 30 days by opportunistic clean-up (no cron needed).
* Honest limit: for guests, "max attempts" cannot be enforced (a new browser is a new guest). Exams that must limit attempts — and level-final exams that lead to certificates — are marked **account-only**.

## 7. Progress, certificates, Ijazah

Progress for guests lives in the browser; with an account it syncs, and browser progress can be imported (viewed/completed only). Practice, assessment and mastery are written only by grading; mastery needs practice + a passed formal exam + ≥ 2 questions + ≥ 80 % (tunable). Level certificates require an account, all published lessons of the level completed and a passed level-final exam. There is **no Ijazah certificate type**; titles containing «إجازة» are rejected; verification shows «هذه شهادة تعليمية وليست إجازة قرآنية».

## 8. Hosting at zero cost — and its honest limits

| Piece | Free service | Free allowance (checked 2026-11-26) | What happens when exceeded |
|---|---|---|---|
| Website (static pages, search index) | Cloudflare Pages on `*.pages.dev` | unlimited bandwidth and static requests; 500 builds/month; max 20,000 files per site; 25 MiB per file | builds queue/fail past 500/month; very large sites need splitting or a paid plan |
| PDFs, audio, large images | Cloudflare R2 | 10 GB storage, 1 M writes, 10 M reads per month, no egress fees | storage beyond 10 GB is billed per GB |
| Video | YouTube embeds | free | — |
| Database, auth, small images | Supabase Free | 500 MB database, 1 GB file storage, 5 GB egress, 50,000 monthly active users | project goes over quota → upgrade needed |
| Keep-alive + nightly backup | GitHub Actions (scheduled) | free for public repositories; limited minutes for private ones | — |

**Supabase Free pauses** a project after a week of low database activity and keeps no backups. Mitigations: the scheduled keep-alive writes to `heartbeat` daily; a nightly `pg_dump` goes to the repository; a paused project can be resumed from the dashboard. Because pages are static, **reading never stops** — only exams, sign-in and admin would wait for a resume.

**Rough capacity on the free database** (estimates, to be measured): an exam attempt (paper + saves + result) is ~50 KB of API traffic and ~3 KB stored. 5 GB egress ≈ 100,000 attempts/month; 500 MB ≈ 100,000+ guest attempts retained for 30 days alongside the content. Watch the Supabase usage page; the first upgrade trigger will most likely be egress from exams or database size from attempts — lower `guest_attempt_retention_days` first, upgrade second.

**Upgrade path without rewrites:** Supabase Pro ($25/month) removes pausing and raises quotas; the static site and R2 stay free. Everything is standard Postgres + static files, so moving hosts is a data dump and a redeploy.

## 9. Search

Built into the static site: the build emits a compact JSON index of published titles, definitions and text, normalized with `normalizeArabic()` (TypeScript, parity-tested against the SQL `normalize_arabic()`), searched in the browser — zero database cost, works offline once cached. `search_content()` in SQL remains for the admin dashboard.

## 10. Mobile & PWA

Mobile-first RTL layouts, 44 px minimum touch targets, reduced motion, dedicated Quran font class. Static pages make the PWA straightforward: a service worker can cache visited lessons for offline reading. Exams stay online (autosave + resume cover flaky networks).

## 11. Security summary

Postgres is the authorization boundary (RLS on all 40 tables, privileged steps in checked functions, internal functions not executable through the API — tested). Guests are identified per attempt by a hashed token, never by personal data. Secrets (service key, deploy hook, R2 credentials) live only in Pages Function / CI settings.

## 12. Decisions

1. **Static-first frontend** (Next.js `output: 'export'`) — zero-cost reading, resilience to database pauses.
2. **Postgres is the authorization boundary**; grading in SQL.
3. **Guest attempts by hashed one-time token**; accounts optional and additive (claim attempts, import progress).
4. **No tenants**; one team with platform roles.
5. **Publish requires scientific approval** (the institution fast-path was removed with institutions).
6. **Files off the database** (R2 + YouTube) to stay inside free egress.
7. **No Ijazah certificate type**, by schema.
