-- =============================================================================
-- Migration 0006: solo-admin publishing, level files, Supabase Storage
-- "materials" bucket. ADDITIVE ONLY — no table, column, policy or function
-- from 0001–0005 is dropped or altered.
--
-- 1. publish_content(): lets a SUPER ADMIN move reviewable content straight
--    to published / archived / draft in one step. The peer-review path
--    (transition_content, assignments, comments) stays fully available for a
--    larger team. A direct publish by the super admin counts as the scientific
--    verification (decision 2026-11-27) and is recorded in review_events with
--    a full snapshot, like every other transition.
-- 2. level_resources: attach files (PDF summaries, past exams…) to a level.
-- 3. Storage bucket "materials" (private): upload/replace/delete only for super
--    admins; anyone may read an object only while a PUBLISHED resource row
--    (provider 'supabase') points at it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. One-step publishing for the super admin
-- ---------------------------------------------------------------------------
create or replace function public.publish_content(p_entity text, p_id uuid,
                                                  p_to public.content_status default 'published',
                                                  p_comment text default null)
returns public.content_status language plpgsql security definer set search_path = public as $$
declare m record; v_verified boolean;
begin
  if not public.is_super_admin() then
    raise exception 'only the super admin can publish directly' using errcode = '42501';
  end if;
  if p_to not in ('published', 'archived', 'draft') then
    raise exception 'direct transitions are limited to published, archived and draft' using errcode = '22023';
  end if;
  select * into m from public.content_meta(p_entity, p_id);   -- validates p_entity
  if m.row_data is null then raise exception 'content not found' using errcode = 'P0002'; end if;
  if m.status = p_to then return p_to; end if;

  v_verified := case p_to when 'published' then true
                          when 'archived' then coalesce((m.row_data ->> 'scientifically_verified')::boolean, false)
                          else false end;

  perform set_config('app.content_transition', 'on', true);
  execute format('update public.%I set status = $1, scientifically_verified = $2 where id = $3', p_entity)
    using p_to, v_verified, p_id;
  perform set_config('app.content_transition', 'off', true);

  insert into public.review_events (entity_type, entity_id, from_status, to_status, actor_id, comment, snapshot)
  values (p_entity, p_id, m.status, p_to, auth.uid(),
          coalesce(nullif(btrim(p_comment), ''), 'إجراء مباشر من المدير العام'), m.row_data);
  perform public.audit('publish_direct', p_entity, p_id::text, jsonb_build_object('from', m.status, 'to', p_to));
  return p_to;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Files attached to a level
-- ---------------------------------------------------------------------------
create table public.level_resources (
  level_id    uuid not null references public.levels (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  sort_order  int not null default 0,
  primary key (level_id, resource_id)
);
alter table public.level_resources enable row level security;
-- same pattern as the other link tables: visible when both ends are visible
create policy level_resources_select on public.level_resources for select to anon, authenticated
  using (exists (select 1 from public.levels x where x.id = level_id)
     and exists (select 1 from public.resources y where y.id = resource_id));
create policy level_resources_write on public.level_resources for all to authenticated
  using (public.is_content_staff()) with check (public.is_content_staff());
grant select, insert, update, delete on public.level_resources to anon, authenticated;
grant all on public.level_resources to service_role;

-- ---------------------------------------------------------------------------
-- 3. Storage: "materials" bucket (PDF, images, audio — 25 MiB, matching the
--    resources.size_bytes check). SVG is deliberately not allowed.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 26214400,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
              'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/webm'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy materials_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'materials' and exists (
    select 1 from public.resources r
    where r.provider = 'supabase' and r.object_key = objects.name and r.status = 'published'));
create policy materials_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'materials' and public.is_super_admin());
create policy materials_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.is_super_admin());
create policy materials_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'materials' and public.is_super_admin())
  with check (bucket_id = 'materials' and public.is_super_admin());
create policy materials_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.is_super_admin());
