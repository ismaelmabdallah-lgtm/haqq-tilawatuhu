-- =============================================================================
-- End-to-end tests (v2: unified public platform, guest exams).
-- Each check runs AS a role (`anon` or `authenticated` + JWT claims, plus
-- request headers for guests) exactly like PostgREST does.
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false);
$$;
create function tests.guest(p_ip text default '203.0.113.7') returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', false),
         set_config('request.headers', json_build_object('x-forwarded-for', p_ip || ', 10.0.0.1')::text, false);
$$;
create function tests.eq(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAIL: % — expected %, got %', label, expected, actual; end if;
  raise notice 'PASS: %', label;
end $$;
create function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function tests.throws(p_sql text, label text, p_match text default null) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if p_match is not null and sqlerrm !~* p_match then
      raise exception 'FAIL: % — rejected for the wrong reason: %', label, sqlerrm;
    end if;
    raise notice 'PASS: % (rejected: %)', label, sqlerrm; return;
  end;
  raise exception 'FAIL: % — statement succeeded but should have been rejected', label;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- fixtures
-- ---------------------------------------------------------------------------
\set S  '00000000-0000-0000-0000-0000000000a1'
\set RA '00000000-0000-0000-0000-0000000000a2'
\set R  '00000000-0000-0000-0000-0000000000a3'
\set E  '00000000-0000-0000-0000-0000000000a4'
\set G  '00000000-0000-0000-0000-0000000000a5'
\set M  '00000000-0000-0000-0000-0000000000a6'
\set U  '00000000-0000-0000-0000-0000000000b1'
\set X  '00000000-0000-0000-0000-0000000000b2'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'S',  's@t.io',  '{"full_name":"مدير المنصة"}'),
  (:'RA', 'ra@t.io', '{"full_name":"مدير المراجعة"}'),
  (:'R',  'r@t.io',  '{"full_name":"مراجع علمي"}'),
  (:'E',  'e@t.io',  '{"full_name":"محرر"}'),
  (:'G',  'g@t.io',  '{"full_name":"مصحح"}'),
  (:'M',  'm@t.io',  '{"full_name":"مشرف الإعلانات"}'),
  (:'U',  'u@t.io',  '{"full_name":"عبد الله أحمد"}'),
  (:'X',  'x@t.io',  '{"full_name":"متعلم آخر"}');
insert into public.platform_role_assignments (user_id, role) values
  (:'S','super_admin'), (:'RA','scientific_review_admin'), (:'R','scientific_reviewer'),
  (:'E','content_editor'), (:'G','grader'), (:'M','moderator');

select md5('haqq:lesson:minhaj-al-darisin-ed2-2026:l1-c2-02')::uuid as lesson_izhar,
       md5('haqq:lesson:minhaj-al-darisin-ed2-2026:l1-c2-03')::uuid as lesson_idgham,
       md5('haqq:chapter:minhaj-al-darisin-ed2-2026:l1-c2')::uuid   as chapter_noon,
       md5('haqq:level:minhaj-al-darisin-ed2-2026:l1')::uuid        as level1 \gset

-- Moves any reviewable item through the full review path (as the right people).
create function tests.review_and_publish(p_entity text, p_id uuid) returns void language plpgsql as $$
begin
  perform tests.login('00000000-0000-0000-0000-0000000000a4'); set local role authenticated;
  perform public.transition_content(p_entity, p_id, 'submitted');
  reset role;
  perform tests.login('00000000-0000-0000-0000-0000000000a3'); set local role authenticated;
  perform public.transition_content(p_entity, p_id, 'under_review');
  perform public.transition_content(p_entity, p_id, 'approved', 'مطابق للمصدر');
  reset role;
  perform tests.login('00000000-0000-0000-0000-0000000000a2'); set local role authenticated;
  perform public.transition_content(p_entity, p_id, 'published');
  reset role;
end $$;

select tests.eq((select count(*) from public.profiles)::int, 8, 'profiles auto-created for accounts');
select tests.ok(not exists (select 1 from pg_tables where schemaname = 'public'
                            and tablename ~ '(institution|circle|attendance|recitation|ijazah)'), 'no mosque/tenant tables remain');

-- ---------------------------------------------------------------------------
-- 1. Public, no account
-- ---------------------------------------------------------------------------
select tests.guest(); set role anon;
select tests.eq((select count(*) from public.curricula)::int, 1, 'guest sees the curriculum');
select tests.eq((select count(*) from public.levels)::int, 4, 'guest sees the 4 levels');
select tests.eq((select count(*) from public.chapters)::int, 16, 'guest sees the 16 chapters');
select tests.eq((select count(*) from public.lessons)::int, 0, 'guest sees no unreviewed lessons');
select tests.throws('select * from public.question_keys', 'guest cannot read answer keys');
select tests.eq((select count(*) from public.platform_settings where key = 'guest_ip_salt')::int, 0, 'secret settings are hidden');
select tests.throws('select public.heartbeat()', 'keep-alive function is not public');
reset role;

-- ---------------------------------------------------------------------------
-- 2. Team roles
-- ---------------------------------------------------------------------------
select tests.login(:'U'); set role authenticated;
select tests.throws(format('insert into public.lessons (chapter_id, code, sort_order, title, origin, created_by) values (%L, %L, 1, %L, %L, %L)',
                    :'chapter_noon', 'u-lesson', 'درس', 'independent_material', :'U'), 'a learner account cannot write content');
select tests.throws(format('insert into public.platform_role_assignments (user_id, role) values (%L, %L)', :'U', 'super_admin'),
                    'a learner cannot grant himself a role');
select tests.eq((select count(*) from public.profiles)::int, 1, 'a learner sees only his own profile');
reset role;
select tests.login(:'E'); set role authenticated;
select tests.throws(format('insert into public.platform_role_assignments (user_id, role) values (%L, %L)', :'X', 'grader'),
                    'an editor cannot manage team roles');
reset role;
select tests.login(:'S'); set role authenticated;
insert into public.platform_role_assignments (user_id, role, granted_by) values (:'X', 'grader', :'S');
delete from public.platform_role_assignments where user_id = :'X';
select tests.eq((select count(*) from public.audit_log where entity_type = 'platform_role_assignments' and entity_id = :'X')::int, 2, 'role grant and removal are both audited');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Scientific review
-- ---------------------------------------------------------------------------
select tests.login(:'E'); set role authenticated;
update public.lessons set body_md = 'الإظهار لغة: البيان.' where id = :'lesson_izhar';
select tests.eq(public.transition_content('lessons', :'lesson_izhar', 'submitted'), 'submitted'::public.content_status, 'editor submits a lesson');
select tests.throws(format('update public.lessons set body_md = %L where id = %L', 'x', :'lesson_izhar'), 'submitted content is frozen', 'frozen');
select tests.throws(format('update public.lessons set status = %L where id = %L', 'published', :'lesson_izhar'), 'status cannot be set directly');
select tests.throws(format('select public.transition_content(%L, %L, %L)', 'lessons', :'lesson_izhar', 'under_review'), 'editor cannot start a review');
reset role;
select tests.login(:'R'); set role authenticated;
select public.transition_content('lessons', :'lesson_izhar', 'under_review');
select tests.throws(format('select public.transition_content(%L, %L, %L)', 'lessons', :'lesson_izhar', 'changes_requested'), 'requesting changes needs a comment');
select tests.eq(public.transition_content('lessons', :'lesson_izhar', 'approved', 'مطابق ص51'), 'approved'::public.content_status, 'reviewer approves');
select tests.throws(format('select public.transition_content(%L, %L, %L)', 'lessons', :'lesson_izhar', 'published'), 'a reviewer cannot publish');
insert into public.lessons (chapter_id, code, sort_order, title, origin, created_by)
values (:'chapter_noon', 'r-extra', 99, 'شرح إضافي', 'supplementary_explanation', :'R') returning id as lesson_r \gset
select public.transition_content('lessons', :'lesson_r', 'submitted');
select public.transition_content('lessons', :'lesson_r', 'under_review');
select tests.throws(format('select public.transition_content(%L, %L, %L)', 'lessons', :'lesson_r', 'approved'), 'reviewer cannot approve own content');
select tests.throws(format('insert into public.lessons (chapter_id, code, sort_order, title, origin, created_by) values (%L, %L, 98, %L, %L, %L)',
                           :'chapter_noon', 'no-src', 'بلا مصدر', 'curriculum_quoted', :'R'), 'curriculum-quoted content requires a source page');
reset role;
select tests.login(:'RA'); set role authenticated;
select public.transition_content('lessons', :'lesson_izhar', 'published');
reset role;
select tests.guest(); set role anon;
select tests.eq((select count(*) from public.lessons)::int, 1, 'guest now sees the published lesson');
select tests.eq((select scientifically_verified from public.lessons), true, 'published lesson is marked scientifically verified');
select tests.eq((select count(*) from public.search_content('الاظهار'))::int, 1, 'Arabic search ignores hamza');
select tests.eq((select count(*) from public.search_content('الإِظْهَار'))::int, 1, 'Arabic search ignores diacritics');
reset role;
select tests.eq((select count(*) from public.review_events where entity_id = :'lesson_izhar')::int, 4, 'every transition is in the review history');

-- ---------------------------------------------------------------------------
-- 4. Question bank (versioned) and exam building
-- ---------------------------------------------------------------------------
select tests.login(:'E'); set role authenticated;
insert into public.questions (lesson_id, created_by) values (:'lesson_izhar', :'E') returning id as q1 \gset
insert into public.questions (lesson_id, created_by) values (:'lesson_izhar', :'E') returning id as q2 \gset
insert into public.questions (created_by) values (:'E') returning id as q3 \gset
select tests.throws(format($q$insert into public.question_versions (question_id, version_no, prompt, created_by)
  values (%L, 1, '{"parts":[{"id":"a","type":"single_choice","marks":1,"correct":"x"}]}', %L)$q$, :'q1', :'E'),
  'answer data inside a prompt is rejected', 'answer data');
insert into public.question_versions (question_id, version_no, prompt, created_by) values (:'q1', 1, $j${
  "stem": "بيّن حكم الراء في الكلمة", "quran_ref": {"surah": 2, "ayah": 4},
  "parts": [
    {"id":"wasl","type":"single_choice","marks":1,"options":[{"id":"tafkheem","text":"تفخيم"},{"id":"tarqeeq","text":"ترقيق"}]},
    {"id":"waqf","type":"single_choice","marks":1,"options":[{"id":"tafkheem","text":"تفخيم"},{"id":"tarqeeq","text":"ترقيق"}]},
    {"id":"reason","type":"short_text","marks":2}]}$j$, :'E') returning id as v1 \gset
insert into public.question_keys values (:'v1',
  '{"wasl":{"correct":"tafkheem"},"waqf":{"correct":"tarqeeq"},"reason":{"accepted":["لسكونها بعد كسر"],"manual_if_unmatched":true}}',
  '{"reason":"لأنها ساكنة بعد كسر"}', 'انظر ص158');
insert into public.question_versions (question_id, version_no, prompt, created_by) values (:'q2', 1, $j${
  "stem": "أجب عما يلي",
  "parts": [
    {"id":"mc","type":"multiple_choice","marks":2,"options":[{"id":"a","text":"ء"},{"id":"b","text":"ب"},{"id":"c","text":"هـ"}]},
    {"id":"ord","type":"ordering","marks":3,"items":[{"id":"x","text":"1"},{"id":"y","text":"2"},{"id":"z","text":"3"}]},
    {"id":"blank","type":"fill_blank","marks":2,"text":"أحكام النون {b1} و{b2}"},
    {"id":"match","type":"matching","marks":2,"left":[{"id":"l1","text":"الإظهار"},{"id":"l2","text":"الإقلاب"}],"right":[{"id":"r1","text":"البيان"},{"id":"r2","text":"التحويل"}]},
    {"id":"tf","type":"true_false","marks":1}]}$j$, :'E') returning id as v2 \gset
insert into public.question_keys values (:'v2', $j${
  "mc":{"correct":["a","c"],"scoring":"partial"}, "ord":{"order":["x","y","z"]},
  "blank":{"slots":{"b1":["الساكنة","ساكنة"],"b2":"التنوين"}}, "match":{"slots":{"l1":"r1","l2":"r2"}}, "tf":{"correct":true}}$j$);
insert into public.question_versions (question_id, version_no, prompt, created_by) values (:'q3', 1,
  '{"stem":"اشرح مراتب الغنة","parts":[{"id":"essay","type":"long_text","marks":4}]}', :'E') returning id as v3 \gset
insert into public.question_keys values (:'v3', '{}', '{"essay":"..."}');

insert into public.exams (title, kind, pass_percent, model_answer_visibility, created_by)
values ('اختبار أحكام النون', 'formal', 50, 'after_submission', :'E') returning id as exam1 \gset
select tests.throws(format('insert into public.exam_questions (exam_id, question_version_id) values (%L, %L)', :'exam1', :'v1'),
                    'unreviewed questions cannot enter an exam', 'reviewed');
reset role;

select tests.review_and_publish('question_versions', :'v1');
select tests.review_and_publish('question_versions', :'v2');
select tests.review_and_publish('question_versions', :'v3');

select tests.login(:'E'); set role authenticated;
select tests.eq((select current_version_id from public.questions where id = :'q1'), :'v1'::uuid, 'publishing sets the current version');
select tests.throws(format('update public.question_keys set key = %L where question_version_id = %L', '{}', :'v1'), 'published answer key is frozen');
select public.new_question_version(:'q1') as v1b \gset
select tests.eq((select version_no from public.question_versions where id = :'v1b'), 2, 'corrections create a new version');
select tests.eq((select current_version_id from public.questions where id = :'q1'), :'v1'::uuid, 'the draft v2 does not replace published v1');
insert into public.exam_questions (exam_id, question_version_id, sort_order, is_required) values
  (:'exam1', :'v1', 1, true), (:'exam1', :'v2', 2, true), (:'exam1', :'v3', 3, false);
select tests.eq(public.publish_exam(:'exam1'), 18.00, 'exam total marks computed on publish');
select tests.throws(format('update public.exams set pass_percent = 10 where id = %L', :'exam1'), 'published exam configuration is frozen');
select tests.throws(format('delete from public.exam_questions where exam_id = %L', :'exam1'), 'published exam paper is frozen');
reset role;
select tests.login(:'U'); set role authenticated;
select tests.throws(format('select public.publish_exam(%L)', :'exam1'), 'a learner cannot manage exams');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Guest exam, end to end, no account
-- ---------------------------------------------------------------------------
select tests.guest('203.0.113.7'); set role anon;
select tests.eq((select count(*) from public.exams)::int, 1, 'guest sees the published exam');
select tests.eq((select count(*) from public.exam_questions)::int, 0, 'guest cannot read the exam paper table');
select public.start_attempt(:'exam1', null, 'زائر') as started \gset
select (:'started')::jsonb ->> 'attempt_id' as att, (:'started')::jsonb ->> 'guest_token' as tok \gset
select tests.ok(length(:'tok') >= 30, 'a new guest attempt returns a one-time token');
select tests.eq((public.start_attempt(:'exam1', :'tok') ->> 'attempt_id'), :'att', 'the token resumes the same attempt (network drop)');
select tests.ok(public.start_attempt(:'exam1', :'tok') ->> 'guest_token' is null, 'the token is never sent again');
select tests.throws(format('select public.get_attempt_paper(%L)', :'att'), 'the paper is not available without the token', 'not found');
select tests.throws(format('select public.get_attempt_paper(%L, %L)', :'att', 'wrong-token'), 'a wrong token is refused', 'not found');
select public.get_attempt_paper(:'att', :'tok') as paper \gset
select tests.ok(:'paper' !~ '(accepted|"correct"|لسكونها|"order")', 'the paper contains no answer data');
select (q ->> 'exam_question_id') as eq1 from jsonb_array_elements((:'paper')::jsonb -> 'questions') q where q -> 'parts' -> 0 ->> 'id' = 'wasl' \gset
select (q ->> 'exam_question_id') as eq2 from jsonb_array_elements((:'paper')::jsonb -> 'questions') q where q -> 'parts' -> 0 ->> 'id' = 'mc' \gset
select (q ->> 'exam_question_id') as eq3 from jsonb_array_elements((:'paper')::jsonb -> 'questions') q where q -> 'parts' -> 0 ->> 'id' = 'essay' \gset
select public.save_answer(:'att', :'eq1', '{"parts":{"wasl":{"choice":"tafkheem"},"waqf":{"choice":"tafkheem"},"reason":{"text":"لِسُكونِها بعدَ كَسْر"}}}', :'tok');
select tests.throws(format('select public.submit_attempt(%L, null, %L)', :'att', :'tok'), 'cannot submit with a required question unanswered', 'unanswered');
select public.save_answer(:'att', :'eq2', $j${"parts":{"mc":{"choices":["a","b"]},"ord":{"order":["x","y","z"]},
  "blank":{"slots":{"b1":"ساكنه","b2":"غنة"}},"match":{"slots":{"l1":"r1","l2":"r1"}},"tf":{"value":true}}}$j$, :'tok');
select public.save_answer(:'att', :'eq3', '{"parts":{"essay":{"text":"الغنة لها مراتب..."}}}', :'tok');
select tests.throws('update public.attempt_answers set score = 99', 'a guest cannot write scores');
select tests.eq(public.submit_attempt(:'att', null, :'tok'), 'submitted'::public.attempt_status, 'submitted; the essay waits for a grader');
select tests.eq(public.submit_attempt(:'att', null, :'tok'), 'submitted'::public.attempt_status, 'double submission is idempotent');
select tests.throws(format('select public.save_answer(%L, %L, %L, %L)', :'att', :'eq1', '{}', :'tok'), 'answers cannot change after submission');
select public.get_attempt_result(:'att', :'tok') as res \gset
select tests.eq(((:'res')::jsonb ->> 'total_score')::numeric, 9.00, 'automatic score: Q1 3/4 + Q2 6/10 (partial marks)');
select tests.eq(((:'res')::jsonb ->> 'pending_manual')::boolean, true, 'result shows the essay as pending');
select tests.ok((:'res')::jsonb -> 'items' -> 0 -> 'explanation' is not null, 'corrections and explanations shown (after_submission)');
select tests.eq(((:'res')::jsonb ->> 'guest_name'), 'زائر', 'optional guest name kept on the result');
select tests.eq((select count(*) from public.exam_attempts)::int, 0, 'guests cannot list attempts');
reset role;

select tests.guest('198.51.100.9'); set role anon;
select tests.throws(format('select public.get_attempt_result(%L, %L)', :'att', 'someone-else'), 'another visitor cannot see this result', 'not found');
reset role;

select tests.login(:'U'); set role authenticated;
select tests.throws(format('select public.grade_answer(%L, %L, %L)', :'att', :'eq3', '{"essay":4}'), 'a learner cannot grade');
reset role;
select tests.login(:'G'); set role authenticated;
select tests.ok((select count(*) from public.list_grading_queue() where attempt_id = :'att'::uuid) = 1, 'the essay appears in the grading queue');
select tests.throws(format('select public.grade_answer(%L, %L, %L)', :'att', :'eq3', '{"essay":5}'), 'a score above the part marks is rejected');
select tests.eq(public.grade_answer(:'att', :'eq3', '{"essay":3}', 'جيد'), 'graded'::public.attempt_status, 'grader marks the essay');
reset role;
select tests.guest('203.0.113.7'); set role anon;
select tests.eq((public.get_attempt_result(:'att', :'tok') ->> 'total_score')::numeric, 12.00, 'final score 9 automatic + 3 manual');
select tests.eq((public.get_attempt_result(:'att', :'tok') ->> 'passed')::boolean, true, 'pass computed at 50%');
reset role;

-- ---------------------------------------------------------------------------
-- 6. Guest abuse limits and retention
-- ---------------------------------------------------------------------------
update public.platform_settings set value = '3' where key = 'guest_attempts_per_hour';
select tests.guest('192.0.2.50'); set role anon;
select public.start_attempt(:'exam1'); select public.start_attempt(:'exam1'); select public.start_attempt(:'exam1');
select tests.throws(format('select public.start_attempt(%L)', :'exam1'), 'a 4th new attempt from one address within an hour is refused', 'too many');
reset role;
select tests.guest('192.0.2.51'); set role anon;
select tests.ok(public.start_attempt(:'exam1') ? 'guest_token', 'other addresses are unaffected');
reset role;
select tests.ok((select bool_and(ip_hash is not null and ip_hash !~ '192\.0\.2') from public.exam_attempts where user_id is null),
                'network addresses are stored only as salted hashes');
update public.platform_settings set value = '30' where key = 'guest_attempts_per_hour';
insert into public.exam_attempts (exam_id, guest_token_hash, question_order, max_score, started_at, status)
values (:'exam1', 'old', '{}', 18, now() - interval '40 days', 'graded') returning id as old_att \gset
select tests.guest('192.0.2.60'); set role anon; select public.start_attempt(:'exam1'); reset role;
select tests.eq((select count(*) from public.exam_attempts where id = :'old_att')::int, 0, 'guest attempts older than 30 days are purged automatically');

-- ---------------------------------------------------------------------------
-- 7. Exam settings: account-only exams, attempt limits, delayed release
-- ---------------------------------------------------------------------------
select tests.login(:'E'); set role authenticated;
insert into public.exams (title, kind, requires_account, max_attempts, is_level_final, level_id, pass_percent, created_by)
values ('الاختبار النهائي للمستوى الأول', 'formal', true, 1, true, :'level1', 60, :'E') returning id as exam_final \gset
insert into public.exam_questions (exam_id, question_version_id) values (:'exam_final', :'v2');
select public.publish_exam(:'exam_final');
insert into public.exams (title, kind, result_release, model_answer_visibility, created_by)
values ('اختبار قصير', 'formal', 'manual', 'after_release', :'E') returning id as exam2 \gset
insert into public.exam_questions (exam_id, question_version_id) values (:'exam2', :'v2');
select public.publish_exam(:'exam2');
select tests.throws($q$insert into public.exams (title, is_level_final, requires_account, created_by) values ('x', true, false, auth.uid())$q$,
                    'a level-final exam must require an account (certificates need identity)');
reset role;

select tests.guest('192.0.2.70'); set role anon;
select tests.throws(format('select public.start_attempt(%L)', :'exam_final'), 'guests cannot take an account-only exam', 'requires signing in');
select public.start_attempt(:'exam2') as s2 \gset
select (:'s2')::jsonb ->> 'attempt_id' as att2, (:'s2')::jsonb ->> 'guest_token' as tok2 \gset
select (q ->> 'exam_question_id') as eq2b from jsonb_array_elements(public.get_attempt_paper(:'att2', :'tok2') -> 'questions') q \gset
select public.submit_attempt(:'att2', jsonb_build_object(:'eq2b', '{"parts":{"tf":{"value":false}}}'::jsonb), :'tok2');
select tests.eq(public.get_attempt_result(:'att2', :'tok2') ->> 'released', 'false', 'results hidden until released');
reset role;
select tests.login(:'E'); set role authenticated; select public.release_results(:'exam2'); reset role;
select tests.guest('192.0.2.70'); set role anon;
select tests.eq(public.get_attempt_result(:'att2', :'tok2') ->> 'released', 'true', 'results visible after release');
reset role;

-- ---------------------------------------------------------------------------
-- 8. Optional account: progress, claiming guest attempts, certificate
-- ---------------------------------------------------------------------------
select tests.login(:'U'); set role authenticated;
select tests.eq(public.claim_guest_attempts(array[:'att'::uuid], array[:'tok']), 1, 'a new account claims its earlier guest attempt');
select tests.eq((select count(*) from public.list_my_attempts())::int, 1, 'the claimed attempt is in the history');
select tests.ok((select assessment_passed_at is not null from public.lesson_progress where lesson_id = :'lesson_izhar'), 'claiming records the passed assessment');
select tests.ok((select mastered_at is null from public.lesson_progress where lesson_id = :'lesson_izhar'), 'no mastery at 64% accuracy without practice');
select tests.eq(public.import_guest_progress(jsonb_build_array(
                  jsonb_build_object('lesson_id', :'lesson_izhar', 'completed', true),
                  jsonb_build_object('lesson_id', :'lesson_idgham', 'completed', true))), 1, 'browser progress imported (unpublished lessons ignored)');
select tests.throws('update public.lesson_progress set mastered_at = now()', 'a learner cannot self-award mastery');
select tests.throws(format('select public.issue_level_certificate(%L)', :'level1'), 'no certificate before passing the final exam', 'final level exam');
select public.start_attempt(:'exam_final') ->> 'attempt_id' as attf \gset
select (q ->> 'exam_question_id') as eqf from jsonb_array_elements(public.get_attempt_paper(:'attf') -> 'questions') q \gset
select public.submit_attempt(:'attf', jsonb_build_object(:'eqf', $j${"parts":{"mc":{"choices":["a","c"]},"ord":{"order":["x","y","z"]},
  "blank":{"slots":{"b1":"الساكنة","b2":"التنوين"}},"match":{"slots":{"l1":"r1","l2":"r2"}},"tf":{"value":true}}}$j$::jsonb));
select tests.eq((select total_score from public.list_my_attempts(:'exam_final')), 10.00, 'full marks on the final exam');
select tests.throws(format('select public.start_attempt(%L)', :'exam_final'), 'attempt limit is enforced for accounts', 'limit');
select public.issue_level_certificate(:'level1') as cert \gset
select tests.eq(public.issue_level_certificate(:'level1'), :'cert'::uuid, 'certificate issuance is idempotent');
select verification_code as code from public.certificates where id = :'cert' \gset
reset role;
select tests.login(:'X'); set role authenticated;
select tests.eq((select count(*) from public.certificates)::int, 0, 'another learner cannot list my certificates');
select tests.eq((select count(*) from public.lesson_progress)::int, 0, 'another learner cannot see my progress');
reset role;
select tests.guest(); set role anon;
select tests.eq(public.verify_certificate(:'code') ->> 'valid', 'true', 'anyone can verify a certificate by code');
select tests.eq(public.verify_certificate(:'code') ->> 'disclaimer', 'هذه شهادة تعليمية وليست إجازة قرآنية.', 'verification states it is not an Ijazah');
reset role;
select tests.throws(format($q$insert into public.certificates (student_id, student_name, title, level_id, issuer_name)
                              values (%L, 'x', 'إجازة في التجويد', %L, 'x')$q$, :'U', :'level1'),
                    'a certificate can never be titled as an Ijazah', 'check constraint');
select tests.ok(not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                            where t.typname = 'certificate_kind' and e.enumlabel ilike '%ijaz%'), 'no certificate kind represents an Ijazah');

-- ---------------------------------------------------------------------------
-- 9. Announcements, storage, internal functions
-- ---------------------------------------------------------------------------
select tests.login(:'M'); set role authenticated;
insert into public.announcements (title, body, created_by) values ('بدء التسجيل في المسابقة', 'تفاصيل...', :'M');
insert into public.announcements (title, publish_at, expires_at, created_by) values ('إعلان منتهٍ', now() - interval '2 days', now() - interval '1 day', :'M');
reset role;
select tests.login(:'U'); set role authenticated;
select tests.throws($q$insert into public.announcements (title, created_by) values ('x', auth.uid())$q$, 'a learner cannot post announcements');
reset role;
select tests.guest(); set role anon;
select tests.eq((select count(*) from public.announcements)::int, 1, 'guests see current announcements only');
select tests.throws($q$insert into storage.objects (bucket_id, name) values ('images', 'x.png')$q$, 'guests cannot upload files');
reset role;
select tests.login(:'E'); set role authenticated;
insert into storage.objects (bucket_id, name) values ('images', 'lessons/izhar.webp');
insert into public.resources (kind, title, provider, object_key, created_by)
values ('image', 'مخطط الإظهار', 'supabase', 'lessons/izhar.webp', :'E') returning id as img \gset
reset role;
select tests.guest(); set role anon;
select tests.eq((select count(*) from storage.objects)::int, 0, 'an image of an unpublished resource is not downloadable');
reset role;
select tests.review_and_publish('resources', :'img');
select tests.guest(); set role anon;
select tests.eq((select count(*) from storage.objects)::int, 1, 'an image of a published resource is downloadable by anyone');
reset role;

select tests.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and p.proname in ('content_meta','audit','notify','grade_attempt_internal','on_attempt_graded','guest_rate_check',
                      'purge_expired_guest_data','attempt_for_caller','client_ip_hash','attempt_result_json','heartbeat')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  'internal SECURITY DEFINER functions are not callable through the API');

\echo 'ALL TESTS PASSED'
