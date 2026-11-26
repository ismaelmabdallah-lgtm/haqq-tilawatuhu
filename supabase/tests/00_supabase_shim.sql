-- Minimal stand-in for the parts of Supabase the migrations depend on, so the
-- schema and RLS policies can be tested on plain PostgreSQL 15+.
-- NOT a migration: never run this against a real Supabase project.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
grant anon, authenticated, service_role to postgres;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
$$;

-- Mirror the live Supabase project (found 2026-11-26, see migration 0005):
--  * extensions live in schema `extensions`, which is on the database
--    search_path but NOT on functions that pin `search_path = public`;
--  * no automatic table grants to the API roles — migration 0005 grants them
--    explicitly, so the tests exercise exactly what the live project runs.
-- Functions keep PostgreSQL's default PUBLIC execute, as on Supabase.
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgcrypto with schema extensions;
create extension pg_trgm  with schema extensions;
-- Migrations are applied with function-body checks off, like the live project
-- (search_content() was created there although similarity() is not on its
-- pinned search_path; it failed only when called, until migration 0005).
do $$ begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
  execute format('alter database %I set check_function_bodies = off', current_database());
end $$;
set search_path = "$user", public, extensions;
set check_function_bodies = off;

-- storage schema subset
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;
