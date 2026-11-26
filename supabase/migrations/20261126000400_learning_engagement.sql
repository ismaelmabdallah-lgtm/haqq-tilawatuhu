-- =============================================================================
-- Migration 0004: optional-account features, announcements, certificates,
-- storage (v2).
--   * Guests keep progress in their browser; accounts sync it here.
--   * Announcements are platform-wide and public.
--   * Certificates need an account (a name to print and a verifiable record);
--     there is no Ijazah certificate type at all.
-- =============================================================================

insert into public.platform_settings (key, value) values ('guest_attempts_global_per_hour', '5000')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Notifications (accounts only)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('exam_result','review','certificate','announcement','reminder')),
  title      text not null,
  body       text,
  link       text check (link is null or link ~ '^/'),
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text default null,
                                         p_link text default null, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link, data)
  values (p_user, p_kind, p_title, p_body, p_link, coalesce(p_data, '{}'::jsonb));
$$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns int language sql security definer set search_path = public as $$
  with u as (update public.notifications set read_at = now()
             where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids)) returning 1)
  select count(*)::int from u;
$$;

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;

create or replace function public.tg_review_event_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid := (new.snapshot ->> 'created_by')::uuid;
begin
  if v_author is not null and v_author is distinct from new.actor_id
     and new.to_status in ('changes_requested','approved','published') then
    perform public.notify(v_author, 'review',
      case new.to_status when 'changes_requested' then 'طُلبت تعديلات على محتوى أرسلته للمراجعة'
                         when 'approved' then 'اعتُمد محتوى أرسلته للمراجعة العلمية'
                         else 'نُشر محتوى أعددته' end,
      new.comment, null, jsonb_build_object('entity_type', new.entity_type, 'entity_id', new.entity_id));
  end if;
  return new;
end $$;
create trigger review_events_notify after insert on public.review_events
  for each row execute function public.tg_review_event_notify();

-- ---------------------------------------------------------------------------
-- Progress (accounts). viewed/completed set by the learner; practice,
-- assessment and mastery written only by grading.
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  user_id               uuid not null references auth.users (id) on delete cascade,
  lesson_id             uuid not null references public.lessons (id) on delete cascade,
  viewed_at             timestamptz,
  completed_at          timestamptz,
  practice_completed_at timestamptz,
  assessment_passed_at  timestamptz,
  mastered_at           timestamptz,
  last_accuracy         numeric(5,4),
  best_accuracy         numeric(5,4),
  updated_at            timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.bookmarks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create or replace function public.mark_lesson(p_lesson uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.lessons where id = p_lesson and status = 'published') then
    raise exception 'lesson not found' using errcode = 'P0002';
  end if;
  if p_action = 'viewed' then
    insert into public.lesson_progress (user_id, lesson_id, viewed_at) values (auth.uid(), p_lesson, now())
    on conflict (user_id, lesson_id) do update set viewed_at = coalesce(lesson_progress.viewed_at, now()), updated_at = now();
  elsif p_action = 'completed' then
    insert into public.lesson_progress (user_id, lesson_id, viewed_at, completed_at) values (auth.uid(), p_lesson, now(), now())
    on conflict (user_id, lesson_id) do update
      set viewed_at = coalesce(lesson_progress.viewed_at, now()), completed_at = coalesce(lesson_progress.completed_at, now()), updated_at = now();
  elsif p_action = 'uncompleted' then
    update public.lesson_progress set completed_at = null, updated_at = now() where user_id = auth.uid() and lesson_id = p_lesson;
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
end $$;

-- Merge progress kept in the browser while browsing as a guest.
-- Only viewed/completed can be imported — never practice, assessment or mastery.
create or replace function public.import_guest_progress(p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare it jsonb; v_n int := 0;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then raise exception 'invalid input' using errcode = '22023'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if exists (select 1 from public.lessons where id = (it ->> 'lesson_id')::uuid and status = 'published') then
      perform public.mark_lesson((it ->> 'lesson_id')::uuid, case when (it ->> 'completed')::boolean then 'completed' else 'viewed' end);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

create or replace function public.on_attempt_graded(p_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts; e public.exams; r record;
  v_threshold numeric := public.setting_num('mastery_threshold', 0.8);
  v_min int := public.setting_num('mastery_min_questions', 2)::int;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if a.user_id is null then return; end if;          -- guests: progress lives in the browser
  select * into e from public.exams where id = a.exam_id;
  for r in
    select q.lesson_id, sum(coalesce(aa.score, 0)) as got, sum(v.total_marks) as max, count(*) as n
    from public.attempt_answers aa
    join public.exam_questions eq on eq.id = aa.exam_question_id
    join public.question_versions v on v.id = eq.question_version_id
    join public.questions q on q.id = v.question_id
    where aa.attempt_id = a.id and q.lesson_id is not null
    group by q.lesson_id
  loop
    insert into public.lesson_progress as lp (user_id, lesson_id, practice_completed_at, assessment_passed_at, last_accuracy, best_accuracy)
    values (a.user_id, r.lesson_id,
            case when e.kind = 'practice' then now() end,
            case when e.kind = 'formal' and a.passed then now() end,
            round(r.got / nullif(r.max, 0), 4), round(r.got / nullif(r.max, 0), 4))
    on conflict (user_id, lesson_id) do update set
      practice_completed_at = coalesce(lp.practice_completed_at, excluded.practice_completed_at),
      assessment_passed_at  = coalesce(lp.assessment_passed_at, excluded.assessment_passed_at),
      last_accuracy = excluded.last_accuracy,
      best_accuracy = greatest(lp.best_accuracy, excluded.best_accuracy),
      updated_at = now();
    if e.kind = 'formal' and a.passed and r.n >= v_min and r.got / nullif(r.max, 0) >= v_threshold then
      update public.lesson_progress set mastered_at = coalesce(mastered_at, now())
      where user_id = a.user_id and lesson_id = r.lesson_id and practice_completed_at is not null;
    end if;
  end loop;
  if public.results_released(e) then
    perform public.notify(a.user_id, 'exam_result', 'نتيجة اختبار: ' || e.title, null, '/attempts/' || a.id);
  end if;
end $$;
revoke execute on function public.on_attempt_graded(uuid) from public, anon, authenticated;

create or replace function public.my_review_recommendations(p_limit int default 10)
returns table (lesson_id uuid, lesson_title text, accuracy numeric, questions_seen bigint, practice_exam_ids uuid[])
language sql stable security definer set search_path = public as $$
  with recent as (
    select q.lesson_id, sum(coalesce(aa.score, 0)) got, sum(v.total_marks) mx, count(*) n
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    join public.attempt_answers aa on aa.attempt_id = a.id
    join public.exam_questions eq on eq.id = aa.exam_question_id
    join public.question_versions v on v.id = eq.question_version_id
    join public.questions q on q.id = v.question_id
    where a.user_id = auth.uid() and a.status = 'graded' and q.lesson_id is not null
      and a.started_at > now() - interval '120 days' and public.results_released(e)
    group by q.lesson_id
  )
  select r.lesson_id, l.title, round(r.got / nullif(r.mx, 0), 4), r.n,
         array(select x.id from public.exams x where x.lesson_id = r.lesson_id and x.kind = 'practice' and x.status = 'published')
  from recent r join public.lessons l on l.id = r.lesson_id
  where r.got / nullif(r.mx, 0) < public.setting_num('weak_lesson_threshold', 0.6)
  order by r.got / nullif(r.mx, 0) asc
  limit least(greatest(p_limit, 1), 50);
$$;

alter table public.lesson_progress enable row level security;
alter table public.bookmarks enable row level security;
create policy progress_select on public.lesson_progress for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.lesson_progress from anon, authenticated;
create policy bookmarks_own on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Announcements (platform-wide, public)
-- ---------------------------------------------------------------------------
create type public.announcement_kind as enum ('text', 'image', 'pdf', 'link', 'mixed');

create table public.announcements (
  id                    uuid primary key default gen_random_uuid(),
  kind                  public.announcement_kind not null default 'text',
  title                 text not null check (char_length(title) between 2 and 200),
  body                  text check (char_length(body) <= 10000),
  attachment_resource_id uuid references public.resources (id) on delete set null,
  link_url              text check (link_url is null or link_url ~ '^https://'),
  target_level_id       uuid references public.levels (id),
  publish_at            timestamptz not null default now(),
  expires_at            timestamptz,
  pinned                boolean not null default false,
  created_by            uuid references auth.users (id),
  created_at            timestamptz not null default now(),
  check (expires_at is null or expires_at > publish_at)
);
create index announcements_feed_idx on public.announcements (pinned desc, publish_at desc);

create or replace function public.can_manage_announcements()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_platform_role(array['super_admin','moderator','content_editor']::public.platform_role[]);
$$;

alter table public.announcements enable row level security;
create policy announcements_select on public.announcements for select to anon, authenticated
  using ((publish_at <= now() and (expires_at is null or expires_at > now())) or public.can_manage_announcements());
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.can_manage_announcements() and created_by = auth.uid());
create policy announcements_update on public.announcements for update to authenticated
  using (public.can_manage_announcements()) with check (public.can_manage_announcements());
create policy announcements_delete on public.announcements for delete to authenticated using (public.can_manage_announcements());

-- ---------------------------------------------------------------------------
-- Certificates (accounts). No Ijazah kind exists.
-- ---------------------------------------------------------------------------
create type public.certificate_kind as enum ('level_completion');

create table public.certificates (
  id                uuid primary key default gen_random_uuid(),
  kind              public.certificate_kind not null default 'level_completion',
  verification_code text not null unique default upper(encode(gen_random_bytes(6), 'hex')),
  student_id        uuid not null references auth.users (id) on delete cascade,
  student_name      text not null,
  title             text not null,
  edition_id        uuid references public.curriculum_editions (id),
  level_id          uuid not null references public.levels (id),
  issuer_name       text not null,
  completion_date   date not null default current_date,
  evidence          jsonb not null default '{}'::jsonb,
  issued_at         timestamptz not null default now(),
  revoked_at        timestamptz,
  revoke_reason     text,
  check (title !~* '(إجاز|اجاز|ijaz)')
);
create unique index certificates_one_active on public.certificates (student_id, level_id) where revoked_at is null;

create or replace function public.issue_level_certificate(p_level uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare lv public.levels; v_missing int; v_attempt uuid; v_name text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into lv from public.levels where id = p_level;
  if lv.id is null then raise exception 'level not found' using errcode = 'P0002'; end if;
  select id into v_id from public.certificates where student_id = auth.uid() and level_id = p_level and revoked_at is null;
  if v_id is not null then return v_id; end if;

  if not exists (select 1 from public.lessons l join public.chapters ch on ch.id = l.chapter_id
                 where ch.level_id = p_level and l.status = 'published') then
    raise exception 'not eligible: level has no published lessons yet' using errcode = '22023';
  end if;
  select count(*) into v_missing
  from public.lessons l join public.chapters ch on ch.id = l.chapter_id
  left join public.lesson_progress p on p.lesson_id = l.id and p.user_id = auth.uid()
  where ch.level_id = p_level and l.status = 'published' and p.completed_at is null;
  if v_missing > 0 then raise exception 'not eligible: % lesson(s) not completed', v_missing using errcode = '22023'; end if;

  select a.id into v_attempt from public.exam_attempts a join public.exams e on e.id = a.exam_id
  where a.user_id = auth.uid() and a.status = 'graded' and a.passed
    and e.level_id = p_level and e.is_level_final and e.kind = 'formal'
  order by a.graded_at desc limit 1;
  if v_attempt is null then raise exception 'not eligible: final level exam not passed' using errcode = '22023'; end if;

  select coalesce(nullif(full_name, ''), display_name) into v_name from public.profiles where id = auth.uid();
  if coalesce(v_name, '') = '' then raise exception 'please complete your full name first' using errcode = '22023'; end if;

  insert into public.certificates (student_id, student_name, title, edition_id, level_id, issuer_name, evidence)
  values (auth.uid(), v_name, 'شهادة إتمام ' || lv.title, lv.edition_id, p_level,
          (select value #>> '{}' from public.platform_settings where key = 'platform_issuer_name'),
          jsonb_build_object('attempt_id', v_attempt))
  returning id into v_id;
  perform public.notify(auth.uid(), 'certificate', 'صدرت لك شهادة إتمام مستوى', lv.title, '/certificates/' || v_id);
  return v_id;
end $$;

create or replace function public.revoke_certificate(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.certificates set revoked_at = now(), revoke_reason = p_reason where id = p_id;
  perform public.audit('revoke', 'certificates', p_id::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.verify_certificate(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'valid', c.revoked_at is null, 'revoked', c.revoked_at is not null,
    'kind_label', 'شهادة إتمام مستوى تعليمي',
    'disclaimer', 'هذه شهادة تعليمية وليست إجازة قرآنية.',
    'title', c.title, 'student_name', c.student_name, 'issuer_name', c.issuer_name,
    'level', lv.title, 'curriculum', cu.title, 'edition', ed.label,
    'completion_date', c.completion_date, 'issued_at', c.issued_at)
  from public.certificates c
  join public.levels lv on lv.id = c.level_id
  left join public.curriculum_editions ed on ed.id = c.edition_id
  left join public.curricula cu on cu.id = ed.curriculum_id
  where c.verification_code = upper(btrim(p_code));
$$;

alter table public.certificates enable row level security;
create policy certificates_select on public.certificates for select to authenticated
  using (student_id = auth.uid() or public.is_super_admin());
revoke insert, update, delete on public.certificates from anon, authenticated;
create trigger audit_certificates after insert or update or delete on public.certificates
  for each row execute function public.tg_audit_row();

revoke execute on function public.notify(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Supabase Storage: small images only (lesson illustrations, announcement
-- images). Large PDFs/audio go to Cloudflare R2 (see docs) to stay within the
-- free Supabase storage and egress quotas.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 1048576, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- readable when a visible (published, or staff) resource row points at it
create policy images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'images' and exists (
    select 1 from public.resources r where r.provider = 'supabase' and r.object_key = objects.name));
create policy images_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'images' and public.is_content_staff());
create policy images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and public.is_content_staff());
create policy images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.has_platform_role(array['super_admin','content_editor']::public.platform_role[]));
