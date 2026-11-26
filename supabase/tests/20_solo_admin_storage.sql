-- =============================================================================
-- Tests for migration 0006 (runs after 10_security_and_workflow.sql, reusing its
-- tests.* helpers and fixture accounts): direct publishing by the super admin,
-- level files, the "materials" storage bucket, answer-key protection and a
-- guest attempt on directly-published content.
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1
\set S  '00000000-0000-0000-0000-0000000000a1'
\set E  '00000000-0000-0000-0000-0000000000a4'
\set U  '00000000-0000-0000-0000-0000000000b1'

select md5('haqq:level:minhaj-al-darisin-ed2-2026:l2')::uuid as level2,
       md5('haqq:chapter:minhaj-al-darisin-ed2-2026:l2-c1')::uuid as chapter_madd \gset

-- ---------------------------------------------------------------- direct publishing
select tests.login(:'S'); set role authenticated;
insert into public.lessons (chapter_id, code, sort_order, title, origin, created_by)
values (:'chapter_madd', 'solo-1', 90, 'درس المدير المنفرد', 'supplementary_explanation', :'S') returning id as solo_lesson \gset
reset role;

select tests.login(:'E'); set role authenticated;
select tests.throws(format('select public.publish_content(%L, %L)', 'lessons', :'solo_lesson'),
                    'a content editor cannot publish directly', 'only the super admin');
reset role;

select tests.guest(); set role anon;
select tests.throws(format('select public.publish_content(%L, %L)', 'lessons', :'solo_lesson'),
                    'a guest cannot publish directly');
reset role;

select tests.login(:'S'); set role authenticated;
select tests.eq(public.publish_content('lessons', :'solo_lesson')::text, 'published', 'super admin publishes own draft in one step');
reset role;
select tests.ok((select status = 'published' and scientifically_verified from public.lessons where id = :'solo_lesson'),
                'direct publish marks the lesson published and verified');
select tests.ok(exists (select 1 from public.review_events where entity_id = :'solo_lesson' and to_status = 'published'
                        and snapshot ->> 'title' = 'درس المدير المنفرد'), 'direct publish is recorded with a snapshot');

select tests.guest(); set role anon;
select tests.eq((select count(*) from public.lessons where id = :'solo_lesson')::int, 1, 'guests see the directly published lesson');
reset role;

select tests.login(:'S'); set role authenticated;
select tests.throws(format('select public.publish_content(%L, %L, %L)', 'lessons', :'solo_lesson', 'approved'),
                    'direct transitions are limited to published/archived/draft', 'limited');
select public.publish_content('lessons', :'solo_lesson', 'archived');
reset role;
select tests.guest(); set role anon;
select tests.eq((select count(*) from public.lessons where id = :'solo_lesson')::int, 0, 'archived content is hidden from guests');
reset role;

-- a directly published question version can be used in an exam
select tests.login(:'S'); set role authenticated;
insert into public.questions (created_by) values (:'S') returning id as sq \gset
insert into public.question_versions (question_id, version_no, prompt, created_by) values (:'sq', 1,
  '{"stem":"سؤال المدير","parts":[{"id":"p1","type":"single_choice","marks":1,"options":[{"id":"a","text":"أ"},{"id":"b","text":"ب"}]}]}', :'S')
  returning id as sv \gset
insert into public.question_keys (question_version_id, key) values (:'sv', '{"p1":{"correct":"b"}}');
select public.publish_content('question_versions', :'sv');
insert into public.exams (title, kind, created_by) values ('تدريب المدير', 'practice', :'S') returning id as sexam \gset
insert into public.exam_questions (exam_id, question_version_id) values (:'sexam', :'sv');
select public.publish_exam(:'sexam');
reset role;
select tests.ok((select current_version_id = :'sv' from public.questions where id = :'sq'), 'publishing a version makes it current');

-- answer keys stay server-side; a guest can take and submit the exam
select tests.guest('198.51.100.20'); set role anon;
select tests.throws('select * from public.question_keys', 'guests cannot read answer keys');
select public.start_attempt(:'sexam') as sstart \gset
select (:'sstart')::jsonb ->> 'attempt_id' as satt, (:'sstart')::jsonb ->> 'guest_token' as stok \gset
select public.get_attempt_paper(:'satt', :'stok')::text as spaper \gset
select tests.ok(position('"correct"' in :'spaper') = 0, 'the paper contains no answer key');
select tests.ok(position('"b"' in :'spaper') > 0 and position('"stem"' in :'spaper') > 0, 'the paper contains the question');
select (q ->> 'exam_question_id') as seq from jsonb_array_elements((:'spaper')::jsonb -> 'questions') q \gset
select tests.eq(public.submit_attempt(:'satt', jsonb_build_object(:'seq', '{"parts":{"p1":{"choice":"b"}}}'::jsonb), :'stok')::text,
                'graded', 'guest attempt on directly published content is graded');
reset role;
select tests.login(:'U'); set role authenticated;
select tests.eq((select count(*) from public.question_keys)::int, 0, 'learners cannot read answer keys');
reset role;

-- ---------------------------------------------------------------- level files
select tests.login(:'S'); set role authenticated;
insert into public.resources (kind, title, provider, object_key, created_by)
values ('pdf', 'ملخص المستوى الثاني', 'supabase', 'levels/l2/summary.pdf', :'S') returning id as pdf \gset
insert into public.level_resources (level_id, resource_id) values (:'level2', :'pdf');
reset role;

select tests.guest(); set role anon;
select tests.eq((select count(*) from public.level_resources where level_id = :'level2')::int, 0, 'a draft file is not listed on the level');
select tests.throws(format('insert into public.level_resources (level_id, resource_id) values (%L, %L)', :'level2', :'pdf'),
                    'guests cannot attach files to levels');
reset role;

-- ---------------------------------------------------------------- materials storage
select tests.login(:'E'); set role authenticated;
select tests.throws($$insert into storage.objects (bucket_id, name) values ('materials', 'levels/l2/editor.pdf')$$,
                    'a content editor cannot upload to materials');
reset role;
select tests.guest(); set role anon;
select tests.throws($$insert into storage.objects (bucket_id, name) values ('materials', 'levels/l2/guest.pdf')$$,
                    'a guest cannot upload to materials');
reset role;

select tests.login(:'S'); set role authenticated;
insert into storage.objects (bucket_id, name) values ('materials', 'levels/l2/summary.pdf'), ('materials', 'levels/l2/orphan.pdf');
select tests.eq((select count(*) from storage.objects where bucket_id = 'materials')::int, 2, 'the super admin uploads and sees all materials');
reset role;

select tests.guest(); set role anon;
select tests.eq((select count(*) from storage.objects where bucket_id = 'materials')::int, 0, 'files of draft resources are not downloadable');
reset role;
select tests.login(:'S'); set role authenticated;
select public.publish_content('resources', :'pdf');
reset role;
select tests.guest(); set role anon;
select tests.eq((select count(*) from storage.objects where bucket_id = 'materials')::int, 1,
                'only the published resource''s file is downloadable (orphans stay private)');
select tests.eq((select count(*) from public.level_resources where level_id = :'level2')::int, 1, 'the published file is listed on its level');
with d as (delete from storage.objects where bucket_id = 'materials' returning 1) select tests.eq((select count(*) from d)::int, 0, 'guests cannot delete materials');
reset role;

select tests.login(:'E'); set role authenticated;
with d as (delete from storage.objects where bucket_id = 'materials' returning 1) select tests.eq((select count(*) from d)::int, 0, 'content editors cannot delete materials');
with u as (update storage.objects set name = 'x.pdf' where bucket_id = 'materials' returning 1) select tests.eq((select count(*) from u)::int, 0, 'content editors cannot rename materials');
reset role;

select tests.login(:'S'); set role authenticated;
with d as (delete from storage.objects where bucket_id = 'materials' and name = 'levels/l2/orphan.pdf' returning 1)
select tests.eq((select count(*) from d)::int, 1, 'the super admin deletes materials');
reset role;

select tests.ok((select not public and file_size_limit = 26214400 and not ('image/svg+xml' = any (allowed_mime_types))
                 from storage.buckets where id = 'materials'), 'materials bucket is private, 25 MiB, no SVG');

\echo 'ALL TESTS PASSED (0006)'
