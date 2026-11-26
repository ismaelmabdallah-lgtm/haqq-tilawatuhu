-- =============================================================================
-- Migration 0002: curricula, educational content, Tajweed Academy reference
-- data, Arabic search, scientific review workflow (v2, single public platform)
--
-- Visibility rule for every reviewable item:
--   published  → readable by everyone (anonymous included)
--   otherwise  → readable only by the content team
-- "Scientifically verified" is set ONLY by an approval from a reviewer.
-- =============================================================================

create type public.content_status as enum (
  'draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'published', 'archived'
);
create type public.content_origin as enum (
  'curriculum_quoted',          -- quoted/derived from the referenced curriculum edition (page required)
  'supplementary_explanation',  -- explanation written around curriculum content
  'independent_material'        -- prepared independently of any curriculum
);

-- Search-only normalization; displayed text is never modified.
create or replace function public.normalize_arabic(p text)
returns text language sql immutable parallel safe as $$
  select btrim(regexp_replace(
    translate(
      regexp_replace(coalesce(p, ''), '[ؐ-ًؚ-ٰٟۖ-ۭـ]', '', 'g'),
      'أإآٱىةؤئ', 'اااايهوي'),
    '\s+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Curriculum structure (data, not code)
-- ---------------------------------------------------------------------------
create table public.riwayat (
  id      uuid primary key default gen_random_uuid(),
  code    text not null unique check (code ~ '^[a-z0-9-]+$'),
  name_ar text not null,
  name_en text,
  tariq   text
);

create table public.curricula (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  title            text not null,
  description      text,
  language         text not null default 'ar',
  country_code     text check (country_code ~ '^[A-Z]{2}$'),
  is_published     boolean not null default false,
  affiliation_note text,      -- shown publicly; using a published curriculum ≠ affiliation
  created_by       uuid references auth.users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger curricula_updated before update on public.curricula
  for each row execute function public.tg_set_updated_at();

create table public.curriculum_editions (
  id              uuid primary key default gen_random_uuid(),
  curriculum_id   uuid not null references public.curricula (id) on delete cascade,
  slug            text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  label           text not null,
  year_ce         int check (year_ce between 1900 and 2200),
  year_ah         int check (year_ah between 1300 and 1700),
  riwayah_id      uuid not null references public.riwayat (id),
  publisher       text,
  authors         text[] not null default '{}',
  source_document jsonb not null default '{}'::jsonb,
  is_published    boolean not null default false,
  is_current      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (curriculum_id, slug)
);
create unique index curriculum_editions_one_current on public.curriculum_editions (curriculum_id) where is_current;

create table public.levels (
  id                uuid primary key default gen_random_uuid(),
  edition_id        uuid not null references public.curriculum_editions (id) on delete cascade,
  code              text not null check (code ~ '^[a-z0-9-]+$'),
  sort_order        int not null,
  title             text not null,
  subtitle          text,
  description       text,
  source_page_start int check (source_page_start > 0),
  source_page_end   int check (source_page_end >= source_page_start),
  unique (edition_id, code),
  unique (edition_id, sort_order)
);

create table public.chapters (
  id                uuid primary key default gen_random_uuid(),
  level_id          uuid not null references public.levels (id) on delete cascade,
  code              text not null check (code ~ '^[a-z0-9-]+$'),
  sort_order        int not null,
  label             text,
  title             text not null,
  source_page_start int check (source_page_start > 0),
  source_page_end   int check (source_page_end >= source_page_start),
  review_note       text,
  unique (level_id, code),
  unique (level_id, sort_order)
);

alter table public.profiles
  add constraint profiles_current_level_fk foreign key (current_level_id) references public.levels (id) on delete set null;

create or replace function public.edition_is_public(p_edition uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.curriculum_editions e join public.curricula c on c.id = e.curriculum_id
                 where e.id = p_edition and e.is_published and c.is_published);
$$;

-- ---------------------------------------------------------------------------
-- Reviewable content
-- ---------------------------------------------------------------------------
create table public.lessons (
  id                      uuid primary key default gen_random_uuid(),
  chapter_id              uuid not null references public.chapters (id) on delete cascade,
  parent_lesson_id        uuid references public.lessons (id) on delete cascade,
  code                    text not null check (code ~ '^[a-z0-9-]+$'),
  sort_order              int not null,
  title                   text not null check (char_length(title) between 1 and 300),
  description             text,
  objectives              text[] not null default '{}',
  body_md                 text,
  definitions             jsonb not null default '[]'::jsonb,   -- [{term, definition, source_page}]
  rules                   jsonb not null default '[]'::jsonb,   -- [{title, body, source_page}]
  tables                  jsonb not null default '[]'::jsonb,   -- [{caption, columns[], rows[][]}]
  youtube_ids             text[] not null default '{}',
  origin                  public.content_origin not null default 'curriculum_quoted',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  source_page_end         int check (source_page_end >= source_page_start),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  search_norm             text generated always as (public.normalize_arabic(
                            title || ' ' || coalesce(description, '') || ' ' || coalesce(body_md, '') || ' ' || definitions::text)) stored,
  unique (chapter_id, code),
  constraint lessons_curriculum_source check (
    origin <> 'curriculum_quoted' or (source_edition_id is not null and source_page_start is not null))
);
create index lessons_chapter_idx on public.lessons (chapter_id, sort_order);
create index lessons_status_idx on public.lessons (status);
create index lessons_search_idx on public.lessons using gin (search_norm gin_trgm_ops);
create trigger lessons_updated before update on public.lessons
  for each row execute function public.tg_set_updated_at();

create table public.lesson_relations (
  lesson_id         uuid not null references public.lessons (id) on delete cascade,
  related_lesson_id uuid not null references public.lessons (id) on delete cascade,
  primary key (lesson_id, related_lesson_id),
  check (lesson_id <> related_lesson_id)
);

-- Stored by reference; display_text must come from a verified Uthmani source.
create table public.quranic_examples (
  id                      uuid primary key default gen_random_uuid(),
  riwayah_id              uuid not null references public.riwayat (id),
  surah                   smallint not null check (surah between 1 and 114),
  ayah_start              smallint not null check (ayah_start between 1 and 286),
  ayah_end                smallint not null check (ayah_end between 1 and 286),
  word_start              smallint check (word_start > 0),
  word_end                smallint check (word_end >= word_start),
  display_text            text,
  text_source             text,
  note                    text,
  origin                  public.content_origin not null default 'curriculum_quoted',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  source_page_end         int check (source_page_end >= source_page_start),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (ayah_end >= ayah_start),
  check (display_text is null or text_source is not null)
);
create index quranic_examples_ref_idx on public.quranic_examples (surah, ayah_start);
create trigger quranic_examples_updated before update on public.quranic_examples
  for each row execute function public.tg_set_updated_at();

create table public.lesson_examples (
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  example_id uuid not null references public.quranic_examples (id) on delete cascade,
  sort_order int not null default 0,
  rule_note  text,
  primary key (lesson_id, example_id)
);

-- Files are stored once. Zero-cost layout: large files (PDF, audio) in
-- Cloudflare R2 (no egress fees), videos on YouTube, small images in Supabase.
create type public.resource_kind as enum ('pdf', 'image', 'audio', 'video', 'document', 'link', 'diagram');
create type public.storage_provider as enum ('r2', 'supabase', 'youtube', 'external');

create table public.resources (
  id                      uuid primary key default gen_random_uuid(),
  kind                    public.resource_kind not null,
  title                   text not null,
  description             text,
  provider                public.storage_provider not null,
  object_key              text,          -- r2/supabase object path
  youtube_id              text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  external_url            text check (external_url is null or external_url ~ '^https://'),
  mime_type               text,
  size_bytes              bigint check (size_bytes >= 0 and size_bytes <= 26214400),  -- 25 MiB hard cap
  duration_seconds        int check (duration_seconds >= 0),
  reciter_name            text,
  is_downloadable         boolean not null default true,
  origin                  public.content_origin not null default 'independent_material',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (case provider when 'youtube' then youtube_id is not null
                       when 'external' then external_url is not null
                       else object_key is not null end),
  unique (provider, object_key)
);
create trigger resources_updated before update on public.resources
  for each row execute function public.tg_set_updated_at();

create table public.lesson_resources (
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  sort_order  int not null default 0,
  primary key (lesson_id, resource_id)
);

-- Encyclopedia
create table public.tajweed_topics (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title                   text not null,
  definition              text,
  explanation_md          text,
  rules                   jsonb not null default '[]'::jsonb,
  riwayah_id              uuid references public.riwayat (id),
  origin                  public.content_origin not null default 'supplementary_explanation',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  source_page_end         int check (source_page_end >= source_page_start),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  search_norm             text generated always as (public.normalize_arabic(
                            title || ' ' || coalesce(definition, '') || ' ' || coalesce(explanation_md, ''))) stored
);
create index tajweed_topics_search_idx on public.tajweed_topics using gin (search_norm gin_trgm_ops);
create trigger tajweed_topics_updated before update on public.tajweed_topics
  for each row execute function public.tg_set_updated_at();

create table public.topic_lessons (
  topic_id  uuid not null references public.tajweed_topics (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  primary key (topic_id, lesson_id)
);

-- Tajweed Academy (letters, articulation points, characteristics).
-- Rows are content: reviewed like lessons; source pages from the curriculum
-- (المخارج pp. 113–124, ألقاب الحروف p. 125, الصفات pp. 131–150).
create table public.articulation_points (     -- المخارج
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique check (code ~ '^[a-z0-9-]+$'),
  general_area            text not null,        -- الجوف، الحلق، اللسان، الشفتان، الخيشوم
  name                    text not null,
  sort_order              int not null,
  description_md          text,
  diagram_resource_id     uuid references public.resources (id) on delete set null,
  origin                  public.content_origin not null default 'curriculum_quoted',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint ap_source check (origin <> 'curriculum_quoted' or (source_edition_id is not null and source_page_start is not null))
);
create table public.letter_characteristics (  -- الصفات
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique check (code ~ '^[a-z0-9-]+$'),
  name                    text not null,
  has_opposite            boolean not null,
  opposite_id             uuid references public.letter_characteristics (id),
  description_md          text,
  origin                  public.content_origin not null default 'curriculum_quoted',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint lc_source check (origin <> 'curriculum_quoted' or (source_edition_id is not null and source_page_start is not null))
);
create table public.academy_letters (
  id                      uuid primary key default gen_random_uuid(),
  letter                  text not null unique check (char_length(letter) between 1 and 3),
  sort_order              int not null,
  articulation_point_id   uuid references public.articulation_points (id),
  description_md          text,
  common_mistakes_md      text,
  audio_resource_id       uuid references public.resources (id) on delete set null,  -- recorded by a qualified teacher
  origin                  public.content_origin not null default 'curriculum_quoted',
  source_edition_id       uuid references public.curriculum_editions (id),
  source_page_start       int check (source_page_start > 0),
  status                  public.content_status not null default 'draft',
  scientifically_verified boolean not null default false,
  created_by              uuid references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint al_source check (origin <> 'curriculum_quoted' or (source_edition_id is not null and source_page_start is not null))
);
create table public.academy_letter_characteristics (
  letter_id         uuid not null references public.academy_letters (id) on delete cascade,
  characteristic_id uuid not null references public.letter_characteristics (id) on delete cascade,
  primary key (letter_id, characteristic_id)
);
create table public.academy_letter_examples (
  letter_id  uuid not null references public.academy_letters (id) on delete cascade,
  example_id uuid not null references public.quranic_examples (id) on delete cascade,
  primary key (letter_id, example_id)
);

-- ---------------------------------------------------------------------------
-- Review workflow
-- ---------------------------------------------------------------------------
create table public.review_assignments (
  entity_type text not null,
  entity_id   uuid not null,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now(),
  primary key (entity_type, entity_id, reviewer_id)
);
create table public.review_events (
  id          bigint generated always as identity primary key,
  entity_type text not null,
  entity_id   uuid not null,
  from_status public.content_status,
  to_status   public.content_status not null,
  actor_id    uuid references auth.users (id),
  comment     text,
  snapshot    jsonb not null,
  occurred_at timestamptz not null default now()
);
create index review_events_entity_idx on public.review_events (entity_type, entity_id, occurred_at);
create table public.review_comments (
  id          bigint generated always as identity primary key,
  entity_type text not null,
  entity_id   uuid not null,
  author_id   uuid not null references auth.users (id),
  body        text not null check (char_length(body) between 1 and 8000),
  field_path  text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- status/verification change only inside transition_content(); content is
-- frozen outside draft/changes_requested.
create or replace function public.tg_content_guard()
returns trigger language plpgsql as $$
declare
  in_tx boolean := coalesce(current_setting('app.content_transition', true), '') = 'on';
  guarded text[] := array['status','scientifically_verified','updated_at','search_norm'];
begin
  if tg_op = 'INSERT' then
    if not in_tx then new.status := 'draft'; new.scientifically_verified := false; end if;
    return new;
  end if;
  if in_tx then return new; end if;
  if new.status is distinct from old.status or new.scientifically_verified is distinct from old.scientifically_verified then
    raise exception 'status and verification change only via transition_content()' using errcode = '42501';
  end if;
  if old.status not in ('draft', 'changes_requested')
     and (to_jsonb(new) - guarded) is distinct from (to_jsonb(old) - guarded) then
    raise exception 'content in status % is frozen; move it back to draft first', old.status using errcode = '42501';
  end if;
  return new;
end $$;

create trigger lessons_guard               before insert or update on public.lessons               for each row execute function public.tg_content_guard();
create trigger quranic_examples_guard      before insert or update on public.quranic_examples      for each row execute function public.tg_content_guard();
create trigger resources_guard             before insert or update on public.resources             for each row execute function public.tg_content_guard();
create trigger tajweed_topics_guard        before insert or update on public.tajweed_topics        for each row execute function public.tg_content_guard();
create trigger articulation_points_guard   before insert or update on public.articulation_points   for each row execute function public.tg_content_guard();
create trigger letter_characteristics_guard before insert or update on public.letter_characteristics for each row execute function public.tg_content_guard();
create trigger academy_letters_guard       before insert or update on public.academy_letters       for each row execute function public.tg_content_guard();

-- Registry of reviewable tables (0003 adds question_versions).
create table public.reviewable_entities (entity text primary key);
insert into public.reviewable_entities values
  ('lessons'), ('quranic_examples'), ('resources'), ('tajweed_topics'),
  ('articulation_points'), ('letter_characteristics'), ('academy_letters');
revoke all on public.reviewable_entities from anon, authenticated;

-- INTERNAL: full row (0003 extends it with answer keys). Not callable via API.
create or replace function public.content_meta(p_entity text, p_id uuid,
  out status public.content_status, out author_id uuid, out row_data jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.reviewable_entities where entity = p_entity) then
    raise exception 'unknown content entity %', p_entity using errcode = '22023';
  end if;
  execute format('select status, created_by, to_jsonb(t) from public.%I t where id = $1', p_entity)
    into status, author_id, row_data using p_id;
  if p_entity = 'question_versions' and row_data is not null then
    row_data := row_data || jsonb_build_object('answer_key',
      (select to_jsonb(k) - 'question_version_id' from public.question_keys k where k.question_version_id = p_id));
  end if;
end $$;
revoke execute on function public.content_meta(text, uuid) from public, anon, authenticated;

create or replace function public.transition_content(p_entity text, p_id uuid, p_to public.content_status, p_comment text default null)
returns public.content_status language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_from public.content_status;
  v_ok boolean;
  v_verified boolean;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into m from public.content_meta(p_entity, p_id);
  if m.row_data is null then raise exception 'content not found' using errcode = 'P0002'; end if;
  v_from := m.status;

  v_ok := case
    when v_from in ('draft','changes_requested') and p_to = 'submitted' then public.is_content_staff()
    when v_from in ('submitted','approved','archived') and p_to = 'draft' then public.is_content_staff()
    when v_from = 'submitted' and p_to = 'under_review' then
      public.is_scientific_reviewer() and (
        not exists (select 1 from public.review_assignments a where a.entity_type = p_entity and a.entity_id = p_id)
        or exists (select 1 from public.review_assignments a where a.entity_type = p_entity and a.entity_id = p_id and a.reviewer_id = auth.uid())
        or public.is_publisher())
    when v_from = 'under_review' and p_to = 'changes_requested' then public.is_scientific_reviewer()
    when v_from = 'under_review' and p_to = 'approved' then
      public.is_scientific_reviewer() and m.author_id is distinct from auth.uid()   -- no self-approval
    when v_from = 'approved'  and p_to = 'published' then public.is_publisher()
    when v_from = 'published' and p_to in ('archived','draft') then public.is_publisher()
    else false end;

  if not v_ok then
    raise exception 'transition % -> % not allowed for this user', v_from, p_to using errcode = '42501';
  end if;
  if p_to = 'changes_requested' and coalesce(btrim(p_comment), '') = '' then
    raise exception 'a comment is required when requesting changes' using errcode = '23514';
  end if;

  v_verified := case when p_to in ('approved','published','archived')
                     then p_to = 'approved' or (m.row_data ->> 'scientifically_verified')::boolean
                     else false end;

  perform set_config('app.content_transition', 'on', true);
  execute format('update public.%I set status = $1, scientifically_verified = $2 where id = $3', p_entity)
    using p_to, v_verified, p_id;
  perform set_config('app.content_transition', 'off', true);

  insert into public.review_events (entity_type, entity_id, from_status, to_status, actor_id, comment, snapshot)
  values (p_entity, p_id, v_from, p_to, auth.uid(), p_comment, m.row_data);
  perform public.audit('transition', p_entity, p_id::text, jsonb_build_object('from', v_from, 'to', p_to));
  return p_to;
end $$;

create or replace function public.assign_reviewer(p_entity text, p_id uuid, p_reviewer uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_publisher() then
    raise exception 'only review admins assign reviewers' using errcode = '42501';
  end if;
  if not exists (select 1 from public.platform_role_assignments where user_id = p_reviewer
                 and role in ('scientific_reviewer','scientific_review_admin','super_admin')) then
    raise exception 'assignee is not a scientific reviewer' using errcode = '23514';
  end if;
  perform 1 from public.content_meta(p_entity, p_id);
  insert into public.review_assignments (entity_type, entity_id, reviewer_id, assigned_by)
  values (p_entity, p_id, p_reviewer, auth.uid()) on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Search (SECURITY INVOKER → RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.search_content(p_query text, p_edition uuid default null,
                                                 p_level uuid default null, p_limit int default 20)
returns table (kind text, id uuid, title text, snippet text, level_id uuid, chapter_id uuid, score real)
language sql stable security invoker set search_path = public as $$
  with q as (select public.normalize_arabic(p_query) as n)
  (
    select 'lesson', l.id, l.title, left(coalesce(l.description, l.body_md, ''), 200),
           ch.level_id, l.chapter_id, similarity(l.search_norm, q.n)
    from public.lessons l
    join public.chapters ch on ch.id = l.chapter_id
    join public.levels lv on lv.id = ch.level_id, q
    where char_length(q.n) >= 2
      and (l.search_norm ilike '%' || q.n || '%' or l.search_norm % q.n)
      and (p_edition is null or lv.edition_id = p_edition)
      and (p_level is null or ch.level_id = p_level)
  )
  union all
  (
    select 'topic', t.id, t.title, left(coalesce(t.definition, ''), 200), null::uuid, null::uuid,
           similarity(t.search_norm, q.n)
    from public.tajweed_topics t, q
    where char_length(q.n) >= 2 and p_level is null
      and (t.search_norm ilike '%' || q.n || '%' or t.search_norm % q.n)
  )
  order by 7 desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['riwayat','curricula','curriculum_editions','levels','chapters','lessons','lesson_relations',
    'quranic_examples','lesson_examples','resources','lesson_resources','tajweed_topics','topic_lessons',
    'articulation_points','letter_characteristics','academy_letters','academy_letter_characteristics',
    'academy_letter_examples','review_assignments','review_events','review_comments','reviewable_entities'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- structure
create policy riwayat_select on public.riwayat for select to anon, authenticated using (true);
create policy riwayat_write on public.riwayat for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy curricula_select on public.curricula for select to anon, authenticated
  using (is_published or public.is_content_staff());
create policy curricula_write on public.curricula for all to authenticated
  using (public.is_content_staff()) with check (public.is_content_staff());

create policy editions_select on public.curriculum_editions for select to anon, authenticated
  using (public.edition_is_public(id) or public.is_content_staff());
create policy editions_write on public.curriculum_editions for all to authenticated
  using (public.is_content_staff()) with check (public.is_content_staff());

create policy levels_select on public.levels for select to anon, authenticated
  using (public.edition_is_public(edition_id) or public.is_content_staff());
create policy levels_write on public.levels for all to authenticated
  using (public.is_content_staff()) with check (public.is_content_staff());

create policy chapters_select on public.chapters for select to anon, authenticated
  using (public.is_content_staff() or exists (select 1 from public.levels l where l.id = level_id and public.edition_is_public(l.edition_id)));
create policy chapters_write on public.chapters for all to authenticated
  using (public.is_content_staff()) with check (public.is_content_staff());

-- reviewable content: identical policies generated per table
do $$
declare t text;
begin
  foreach t in array array['lessons','quranic_examples','resources','tajweed_topics',
                           'articulation_points','letter_characteristics','academy_letters'] loop
    execute format('create policy %1$s_select on public.%1$I for select to anon, authenticated
                      using (status = ''published'' or public.is_content_staff())', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
                      with check (public.is_content_staff() and created_by = auth.uid())', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated
                      using (public.is_content_staff()) with check (public.is_content_staff())', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated
                      using (public.is_content_staff() and status in (''draft'',''archived''))', t);
  end loop;
end $$;

-- link tables: visible when both ends are visible; edited by content staff
do $$
declare r record;
begin
  for r in select * from (values
      ('lesson_relations','lessons','lesson_id','lessons','related_lesson_id'),
      ('lesson_examples','lessons','lesson_id','quranic_examples','example_id'),
      ('lesson_resources','lessons','lesson_id','resources','resource_id'),
      ('topic_lessons','tajweed_topics','topic_id','lessons','lesson_id'),
      ('academy_letter_characteristics','academy_letters','letter_id','letter_characteristics','characteristic_id'),
      ('academy_letter_examples','academy_letters','letter_id','quranic_examples','example_id')) v(tbl, a, acol, b, bcol) loop
    execute format('create policy %1$s_select on public.%1$I for select to anon, authenticated
                      using (exists (select 1 from public.%2$I x where x.id = %3$I) and exists (select 1 from public.%4$I y where y.id = %5$I))',
                   r.tbl, r.a, r.acol, r.b, r.bcol);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated
                      using (public.is_content_staff()) with check (public.is_content_staff())', r.tbl);
  end loop;
end $$;

create policy review_assignments_select on public.review_assignments for select to authenticated using (public.is_content_staff());
create policy review_events_select on public.review_events for select to authenticated using (public.is_content_staff());
create policy review_comments_select on public.review_comments for select to authenticated using (public.is_content_staff());
create policy review_comments_insert on public.review_comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_content_staff());
create policy review_comments_update on public.review_comments for update to authenticated
  using (author_id = auth.uid() or public.is_scientific_reviewer())
  with check (author_id = auth.uid() or public.is_scientific_reviewer());

revoke insert, update, delete on public.review_events, public.review_assignments from anon, authenticated;
