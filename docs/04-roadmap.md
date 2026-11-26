# Roadmap (v2 — smallest free, deployable version first)

## Release 1 — "a student can learn and get tested from a link"

| Step | Scope | State |
|---|---|---|
| 1 | Curriculum map and seed | **Done** |
| 2 | Database: content, review, question bank, guest exams, grading, certificates (5 migrations, 93 checks) | **Done** |
| 3 | Next.js static site: home, level → chapter → lesson pages, file downloads, YouTube embeds, encyclopedia, About, browser search | **Done** (2026-11-26) |
| 4 | Exam player (guest token in localStorage, autosave, resume, timer from server time) + result page with corrections | **Done** |
| 5 | Admin dashboard (client-side, Supabase Auth): lessons editor, file upload to R2, question builder with templates, exam builder, review queue with snapshot diff, grading queue, announcements, team roles | **Done** (optional accounts UI included) |
| 6 | Deploy: Cloudflare Pages project, R2 bucket, Supabase project, `/api/rebuild` + `/api/upload` Pages Functions, GitHub Actions keep-alive + backup | Functions built; Cloudflare/R2 setup and Actions pending |
| 7 | Content: transcribe and review Level 1 (16 lessons, pp. 9–76) and its practice questions | can start now, in parallel |
| 8 | Test the real app: Playwright on phone viewports (RTL, exam flow end-to-end against a local Supabase), Lighthouse | Playwright suites done (`npm run test:e2e`, offline from the live DB); Lighthouse pending |

## Release 2

Optional accounts UI (sync, claim guest attempts, history, certificates PDF + QR + public verify page), Tajweed Academy pages (pp. 107–150 as source), PWA offline reading, Levels 2–4 content.

## Later

Recitation recording with teacher feedback (needs a teacher model again — would be designed without tenants), more curricula and riwayat, English UI.
