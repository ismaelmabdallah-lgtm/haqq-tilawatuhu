-- =============================================================================
-- Migration 0005: align the live Supabase project with what migrations 0001–0004
-- (and their 93 DB checks) assume. Additive only — no table or function body
-- changes.
--
-- Found when the frontend first queried the live project (2026-11-26):
--
-- 1. Table privileges. The test shim (supabase/tests/00_supabase_shim.sql)
--    reproduces Supabase's classic default grants: API roles get table
--    privileges and RLS decides rows. This project was created without those
--    defaults, so every read failed with "permission denied for table …"
--    (a GRANT error — RLS was never reached), and service_role (keep-alive job)
--    could not execute heartbeat().
--    → grant the same privileges the shim grants, then RE-APPLY every revoke
--      from 0001–0004 so the tested privilege model is exactly preserved.
--
-- 2. Extension schema. On Supabase, pgcrypto and pg_trgm live in schema
--    `extensions`, but these functions pin `search_path = public`, so digest(),
--    gen_random_bytes(), similarity() and `%` were not found at runtime
--    ("function digest(text, unknown) does not exist").
--    → add `extensions` to those functions' search_path (public stays first).
-- =============================================================================

-- 1a. Privileges as assumed by the tested model -------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- 1b. Re-apply every table revoke from 0001–0004 (unchanged) ------------------
revoke insert, update, delete on public.audit_log from anon, authenticated;
revoke all on public.heartbeat from anon, authenticated;
revoke all on public.reviewable_entities from anon, authenticated;
revoke insert, update, delete on public.review_events, public.review_assignments from anon, authenticated;
revoke all on public.question_keys from anon;
revoke all on public.guest_rate from anon, authenticated;
revoke insert, update, delete on public.exam_attempts, public.attempt_answers from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;
revoke insert, update, delete on public.lesson_progress from anon, authenticated;
revoke insert, update, delete on public.certificates from anon, authenticated;

-- 1c. Keep-alive job (service_role) — function revokes in 0001 removed PUBLIC
--     execute, and no default grant gave it back on this project.
grant execute on function public.heartbeat() to service_role;

-- 2. Extension functions resolvable inside SECURITY DEFINER / pinned paths ----
alter function public.client_ip_hash()                              set search_path = public, extensions;
alter function public.attempt_for_caller(uuid, text)                 set search_path = public, extensions;
alter function public.start_attempt(uuid, text, text)                set search_path = public, extensions;
alter function public.claim_guest_attempts(uuid[], text[])           set search_path = public, extensions;
alter function public.search_content(text, uuid, uuid, int)          set search_path = public, extensions;
