# Database (v2)

| Migration | Contents |
|---|---|
| `20261126000100_foundation.sql` | optional profiles, platform team roles, settings (with hidden secrets), audit log, heartbeat |
| `20261126000200_curriculum_content_review.sql` | Arabic normalization, curricula → editions → levels → chapters → lessons, Quranic examples, files, encyclopedia, Tajweed Academy, review workflow, search |
| `20261126000300_assessment.sql` | question bank (versions + keys), grading, exams, guest/account attempts, rate limiting, retention, grading queue |
| `20261126000400_learning_engagement.sql` | notifications, progress & mastery, guest-progress import, recommendations, bookmarks, announcements, certificates, image storage |
| `20261126000500_live_api_grants.sql` | additive: table grants to the API roles (re-applying every earlier revoke), `heartbeat()` for `service_role`, and `extensions` on the search path of the five functions using pgcrypto/pg_trgm — matches how the live project was created |

Tests: `npm run test:db:pglite` runs the shim (which mirrors the live project: extensions in schema `extensions`, no automatic grants, function-body checks off during migrations), all migrations, the seed and the 93 checks in-process.

Seed: `supabase/seed/0001_minhaj_al_darisin.sql` (generated, idempotent). Tests: `supabase/tests/` (`npm run test:db`).

Visibility: published content → everyone (incl. anonymous); anything else → content team. Exams: published → everyone. Attempts/answers/keys: never directly readable by guests or learners.

## Functions callable from the app (`supabase.rpc`)

| Function | Who | Purpose |
|---|---|---|
| `start_attempt(exam, guest_token?, guest_name?)` → `{attempt_id, guest_token?, resumed}` | anyone | start or resume; token only returned on creation |
| `get_attempt_paper(attempt, token?)` | owner / token holder | paper without answer data |
| `save_answer(attempt, exam_question, response, token?)` | owner / token holder | autosave |
| `submit_attempt(attempt, answers?, token?)` | owner / token holder | idempotent; grades |
| `get_attempt_result(attempt, token?)` | owner / token holder / grader | honours release settings |
| `list_my_attempts(exam?)`, `claim_guest_attempts(ids[], tokens[])` | account | history; attach guest attempts |
| `mark_lesson(lesson, action)`, `import_guest_progress(items)`, `my_review_recommendations()` | account | progress |
| `issue_level_certificate(level)` | account | eligibility checked |
| `verify_certificate(code)` | anyone | public verification |
| `search_content(query, edition?, level?)` | anyone | admin/search fallback |
| `transition_content(entity, id, status, comment?)`, `assign_reviewer` | team | review workflow |
| `new_question_version(question)` | content team | corrections as new versions |
| `publish_exam`, `set_exam_status`, `release_results` | editors/admins | exams |
| `list_grading_queue()`, `grade_answer(attempt, exam_question, part_scores, feedback?)` | graders | manual marking |
| `mark_notifications_read(ids?)` | account | |
| `revoke_certificate(id, reason)` | super admin | |
| `heartbeat()` | service role (keep-alive job) | |

Error codes: `42501` not allowed · `22023` invalid state · `23514` validation · `P0002` not found · `54000` rate limited.

Answer/response formats are defined in `src/domain/questions/schema.ts`.
