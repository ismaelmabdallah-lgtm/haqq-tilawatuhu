-- =============================================================================
-- TEST-ONLY content for the e2e stand-in database (tests/e2e/fake-supabase-server.mjs).
-- Applied after the curriculum seed and scripts/test_seed.sql. Never run on a
-- real project. Ids: md5('haqq:e2e:…'); titles marked «[تجريبي]».
-- =============================================================================
begin;
select set_config('app.content_transition', 'on', true);

-- the browser suites start many guest attempts from one address
update public.platform_settings set value = '1000' where key = 'guest_attempts_per_hour';

-- encyclopedia (hidden from the main nav, still published)
insert into public.tajweed_topics (id, slug, title, definition, explanation_md, origin, status, scientifically_verified)
values (md5('haqq:e2e:topic')::uuid, 'izhar-halqi', 'الإظهار الحلقي', '[تجريبي] إخراج الحرف من مخرجه من غير غنة.',
        E'[تجريبي] شرح موجز.\n\n[[quran:1:1]]', 'supplementary_explanation', 'published', true);
insert into public.topic_lessons values (md5('haqq:e2e:topic')::uuid, md5('haqq:test:lesson')::uuid);

-- academy
insert into public.articulation_points (id, code, general_area, name, sort_order, description_md, origin, status, scientifically_verified)
values (md5('haqq:e2e:point')::uuid, 'halq-aqsa', 'الحلق', 'أقصى الحلق', 1, '[تجريبي] أبعد الحلق مما يلي الصدر.', 'supplementary_explanation', 'published', true);
insert into public.letter_characteristics (id, code, name, has_opposite, description_md, origin, status, scientifically_verified) values
  (md5('haqq:e2e:jahr')::uuid, 'jahr', 'الجهر', true, '[تجريبي] انحباس جريان النفس.', 'supplementary_explanation', 'published', true),
  (md5('haqq:e2e:safeer')::uuid, 'safeer', 'الصفير', false, null, 'supplementary_explanation', 'published', true);
insert into public.letter_characteristics (id, code, name, has_opposite, opposite_id, origin, status, scientifically_verified)
values (md5('haqq:e2e:hams')::uuid, 'hams', 'الهمس', true, md5('haqq:e2e:jahr')::uuid, 'supplementary_explanation', 'published', true);
update public.letter_characteristics set opposite_id = md5('haqq:e2e:hams')::uuid where id = md5('haqq:e2e:jahr')::uuid;
insert into public.academy_letters (id, letter, sort_order, articulation_point_id, description_md, common_mistakes_md, origin, status, scientifically_verified) values
  (md5('haqq:e2e:hamza')::uuid, 'ء', 1, md5('haqq:e2e:point')::uuid, '[تجريبي] الهمزة.', '[تجريبي] تسهيلها في غير موضعه.', 'supplementary_explanation', 'published', true),
  (md5('haqq:e2e:haa')::uuid, 'هـ', 2, md5('haqq:e2e:point')::uuid, null, null, 'supplementary_explanation', 'published', true);
insert into public.academy_letter_characteristics values (md5('haqq:e2e:hamza')::uuid, md5('haqq:e2e:jahr')::uuid), (md5('haqq:e2e:haa')::uuid, md5('haqq:e2e:hams')::uuid);
insert into public.academy_letter_examples values (md5('haqq:e2e:hamza')::uuid, md5('haqq:test:example')::uuid);

-- announcements: one visible + pinned, one expired (RLS hides it)
insert into public.announcements (id, kind, title, body, link_url, publish_at, expires_at, pinned) values
  (md5('haqq:e2e:ann1')::uuid, 'text', '[تجريبي] إعلان مثبّت', 'نص الإعلان التجريبي.', 'https://tanzil.net', now() - interval '1 day', null, true),
  (md5('haqq:e2e:ann2')::uuid, 'text', 'إعلان منتهي لا يجوز أن يظهر', null, null, '2026-01-01', '2026-02-01', false);

-- a PDF summary on level 1 and an audio clip in the test lesson, stored in "materials"
insert into public.resources (id, kind, title, description, provider, object_key, mime_type, size_bytes, is_downloadable, origin, status, scientifically_verified) values
  (md5('haqq:e2e:pdf')::uuid, 'pdf', '[تجريبي] ملخص المستوى الأول', 'ملخص للتحميل', 'supabase', 'pdf/2026/11/e2e-summary.pdf', 'application/pdf', 524288, true, 'independent_material', 'published', true),
  (md5('haqq:e2e:audio')::uuid, 'audio', '[تجريبي] تسجيل الإظهار', null, 'supabase', 'audio/2026/11/e2e-clip.mp3', 'audio/mpeg', 20480, false, 'independent_material', 'published', true);
insert into storage.objects (bucket_id, name) values ('materials', 'pdf/2026/11/e2e-summary.pdf'), ('materials', 'audio/2026/11/e2e-clip.mp3'), ('materials', 'pdf/2026/11/e2e-draft.pdf');
insert into public.level_resources (level_id, resource_id) values (md5('haqq:level:minhaj-al-darisin-ed2-2026:l1')::uuid, md5('haqq:e2e:pdf')::uuid);
insert into public.lesson_resources (lesson_id, resource_id, sort_order) values (md5('haqq:test:lesson')::uuid, md5('haqq:e2e:audio')::uuid, 3);

-- drafts that must never be public
insert into public.lessons (id, chapter_id, code, sort_order, title, origin, status)
values (md5('haqq:e2e:draft-lesson')::uuid, md5('haqq:chapter:minhaj-al-darisin-ed2-2026:l1-c2')::uuid, 'zz-draft-lesson', 98, 'درس مسودة لا يجوز أن يظهر', 'supplementary_explanation', 'draft');
insert into public.resources (id, kind, title, provider, object_key, origin, status)
values (md5('haqq:e2e:draft-pdf')::uuid, 'pdf', 'ملف مسودة لا يجوز أن يظهر', 'supabase', 'pdf/2026/11/e2e-draft.pdf', 'independent_material', 'draft');
insert into public.level_resources (level_id, resource_id) values (md5('haqq:level:minhaj-al-darisin-ed2-2026:l1')::uuid, md5('haqq:e2e:draft-pdf')::uuid);
commit;
