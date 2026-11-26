-- =============================================================================
-- حَقَّ تِلَاوَتِهِ — Migration 0001: foundation (v2, unified public platform)
--
-- One public platform, no tenants. Accounts are OPTIONAL: anonymous visitors
-- can read every published lesson and take exams as guests. Accounts exist for
-- (a) the platform team (admins, editors, reviewers, graders) and
-- (b) learners who choose to sync progress and history across devices.
--
-- Authorization lives in Postgres: RLS on every table, privileged workflows in
-- SECURITY DEFINER functions with a fixed search_path that re-check the caller.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.platform_role as enum (
  'super_admin',              -- everything, incl. managing team roles
  'scientific_review_admin',  -- assigns reviewers, publishes reviewed content
  'scientific_reviewer',      -- reviews and approves content and answer keys
  'content_editor',           -- writes lessons, files, questions, exams
  'grader',                   -- grades manually marked answers
  'moderator'                 -- announcements
);

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (optional learner accounts and team members)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null default '' check (char_length(full_name) <= 200),
  display_name       text check (char_length(display_name) <= 100),
  locale             text not null default 'ar' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  current_level_id   uuid,   -- FK added in 0002
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- ---------------------------------------------------------------------------
-- Platform team roles
-- ---------------------------------------------------------------------------
create table public.platform_role_assignments (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.platform_role not null,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_platform_role(p_roles public.platform_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_role_assignments
                 where user_id = auth.uid() and role = any (p_roles));
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(array['super_admin']::public.platform_role[]);
$$;

-- may author / edit educational content
create or replace function public.is_content_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(array['super_admin','scientific_review_admin','scientific_reviewer','content_editor']::public.platform_role[]);
$$;

create or replace function public.is_scientific_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(array['super_admin','scientific_review_admin','scientific_reviewer']::public.platform_role[]);
$$;

create or replace function public.is_publisher()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(array['super_admin','scientific_review_admin']::public.platform_role[]);
$$;

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_role_assignments where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Settings (tunable without deploys). Rows marked secret are never readable
-- through the API.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  is_secret  boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value, is_secret) values
  ('mastery_threshold',          '0.8',  false),
  ('mastery_min_questions',      '2',    false),
  ('weak_lesson_threshold',      '0.6',  false),
  ('guest_attempts_per_hour',    '30',   false),   -- per network address (hashed)
  ('guest_attempt_retention_days','30',  false),
  ('platform_issuer_name',       '"منصة حَقَّ تِلَاوَتِهِ"', false),
  ('guest_ip_salt', to_jsonb(encode(gen_random_bytes(16), 'hex')), true);

create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.platform_settings where key = p_key), p_default);
$$;

alter table public.platform_settings enable row level security;
create policy settings_select on public.platform_settings for select to anon, authenticated
  using (not is_secret or public.is_super_admin());
create policy settings_write on public.platform_settings for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Audit log (append-only, written by functions/triggers)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb
);
create index audit_log_time_idx on public.audit_log (occurred_at desc);

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.tg_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  perform public.audit(lower(tg_op), tg_table_name, coalesce(r ->> 'id', r ->> 'user_id'), jsonb_build_object('row', r));
  return coalesce(new, old);
end $$;
create trigger audit_platform_roles after insert or update or delete on public.platform_role_assignments
  for each row execute function public.tg_audit_row();

-- ---------------------------------------------------------------------------
-- Heartbeat: the scheduled keep-alive job writes here so the free database
-- sees real activity (see docs/02-architecture.md §Hosting).
-- ---------------------------------------------------------------------------
create table public.heartbeat (id int primary key default 1 check (id = 1), beat_at timestamptz not null default now());
insert into public.heartbeat default values;
create or replace function public.heartbeat()
returns timestamptz language sql security definer set search_path = public as $$
  update public.heartbeat set beat_at = now() where id = 1 returning beat_at;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles                  enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.audit_log                 enable row level security;
alter table public.heartbeat                 enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_platform_role(array['super_admin','grader']::public.platform_role[]));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy pra_select on public.platform_role_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());
create policy pra_write on public.platform_role_assignments for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy audit_select on public.audit_log for select to authenticated using (public.is_super_admin());

revoke insert, update, delete on public.audit_log from anon, authenticated;
revoke all on public.heartbeat from anon, authenticated;
revoke execute on function public.audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.heartbeat() from public, anon, authenticated;
