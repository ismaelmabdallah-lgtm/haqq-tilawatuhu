-- =============================================================================
-- Migration 0003: question bank (versioned), exams, GUEST-FRIENDLY attempts,
-- automatic + manual grading (v2)
--
--   * Anyone can take a published exam, signed in or not.
--   * A guest attempt is owned by a random token returned once by
--     start_attempt(); only its SHA-256 hash is stored. The browser keeps the
--     token (e.g. localStorage) to resume, submit and view the result.
--   * Answer keys live in question_keys, readable only by the content team
--     and graders. Papers and results are built server-side.
--   * Guest abuse is limited per hashed network address and globally; guest
--     attempts are deleted after a retention period (default 30 days).
-- =============================================================================

create or replace function public.is_grader()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(array['super_admin','scientific_review_admin','grader']::public.platform_role[]);
$$;

-- ---------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------
create table public.questions (
  id                 uuid primary key default gen_random_uuid(),
  edition_id         uuid references public.curriculum_editions (id),
  level_id           uuid references public.levels (id),
  chapter_id         uuid references public.chapters (id),
  lesson_id          uuid references public.lessons (id),
  difficulty         smallint not null default 2 check (difficulty between 1 and 5),
  tags               text[] not null default '{}',
  current_version_id uuid,
  is_archived        boolean not null default false,
  created_by         uuid references auth.users (id),
  created_at         timestamptz not null default now()
);
create index questions_scope_idx on public.questions (edition_id, level_id, chapter_id, lesson_id);

create table public.question_versions (
  id                      uuid primary key default gen_random_uuid(),
  question_id             uuid not null references public.questions (id) on delete cascade,
  version_no              int not null,
  prompt                  jsonb not null,   -- {stem, quran_ref, media, parts:[{id,type,marks,...}]}
  total_marks             numeric(7,2) not null default 0,
  auto_gradable           boolean not null default true,
  origin                  public.content_origin not null default 'independent_material',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  source_page_end         int check (source_page_end >= source_page_start),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  search_norm             text generated always as (public.normalize_arabic(prompt::text)) stored,
  unique (question_id, version_no)
);
create index question_versions_search_idx on public.question_versions using gin (search_norm gin_trgm_ops);
alter table public.questions add constraint questions_current_version_fk
  foreign key (current_version_id) references public.question_versions (id) on delete set null;

create table public.question_keys (
  question_version_id uuid primary key references public.question_versions (id) on delete cascade,
  key                 jsonb not null,
  model_answer        jsonb not null default '{}'::jsonb,
  explanation         text
);

create type public.part_type as enum (
  'single_choice', 'multiple_choice', 'true_false', 'short_text', 'long_text',
  'fill_blank', 'drag_drop', 'table', 'matching', 'ordering', 'audio_response'
);

create or replace function public.tg_question_version_prepare()
returns trigger language plpgsql as $$
declare
  p jsonb; v_total numeric := 0; v_auto boolean := true; v_ids text[] := '{}';
begin
  if jsonb_typeof(new.prompt -> 'parts') <> 'array' or jsonb_array_length(new.prompt -> 'parts') = 0 then
    raise exception 'prompt.parts must be a non-empty array' using errcode = '23514';
  end if;
  for p in select * from jsonb_array_elements(new.prompt -> 'parts') loop
    if coalesce(p ->> 'id', '') = '' or p ->> 'id' = any (v_ids) then
      raise exception 'each part needs a unique id' using errcode = '23514';
    end if;
    v_ids := v_ids || (p ->> 'id');
    perform (p ->> 'type')::public.part_type;
    if coalesce((p ->> 'marks')::numeric, -1) < 0 then
      raise exception 'part % needs non-negative marks', p ->> 'id' using errcode = '23514';
    end if;
    if p ?| array['correct', 'accepted', 'answer', 'answers', 'order_key', 'pairs_key'] then
      raise exception 'part % contains answer data; keys belong in question_keys', p ->> 'id' using errcode = '23514';
    end if;
    v_total := v_total + (p ->> 'marks')::numeric;
    if p ->> 'type' in ('long_text', 'audio_response') then v_auto := false; end if;
  end loop;
  new.total_marks := v_total;
  new.auto_gradable := v_auto;
  return new;
end $$;
create trigger question_versions_prepare before insert or update of prompt on public.question_versions
  for each row execute function public.tg_question_version_prepare();
create trigger question_versions_guard before insert or update on public.question_versions
  for each row execute function public.tg_content_guard();
create trigger question_versions_updated before update on public.question_versions
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_question_key_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status public.content_status;
begin
  select status into v_status from public.question_versions where id = coalesce(new.question_version_id, old.question_version_id);
  if v_status not in ('draft', 'changes_requested') and coalesce(current_setting('app.content_transition', true), '') <> 'on' then
    raise exception 'answer key is frozen while the version is %', v_status using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger question_keys_guard before insert or update or delete on public.question_keys
  for each row execute function public.tg_question_key_guard();

create or replace function public.tg_question_version_published()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    update public.questions set current_version_id = new.id where id = new.question_id;
  end if;
  return new;
end $$;
create trigger question_versions_published after update of status on public.question_versions
  for each row execute function public.tg_question_version_published();

insert into public.reviewable_entities values ('question_versions');

create or replace function public.new_question_version(p_question uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare src public.question_versions; v_id uuid;
begin
  if not public.is_content_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.questions where id = p_question) then
    raise exception 'question not found' using errcode = 'P0002';
  end if;
  select * into src from public.question_versions where question_id = p_question order by version_no desc limit 1;
  insert into public.question_versions (question_id, version_no, prompt, origin, source_edition_id,
                                        source_page_start, source_page_end, created_by)
  values (p_question, coalesce(src.version_no, 0) + 1, src.prompt, coalesce(src.origin, 'independent_material'),
          src.source_edition_id, src.source_page_start, src.source_page_end, auth.uid())
  returning id into v_id;
  if src.id is not null then
    insert into public.question_keys (question_version_id, key, model_answer, explanation)
    select v_id, key, model_answer, explanation from public.question_keys where question_version_id = src.id;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Grading of one part → fraction 0..1, or NULL = needs a human
-- ---------------------------------------------------------------------------
create or replace function public.norm_answer(p text)
returns text language sql immutable as $$ select lower(public.normalize_arabic(coalesce(p, ''))); $$;

create or replace function public.grade_part(p_type public.part_type, p_key jsonb, p_resp jsonb)
returns numeric language plpgsql immutable as $$
declare
  v_total int; v_ok int; v_bad int;
  v_partial boolean := coalesce(p_key ->> 'scoring', 'partial') = 'partial';
  k text;
begin
  if p_type in ('long_text', 'audio_response') then
    return case when p_resp is null or p_resp = 'null'::jsonb then 0 else null end;
  end if;
  if p_resp is null or p_resp = 'null'::jsonb then return 0; end if;

  case p_type
  when 'single_choice' then
    return case when p_resp ->> 'choice' = p_key ->> 'correct' then 1 else 0 end;
  when 'true_false' then
    return case when jsonb_typeof(p_resp -> 'value') = 'boolean' and (p_resp -> 'value') = (p_key -> 'correct') then 1 else 0 end;
  when 'multiple_choice' then
    v_partial := coalesce(p_key ->> 'scoring', 'all_or_nothing') = 'partial';
    select count(*) into v_total from jsonb_array_elements_text(p_key -> 'correct');
    select count(*) filter (where c in (select jsonb_array_elements_text(p_key -> 'correct'))),
           count(*) filter (where c not in (select jsonb_array_elements_text(p_key -> 'correct')))
      into v_ok, v_bad
      from (select distinct jsonb_array_elements_text(coalesce(p_resp -> 'choices', '[]'::jsonb)) c) s;
    if v_total = 0 then return 0; end if;
    if not v_partial then return case when v_ok = v_total and v_bad = 0 then 1 else 0 end; end if;
    return greatest(0, round((v_ok - v_bad)::numeric / v_total, 4));
  when 'short_text' then
    if exists (select 1 from jsonb_array_elements_text(p_key -> 'accepted') a
               where public.norm_answer(a) = public.norm_answer(p_resp ->> 'text')) then return 1; end if;
    return case when coalesce((p_key ->> 'manual_if_unmatched')::boolean, false) then null else 0 end;
  when 'ordering' then
    if (p_key ->> 'scoring') is distinct from 'partial' then
      return case when (p_resp -> 'order') = (p_key -> 'order') then 1 else 0 end;
    end if;
    select count(*), count(*) filter (where (p_resp -> 'order') ->> (o.i - 1)::int = o.v)
      into v_total, v_ok from jsonb_array_elements_text(p_key -> 'order') with ordinality o(v, i);
    return case when v_total = 0 then 0 else round(v_ok::numeric / v_total, 4) end;
  when 'fill_blank', 'table', 'drag_drop', 'matching' then
    v_total := 0; v_ok := 0;
    for k in select jsonb_object_keys(p_key -> 'slots') loop
      v_total := v_total + 1;
      if p_type in ('drag_drop', 'matching') then
        if (p_resp -> 'slots' ->> k) is not null and (
             (jsonb_typeof(p_key -> 'slots' -> k) = 'string' and p_resp -> 'slots' ->> k = p_key -> 'slots' ->> k)
          or (jsonb_typeof(p_key -> 'slots' -> k) = 'array' and (p_key -> 'slots' -> k) ? (p_resp -> 'slots' ->> k))) then
          v_ok := v_ok + 1;
        end if;
      elsif exists (
          select 1 from jsonb_array_elements_text(
            case jsonb_typeof(p_key -> 'slots' -> k) when 'array' then p_key -> 'slots' -> k
                 else jsonb_build_array(p_key -> 'slots' -> k) end) a
          where public.norm_answer(a) = public.norm_answer(p_resp -> 'slots' ->> k)
            and coalesce(p_resp -> 'slots' ->> k, '') <> '') then
        v_ok := v_ok + 1;
      end if;
    end loop;
    if v_total = 0 then return 0; end if;
    if not v_partial then return case when v_ok = v_total then 1 else 0 end; end if;
    return round(v_ok::numeric / v_total, 4);
  else
    return null;
  end case;
end $$;

-- ---------------------------------------------------------------------------
-- Exams
-- ---------------------------------------------------------------------------
create type public.exam_kind as enum ('practice', 'formal');
create type public.exam_status as enum ('draft', 'published', 'closed', 'archived');
create type public.result_release as enum ('immediate', 'on_date', 'manual');
create type public.model_answer_visibility as enum ('never', 'after_submission', 'after_release', 'after_exam_end');

create table public.exams (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  title                   text not null check (char_length(title) between 2 and 300),
  description             text,
  edition_id              uuid references public.curriculum_editions (id),
  level_id                uuid references public.levels (id),
  chapter_id              uuid references public.chapters (id),
  lesson_id               uuid references public.lessons (id),
  kind                    public.exam_kind not null default 'formal',
  is_level_final          boolean not null default false,  -- counts toward level certificates (needs an account)
  requires_account        boolean not null default false,  -- default: guests welcome
  total_marks             numeric(8,2) not null default 0,
  has_manual_parts        boolean not null default false,
  pass_percent            numeric(5,2) not null default 60 check (pass_percent between 0 and 100),
  time_limit_minutes      int check (time_limit_minutes between 1 and 600),
  opens_at                timestamptz,
  closes_at               timestamptz,
  max_attempts            int check (max_attempts between 1 and 100),   -- enforced for accounts only
  shuffle_questions       boolean not null default false,
  shuffle_options         boolean not null default true,
  result_release          public.result_release not null default 'immediate',
  results_release_at      timestamptz,
  results_released        boolean not null default false,
  model_answer_visibility public.model_answer_visibility not null default 'after_submission',
  status                  public.exam_status not null default 'draft',
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  check (result_release <> 'on_date' or results_release_at is not null),
  check (not is_level_final or requires_account)
);
create index exams_scope_idx on public.exams (status, level_id, lesson_id);
create trigger exams_updated before update on public.exams
  for each row execute function public.tg_set_updated_at();

create table public.exam_questions (
  id                  uuid primary key default gen_random_uuid(),
  exam_id             uuid not null references public.exams (id) on delete cascade,
  question_version_id uuid not null references public.question_versions (id),
  sort_order          int not null default 0,
  is_required         boolean not null default true,
  section             text,
  unique (exam_id, question_version_id)
);

create or replace function public.tg_exam_question_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_exam_status public.exam_status; v_status public.content_status; v_verified boolean;
begin
  select status into v_exam_status from public.exams where id = coalesce(new.exam_id, old.exam_id);
  if v_exam_status <> 'draft' then
    raise exception 'exam paper is frozen once the exam is published' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  select status, scientifically_verified into v_status, v_verified from public.question_versions where id = new.question_version_id;
  if v_status <> 'published' or not v_verified then
    raise exception 'only published, scientifically reviewed question versions can be used in exams' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger exam_questions_check before insert or update or delete on public.exam_questions
  for each row execute function public.tg_exam_question_check();

create or replace function public.tg_exam_guard()
returns trigger language plpgsql as $$
declare mutable text[] := array['closes_at','results_release_at','results_released','model_answer_visibility','updated_at','status'];
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.exam_transition', true), '') <> 'on' then new.status := 'draft'; end if;
    if new.kind = 'practice' then new.result_release := 'immediate'; end if;
    return new;
  end if;
  if coalesce(current_setting('app.exam_transition', true), '') <> 'on' and new.status is distinct from old.status then
    raise exception 'exam status changes via publish_exam()/set_exam_status()' using errcode = '42501';
  end if;
  if old.status <> 'draft' and (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'published exam configuration is frozen' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger exams_guard before insert or update on public.exams
  for each row execute function public.tg_exam_guard();

create or replace function public.can_manage_exams()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(array['super_admin','scientific_review_admin','content_editor']::public.platform_role[]);
$$;

create or replace function public.publish_exam(p_exam uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare e public.exams; v_total numeric; v_manual boolean;
begin
  if not public.can_manage_exams() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into e from public.exams where id = p_exam for update;
  if e.id is null then raise exception 'exam not found' using errcode = 'P0002'; end if;
  if e.status <> 'draft' then raise exception 'exam is not a draft' using errcode = '22023'; end if;
  select coalesce(sum(v.total_marks), 0), coalesce(bool_or(not v.auto_gradable), false) into v_total, v_manual
  from public.exam_questions eq join public.question_versions v on v.id = eq.question_version_id where eq.exam_id = p_exam;
  if v_total <= 0 then raise exception 'exam has no marked questions' using errcode = '23514'; end if;
  perform set_config('app.exam_transition', 'on', true);
  update public.exams set status = 'published', total_marks = v_total, has_manual_parts = v_manual where id = p_exam;
  perform set_config('app.exam_transition', 'off', true);
  perform public.audit('publish', 'exams', p_exam::text);
  return v_total;
end $$;

create or replace function public.set_exam_status(p_exam uuid, p_status public.exam_status)
returns void language plpgsql security definer set search_path = public as $$
declare e public.exams;
begin
  if not public.can_manage_exams() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into e from public.exams where id = p_exam for update;
  if not ((e.status = 'published' and p_status in ('closed','archived'))
       or (e.status = 'closed' and p_status in ('published','archived'))
       or (e.status = 'draft' and p_status = 'archived')) then
    raise exception 'invalid exam status change % -> %', e.status, p_status using errcode = '22023';
  end if;
  perform set_config('app.exam_transition', 'on', true);
  update public.exams set status = p_status where id = p_exam;
  perform set_config('app.exam_transition', 'off', true);
  perform public.audit('status', 'exams', p_exam::text, jsonb_build_object('to', p_status));
end $$;

create or replace function public.release_results(p_exam uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_exams() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.exams set results_released = true where id = p_exam;
  perform public.audit('release_results', 'exams', p_exam::text);
end $$;

-- ---------------------------------------------------------------------------
-- Attempts (signed-in or guest)
-- ---------------------------------------------------------------------------
create type public.attempt_status as enum ('in_progress', 'submitted', 'graded');

create table public.exam_attempts (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references public.exams (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete cascade,   -- null = guest
  guest_token_hash text,
  guest_name       text check (char_length(guest_name) <= 100),       -- optional, shown on the result only
  ip_hash          text,
  attempt_no       int not null default 1,
  status           public.attempt_status not null default 'in_progress',
  started_at       timestamptz not null default now(),
  deadline_at      timestamptz,
  submitted_at     timestamptz,
  graded_at        timestamptz,
  question_order   uuid[] not null,
  option_orders    jsonb not null default '{}'::jsonb,
  auto_score       numeric(8,2),
  manual_score     numeric(8,2),
  total_score      numeric(8,2),
  max_score        numeric(8,2) not null,
  passed           boolean,
  check ((user_id is null) = (guest_token_hash is not null))
);
create unique index exam_attempts_one_open_user on public.exam_attempts (exam_id, user_id) where status = 'in_progress' and user_id is not null;
create unique index exam_attempts_guest_token on public.exam_attempts (guest_token_hash) where guest_token_hash is not null;
create index exam_attempts_user_idx on public.exam_attempts (user_id, started_at desc) where user_id is not null;
create index exam_attempts_guest_age_idx on public.exam_attempts (started_at) where user_id is null;
create index exam_attempts_pending_idx on public.exam_attempts (submitted_at) where status = 'submitted';

create table public.attempt_answers (
  attempt_id       uuid not null references public.exam_attempts (id) on delete cascade,
  exam_question_id uuid not null references public.exam_questions (id) on delete cascade,
  response         jsonb,
  saved_at         timestamptz not null default now(),
  part_scores      jsonb not null default '{}'::jsonb,
  manual_parts     jsonb not null default '{}'::jsonb,   -- {partId: score} given by a grader
  score            numeric(8,2),
  needs_manual     boolean not null default false,
  feedback         text,
  graded_by        uuid references auth.users (id),
  graded_at        timestamptz,
  primary key (attempt_id, exam_question_id)
);

-- Guest rate limiting (per hashed address per hour, plus a global ceiling)
create table public.guest_rate (
  bucket       text not null,        -- ip hash or '*' for global
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);

create or replace function public.client_ip_hash()
returns text language plpgsql stable security definer set search_path = public as $$
declare h json; ip text;
begin
  begin h := current_setting('request.headers', true)::json; exception when others then h := null; end;
  ip := coalesce(h ->> 'cf-connecting-ip', split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1), h ->> 'x-real-ip');
  if coalesce(btrim(ip), '') = '' then return null; end if;
  return encode(digest(btrim(ip) || (select value #>> '{}' from public.platform_settings where key = 'guest_ip_salt'), 'sha256'), 'hex');
end $$;

create or replace function public.guest_rate_check(p_ip_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare v_hour timestamptz := date_trunc('hour', now()); v_hits int;
begin
  if p_ip_hash is not null then
    insert into public.guest_rate values (p_ip_hash, v_hour, 1)
    on conflict (bucket, window_start) do update set hits = guest_rate.hits + 1 returning hits into v_hits;
    if v_hits > public.setting_num('guest_attempts_per_hour', 30) then
      raise exception 'too many attempts from this network; please try again later' using errcode = '54000';
    end if;
  end if;
  insert into public.guest_rate values ('*', v_hour, 1)
  on conflict (bucket, window_start) do update set hits = guest_rate.hits + 1 returning hits into v_hits;
  if v_hits > public.setting_num('guest_attempts_global_per_hour', 5000) then
    raise exception 'the platform is busy; please try again later' using errcode = '54000';
  end if;
end $$;

-- Opportunistic housekeeping — no cron job needed on the free tier.
create or replace function public.purge_expired_guest_data(p_batch int default 200)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from public.exam_attempts where id in (
    select id from public.exam_attempts
    where user_id is null and started_at < now() - make_interval(days => public.setting_num('guest_attempt_retention_days', 30)::int)
    order by started_at limit p_batch);
  get diagnostics v_n = row_count;
  delete from public.guest_rate where window_start < now() - interval '1 day';
  return v_n;
end $$;

-- Resolve an attempt for the current caller: the signed-in owner, or whoever
-- presents the guest token. Never raises different errors for "wrong token"
-- and "no such attempt".
create or replace function public.attempt_for_caller(p_attempt uuid, p_token text)
returns public.exam_attempts language plpgsql stable security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if a.id is null
     or not ((a.user_id is not null and a.user_id = auth.uid())
             or (a.user_id is null and p_token is not null
                 and a.guest_token_hash = encode(digest(p_token, 'sha256'), 'hex'))) then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  return a;
end $$;

create or replace function public.results_released(p_exam public.exams)
returns boolean language sql stable as $$
  select p_exam.kind = 'practice' or p_exam.result_release = 'immediate'
      or (p_exam.result_release = 'on_date' and now() >= p_exam.results_release_at)
      or (p_exam.result_release = 'manual' and p_exam.results_released);
$$;

create or replace function public.model_answers_visible(p_exam public.exams, p_attempt public.exam_attempts)
returns boolean language sql stable as $$
  select p_attempt.status <> 'in_progress' and case p_exam.model_answer_visibility
    when 'never' then false
    when 'after_submission' then true
    when 'after_release' then public.results_released(p_exam)
    when 'after_exam_end' then p_exam.closes_at is not null and now() >= p_exam.closes_at end;
$$;

-- Replaced in 0004 (progress for signed-in learners).
create or replace function public.on_attempt_graded(p_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$ begin end $$;

create or replace function public.grade_attempt_internal(p_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts; e public.exams; r record; part jsonb;
  v_frac numeric; v_scores jsonb; v_score numeric; v_q_manual numeric; v_pending_q boolean;
  v_auto numeric := 0; v_manual numeric := 0; v_pending boolean := false; pid text;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  select * into e from public.exams where id = a.exam_id;
  insert into public.attempt_answers (attempt_id, exam_question_id, response)
  select a.id, q, null from unnest(a.question_order) q on conflict do nothing;

  for r in
    select aa.exam_question_id, aa.response, aa.manual_parts, v.prompt, k.key
    from public.attempt_answers aa
    join public.exam_questions eq on eq.id = aa.exam_question_id
    join public.question_versions v on v.id = eq.question_version_id
    left join public.question_keys k on k.question_version_id = v.id
    where aa.attempt_id = a.id
  loop
    v_scores := '{}'::jsonb; v_score := 0; v_q_manual := 0; v_pending_q := false;
    for part in select * from jsonb_array_elements(r.prompt -> 'parts') loop
      pid := part ->> 'id';
      if r.manual_parts ? pid then                       -- a grader decided this part
        v_scores := v_scores || jsonb_build_object(pid, (r.manual_parts ->> pid)::numeric);
        v_q_manual := v_q_manual + (r.manual_parts ->> pid)::numeric;
        continue;
      end if;
      v_frac := public.grade_part((part ->> 'type')::public.part_type, coalesce(r.key -> pid, '{}'::jsonb), r.response -> 'parts' -> pid);
      if v_frac is null then
        v_pending_q := true;
        v_scores := v_scores || jsonb_build_object(pid, null);
      else
        v_scores := v_scores || jsonb_build_object(pid, round(v_frac * (part ->> 'marks')::numeric, 2));
        v_score := v_score + round(v_frac * (part ->> 'marks')::numeric, 2);
      end if;
    end loop;
    update public.attempt_answers set part_scores = v_scores, score = v_score + v_q_manual, needs_manual = v_pending_q
    where attempt_id = a.id and exam_question_id = r.exam_question_id;
    v_auto := v_auto + v_score; v_manual := v_manual + v_q_manual;
    v_pending := v_pending or v_pending_q;
  end loop;

  update public.exam_attempts set
    auto_score = v_auto, manual_score = v_manual, total_score = v_auto + v_manual,
    status = case when v_pending then 'submitted'::public.attempt_status else 'graded' end,
    graded_at = case when v_pending then null else now() end,
    passed = case when v_pending then null else (v_auto + v_manual) >= round(a.max_score * e.pass_percent / 100, 2) end
  where id = a.id;
  if not v_pending then perform public.on_attempt_graded(a.id); end if;
end $$;

-- Start (or resume) an attempt. Returns {attempt_id, guest_token?, resumed}.
-- guest_token is returned ONLY when a new guest attempt is created.
create or replace function public.start_attempt(p_exam uuid, p_guest_token text default null, p_guest_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.exams; v_open public.exam_attempts; v_count int := 0;
  v_order uuid[]; v_opts jsonb := '{}'::jsonb; r record; part jsonb; v_part_opts jsonb;
  v_id uuid; v_token text; v_ip text;
begin
  select * into e from public.exams where id = p_exam;
  if e.id is null or e.status <> 'published' then raise exception 'exam not available' using errcode = '42501'; end if;
  if (e.opens_at is not null and now() < e.opens_at) or (e.closes_at is not null and now() > e.closes_at) then
    raise exception 'exam is outside its availability window' using errcode = '22023';
  end if;

  if auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_exam::text || auth.uid()::text, 0));
    select * into v_open from public.exam_attempts where exam_id = p_exam and user_id = auth.uid() and status = 'in_progress';
  else
    if e.requires_account then raise exception 'this exam requires signing in' using errcode = '42501'; end if;
    if p_guest_token is not null then
      select * into v_open from public.exam_attempts
      where exam_id = p_exam and user_id is null and status = 'in_progress'
        and guest_token_hash = encode(digest(p_guest_token, 'sha256'), 'hex');
    end if;
  end if;

  if v_open.id is not null then
    if v_open.deadline_at is null or now() <= v_open.deadline_at + interval '30 seconds' then
      return jsonb_build_object('attempt_id', v_open.id, 'resumed', true);
    end if;
    update public.exam_attempts set submitted_at = v_open.deadline_at where id = v_open.id;
    perform public.grade_attempt_internal(v_open.id);
  end if;

  if auth.uid() is not null then
    select count(*) into v_count from public.exam_attempts where exam_id = p_exam and user_id = auth.uid();
    if e.max_attempts is not null and v_count >= e.max_attempts then
      raise exception 'attempt limit reached' using errcode = '22023';
    end if;
  else
    v_ip := public.client_ip_hash();
    perform public.guest_rate_check(v_ip);
    perform public.purge_expired_guest_data(100);
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := translate(v_token, '+/=', '-_');
  end if;

  select array_agg(id order by case when e.shuffle_questions then random() else 0 end, sort_order, id)
    into v_order from public.exam_questions where exam_id = p_exam;
  for r in select eq.id, v.prompt from public.exam_questions eq
           join public.question_versions v on v.id = eq.question_version_id where eq.exam_id = p_exam loop
    v_part_opts := '{}'::jsonb;
    for part in select * from jsonb_array_elements(r.prompt -> 'parts') loop
      if part ->> 'type' = 'ordering' or (e.shuffle_options and part ->> 'type' in ('single_choice','multiple_choice','matching','drag_drop')) then
        v_part_opts := v_part_opts || jsonb_build_object(part ->> 'id', (
          select coalesce(jsonb_agg(o ->> 'id' order by random()), '[]'::jsonb)
          from jsonb_array_elements(coalesce(part -> 'options', part -> 'items', part -> 'right', '[]'::jsonb)) o));
      end if;
    end loop;
    v_opts := v_opts || jsonb_build_object(r.id::text, v_part_opts);
  end loop;

  insert into public.exam_attempts (exam_id, user_id, guest_token_hash, guest_name, ip_hash, attempt_no,
                                    deadline_at, question_order, option_orders, max_score)
  values (p_exam, auth.uid(),
          case when v_token is not null then encode(digest(v_token, 'sha256'), 'hex') end,
          case when auth.uid() is null then nullif(btrim(left(p_guest_name, 100)), '') end,
          v_ip, v_count + 1,
          case when e.time_limit_minutes is not null
               then least(now() + make_interval(mins => e.time_limit_minutes), coalesce(e.closes_at, 'infinity'))
               else e.closes_at end,
          v_order, v_opts, e.total_marks)
  returning id into v_id;

  return jsonb_build_object('attempt_id', v_id, 'resumed', false) ||
         case when v_token is not null then jsonb_build_object('guest_token', v_token) else '{}'::jsonb end;
end $$;

create or replace function public.get_attempt_paper(p_attempt uuid, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.exam_attempts; e public.exams; v_q jsonb;
begin
  a := public.attempt_for_caller(p_attempt, p_token);
  select * into e from public.exams where id = a.exam_id;
  select jsonb_agg(jsonb_build_object(
           'exam_question_id', eq.id, 'required', eq.is_required, 'section', eq.section, 'marks', v.total_marks,
           'stem', v.prompt -> 'stem', 'media', v.prompt -> 'media', 'quran_ref', v.prompt -> 'quran_ref',
           'parts', (
             select jsonb_agg(
               case when a.option_orders -> eq.id::text ? (p ->> 'id') then
                 p || jsonb_build_object(
                   case when p ? 'options' then 'options' when p ? 'items' then 'items' else 'right' end,
                   (select jsonb_agg(o order by array_position(
                       array(select jsonb_array_elements_text(a.option_orders -> eq.id::text -> (p ->> 'id'))), o ->> 'id'))
                    from jsonb_array_elements(coalesce(p -> 'options', p -> 'items', p -> 'right')) o))
               else p end order by pi)
             from jsonb_array_elements(v.prompt -> 'parts') with ordinality x(p, pi)),
           'response', aa.response)
         order by array_position(a.question_order, eq.id))
    into v_q
  from public.exam_questions eq
  join public.question_versions v on v.id = eq.question_version_id
  left join public.attempt_answers aa on aa.attempt_id = a.id and aa.exam_question_id = eq.id
  where eq.id = any (a.question_order);
  return jsonb_build_object('attempt_id', a.id, 'exam_id', e.id, 'title', e.title, 'kind', e.kind,
                            'status', a.status, 'deadline_at', a.deadline_at, 'server_now', now(),
                            'questions', coalesce(v_q, '[]'::jsonb));
end $$;

create or replace function public.save_answer(p_attempt uuid, p_exam_question uuid, p_response jsonb, p_token text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  a := public.attempt_for_caller(p_attempt, p_token);
  perform 1 from public.exam_attempts where id = a.id for update;
  select * into a from public.exam_attempts where id = a.id;
  if a.status <> 'in_progress' then raise exception 'attempt already submitted' using errcode = '22023'; end if;
  if a.deadline_at is not null and now() > a.deadline_at + interval '30 seconds' then
    raise exception 'time is over' using errcode = '22023';
  end if;
  if not (p_exam_question = any (a.question_order)) then
    raise exception 'question is not part of this attempt' using errcode = '22023';
  end if;
  if pg_column_size(p_response) > 32768 then raise exception 'response too large' using errcode = '22023'; end if;
  insert into public.attempt_answers (attempt_id, exam_question_id, response, saved_at)
  values (a.id, p_exam_question, p_response, now())
  on conflict (attempt_id, exam_question_id) do update set response = excluded.response, saved_at = now();
  return now();
end $$;

create or replace function public.submit_attempt(p_attempt uuid, p_answers jsonb default null, p_token text default null)
returns public.attempt_status language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; k text; v_missing int; v_late boolean;
begin
  a := public.attempt_for_caller(p_attempt, p_token);
  select * into a from public.exam_attempts where id = a.id for update;
  if a.status <> 'in_progress' then return a.status; end if;      -- idempotent
  v_late := a.deadline_at is not null and now() > a.deadline_at + interval '30 seconds';
  if p_answers is not null and not v_late then
    for k in select jsonb_object_keys(p_answers) loop
      perform public.save_answer(a.id, k::uuid, p_answers -> k, p_token);
    end loop;
  end if;
  if not v_late then
    select count(*) into v_missing
    from public.exam_questions eq
    left join public.attempt_answers aa on aa.attempt_id = a.id and aa.exam_question_id = eq.id
    where eq.id = any (a.question_order) and eq.is_required
      and (aa.response is null or aa.response = 'null'::jsonb or aa.response -> 'parts' = '{}'::jsonb);
    if v_missing > 0 then raise exception '% required question(s) unanswered', v_missing using errcode = '23514'; end if;
  end if;
  update public.exam_attempts set submitted_at = case when v_late then a.deadline_at else now() end where id = a.id;
  perform public.grade_attempt_internal(a.id);
  return (select status from public.exam_attempts where id = a.id);
end $$;

create or replace function public.attempt_result_json(a public.exam_attempts, p_staff boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.exams; v_released boolean; v_models boolean; v_items jsonb;
begin
  select * into e from public.exams where id = a.exam_id;
  if a.status = 'in_progress' then return jsonb_build_object('attempt_id', a.id, 'status', a.status); end if;
  v_released := p_staff or public.results_released(e);
  v_models := p_staff or public.model_answers_visible(e, a);
  if not v_released then
    return jsonb_build_object('attempt_id', a.id, 'status', a.status, 'submitted_at', a.submitted_at, 'released', false);
  end if;
  select jsonb_agg(jsonb_build_object(
           'exam_question_id', eq.id, 'stem', v.prompt -> 'stem', 'parts', v.prompt -> 'parts',
           'response', aa.response, 'part_scores', aa.part_scores, 'score', aa.score, 'max', v.total_marks,
           'needs_manual', aa.needs_manual, 'feedback', aa.feedback, 'lesson_id', q.lesson_id,
           'model_answer', case when v_models then k.model_answer end,
           'key', case when v_models then k.key end,
           'explanation', case when v_models then k.explanation end)
         order by array_position(a.question_order, eq.id))
    into v_items
  from public.exam_questions eq
  join public.question_versions v on v.id = eq.question_version_id
  join public.questions q on q.id = v.question_id
  left join public.question_keys k on k.question_version_id = v.id
  left join public.attempt_answers aa on aa.attempt_id = a.id and aa.exam_question_id = eq.id
  where eq.id = any (a.question_order);
  return jsonb_build_object('attempt_id', a.id, 'exam_title', e.title, 'status', a.status, 'released', true,
                            'guest_name', a.guest_name, 'total_score', a.total_score, 'max_score', a.max_score,
                            'passed', a.passed, 'pending_manual', a.status = 'submitted',
                            'model_answers_visible', v_models, 'items', coalesce(v_items, '[]'::jsonb));
end $$;
revoke execute on function public.attempt_result_json(public.exam_attempts, boolean) from public, anon, authenticated;

create or replace function public.get_attempt_result(p_attempt uuid, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  if public.is_grader() then
    select * into a from public.exam_attempts where id = p_attempt;
    if a.id is null then raise exception 'attempt not found' using errcode = 'P0002'; end if;
    return public.attempt_result_json(a, true);
  end if;
  a := public.attempt_for_caller(p_attempt, p_token);
  return public.attempt_result_json(a, false);
end $$;

create or replace function public.list_my_attempts(p_exam uuid default null)
returns table (attempt_id uuid, exam_id uuid, exam_title text, attempt_no int, status public.attempt_status,
               started_at timestamptz, submitted_at timestamptz, total_score numeric, max_score numeric, passed boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.exam_id, e.title, a.attempt_no, a.status, a.started_at, a.submitted_at,
         case when public.results_released(e) then a.total_score end, a.max_score,
         case when public.results_released(e) then a.passed end
  from public.exam_attempts a join public.exams e on e.id = a.exam_id
  where a.user_id = auth.uid() and (p_exam is null or a.exam_id = p_exam)
  order by a.started_at desc;
$$;

-- After signing up, a learner can attach attempts made as a guest on this device.
create or replace function public.claim_guest_attempts(p_attempts uuid[], p_tokens text[])
returns int language plpgsql security definer set search_path = public as $$
declare v_n int := 0; i int;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if coalesce(array_length(p_attempts, 1), 0) <> coalesce(array_length(p_tokens, 1), 0) or coalesce(array_length(p_attempts, 1), 0) > 200 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  for i in 1 .. coalesce(array_length(p_attempts, 1), 0) loop
    update public.exam_attempts
       set user_id = auth.uid(), guest_token_hash = null, ip_hash = null
     where id = p_attempts[i] and user_id is null and status <> 'in_progress'
       and guest_token_hash = encode(digest(p_tokens[i], 'sha256'), 'hex');
    if found then
      v_n := v_n + 1;
      perform public.on_attempt_graded(p_attempts[i]) where (select status from public.exam_attempts where id = p_attempts[i]) = 'graded';
    end if;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Manual grading (platform graders)
-- ---------------------------------------------------------------------------
create or replace function public.list_grading_queue(p_limit int default 50)
returns table (attempt_id uuid, exam_question_id uuid, exam_title text, submitted_at timestamptz,
               stem jsonb, parts jsonb, response jsonb, part_scores jsonb, model_answer jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, aa.exam_question_id, e.title, a.submitted_at, v.prompt -> 'stem', v.prompt -> 'parts',
         aa.response, aa.part_scores, k.model_answer
  from public.exam_attempts a
  join public.exams e on e.id = a.exam_id
  join public.attempt_answers aa on aa.attempt_id = a.id and aa.needs_manual
  join public.exam_questions eq on eq.id = aa.exam_question_id
  join public.question_versions v on v.id = eq.question_version_id
  left join public.question_keys k on k.question_version_id = v.id
  where a.status = 'submitted' and public.is_grader()
  order by a.submitted_at
  limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.grade_answer(p_attempt uuid, p_exam_question uuid, p_part_scores jsonb, p_feedback text default null)
returns public.attempt_status language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; v public.question_versions; part jsonb; k text;
begin
  if not public.is_grader() then raise exception 'not allowed to grade' using errcode = '42501'; end if;
  select * into a from public.exam_attempts where id = p_attempt for update;
  if a.id is null then raise exception 'attempt not found' using errcode = 'P0002'; end if;
  if a.status = 'in_progress' then raise exception 'attempt not submitted yet' using errcode = '22023'; end if;
  select v2.* into v from public.exam_questions eq join public.question_versions v2 on v2.id = eq.question_version_id
  where eq.id = p_exam_question and eq.id = any (a.question_order);
  if v.id is null then raise exception 'question is not part of this attempt' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_part_scores) loop
    select p into part from jsonb_array_elements(v.prompt -> 'parts') p where p ->> 'id' = k;
    if part is null then raise exception 'unknown part %', k using errcode = '22023'; end if;
    if (p_part_scores ->> k)::numeric not between 0 and (part ->> 'marks')::numeric then
      raise exception 'score for part % must be between 0 and %', k, part ->> 'marks' using errcode = '22023';
    end if;
  end loop;
  update public.attempt_answers
     set manual_parts = manual_parts || p_part_scores, feedback = coalesce(p_feedback, feedback),
         graded_by = auth.uid(), graded_at = now()
   where attempt_id = p_attempt and exam_question_id = p_exam_question;
  perform public.grade_attempt_internal(p_attempt);
  perform public.audit('grade', 'attempt_answers', p_attempt::text || '/' || p_exam_question::text, jsonb_build_object('scores', p_part_scores));
  return (select status from public.exam_attempts where id = p_attempt);
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.questions         enable row level security;
alter table public.question_versions enable row level security;
alter table public.question_keys     enable row level security;
alter table public.exams             enable row level security;
alter table public.exam_questions    enable row level security;
alter table public.exam_attempts     enable row level security;
alter table public.attempt_answers   enable row level security;
alter table public.guest_rate        enable row level security;

create policy questions_select on public.questions for select to authenticated using (public.is_content_staff() or public.is_grader());
create policy questions_insert on public.questions for insert to authenticated with check (public.is_content_staff() and created_by = auth.uid());
create policy questions_update on public.questions for update to authenticated using (public.is_content_staff()) with check (public.is_content_staff());
create policy qv_select on public.question_versions for select to authenticated using (public.is_content_staff() or public.is_grader());
create policy qv_insert on public.question_versions for insert to authenticated with check (public.is_content_staff() and created_by = auth.uid());
create policy qv_update on public.question_versions for update to authenticated using (public.is_content_staff()) with check (public.is_content_staff());
create policy qv_delete on public.question_versions for delete to authenticated
  using (public.is_content_staff() and status = 'draft'
         and not exists (select 1 from public.exam_questions eq where eq.question_version_id = question_versions.id));
create policy qk_select on public.question_keys for select to authenticated using (public.is_content_staff() or public.is_grader());
create policy qk_write on public.question_keys for all to authenticated using (public.is_content_staff()) with check (public.is_content_staff());

create policy exams_select on public.exams for select to anon, authenticated
  using (status in ('published','closed') or public.can_manage_exams());
create policy exams_insert on public.exams for insert to authenticated with check (public.can_manage_exams() and created_by = auth.uid());
create policy exams_update on public.exams for update to authenticated using (public.can_manage_exams()) with check (public.can_manage_exams());
create policy exams_delete on public.exams for delete to authenticated using (public.can_manage_exams() and status = 'draft');

create policy exam_questions_select on public.exam_questions for select to authenticated using (public.can_manage_exams() or public.is_grader());
create policy exam_questions_write on public.exam_questions for all to authenticated using (public.can_manage_exams()) with check (public.can_manage_exams());

create policy attempts_select on public.exam_attempts for select to authenticated using (public.is_grader());
create policy answers_select on public.attempt_answers for select to authenticated using (public.is_grader());

revoke all on public.question_keys from anon;
revoke all on public.guest_rate from anon, authenticated;
revoke insert, update, delete on public.exam_attempts, public.attempt_answers from anon, authenticated;
revoke execute on function public.grade_attempt_internal(uuid) from public, anon, authenticated;
revoke execute on function public.on_attempt_graded(uuid) from public, anon, authenticated;
revoke execute on function public.guest_rate_check(text) from public, anon, authenticated;
revoke execute on function public.purge_expired_guest_data(int) from public, anon, authenticated;
revoke execute on function public.attempt_for_caller(uuid, text) from public, anon, authenticated;
revoke execute on function public.client_ip_hash() from public, anon, authenticated;
