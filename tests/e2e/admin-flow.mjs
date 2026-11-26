/**
 * E2E (Phase 4): accounts and the team dashboard against the REAL schema
 * (PGlite stand-in), every role driven through the UI. Nothing touches the
 * live database.
 *   (fixture build) npx wrangler pages dev out --port 8788
 *   node tests/e2e/admin-flow.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { waitForSite } from "./warmup.mjs";
import { sql } from "./sql.mjs";
import { sessionFor, TEST_USERS } from "./session.mjs";
import { EXAMS, SEED, examQuestionId } from "../fixtures/exam-fixture.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:8799";
await waitForSite(BASE, ["/", "/admin/", "/account/"]);
const exam = Object.fromEntries(EXAMS.map((e) => [e.key, e]));
const browser = await chromium.launch();
const errors = [];

async function pageAs(user, { localStorage: ls = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar" });
  const init = { ...ls };
  if (user) init["haqq-auth"] = JSON.stringify(sessionFor(user));
  await ctx.addInitScript((items) => { for (const [k, v] of Object.entries(items)) if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, init);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  return page;
}

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n   ${process.env.DEBUG ? e.stack : e.message.split("\n")[0]}`); }
}
const go = (page, path) => page.goto(BASE + path, { waitUntil: "load" });
const status = (page) => page.locator("[data-workflow] [data-status]").first().getAttribute("data-status");
const dbStatus = async (tbl, id) => (await sql(`select status, scientifically_verified as v from public.${tbl} where id = $1`, [id]))[0];
async function selectWhenReady(page, sel, value) {
  await page.locator(`${sel} option[value="${value}"]`).waitFor({ state: "attached" });
  await page.selectOption(sel, value);
}

// ------------------------------------------------------------------ gate
await check("admin gate: guests are asked to sign in, learners are refused", async () => {
  const guest = await pageAs(null);
  await go(guest, "/admin/");
  await guest.locator("[data-admin-gate=signin]").waitFor();
  const learner = await pageAs(TEST_USERS.learner);
  await go(learner, "/admin/");
  await learner.locator("[data-admin-gate=forbidden]").waitFor();
  await guest.context().close(); await learner.context().close();
});

// ------------------------------------------------------------------ lesson: create → submit → review → approve → publish
let lessonId = "";
await check("editor creates a draft lesson and submits it; cannot approve own work", async () => {
  const page = await pageAs(TEST_USERS.editor);
  await go(page, "/admin/content/edit/?entity=lessons");
  await selectWhenReady(page, "#f-chapter_id", SEED.chapterL1C2);
  await page.fill("#f-code", "e2e-lesson");
  await page.fill("#f-sort_order", "50");
  await page.fill("#f-title", "درس من الاختبار الآلي");
  await page.fill("#f-body_md", "شرح تجريبي.\n\n[[quran:1:1]]");
  await selectWhenReady(page, "#f-source_edition_id", SEED.edition);
  await page.fill("#f-source_page_start", "49");
  await page.locator("[data-save]").click();
  await page.waitForURL(/entity=lessons&id=/);
  lessonId = new URL(page.url()).searchParams.get("id");
  await page.locator("[data-workflow]").waitFor();
  assert.equal(await status(page), "draft");
  await page.locator("[data-transition=submitted]").click();
  await page.locator('[data-workflow] [data-status="submitted"]').waitFor();
  assert.equal(await page.locator("[data-transition=approved]").count(), 0, "no self-approval button");
  assert.equal((await dbStatus("lessons", lessonId)).status, "submitted");
  await page.context().close();
});

await check("reviewer starts review from the queue and approves on the editor page", async () => {
  const page = await pageAs(TEST_USERS.reviewer);
  await go(page, "/admin/review/");
  await page.locator(`[data-review-item="${lessonId}"]`).click();
  await page.locator("[data-review-detail] [data-transition=under_review]").click();
  await page.waitForFunction(async () => true);
  await go(page, `/admin/content/edit/?entity=lessons&id=${lessonId}`);
  await page.locator('[data-workflow] [data-status="under_review"]').waitFor();
  await page.locator("[data-transition=approved]").click();
  await page.locator('[data-workflow] [data-status="approved"]').waitFor();
  assert.equal(await page.locator("[data-transition=published]").count(), 0, "reviewers cannot publish");
  await page.context().close();
});

await check("review admin publishes; the lesson becomes public and scientifically verified", async () => {
  const page = await pageAs(TEST_USERS.reviewAdmin);
  await go(page, `/admin/content/edit/?entity=lessons&id=${lessonId}`);
  await page.locator("[data-transition=published]").click();
  await page.locator('[data-workflow] [data-status="published"]').waitFor();
  const r = await dbStatus("lessons", lessonId);
  assert.equal(r.status, "published"); assert.equal(r.v, true);
  const pub = await pageAs(null);
  await go(pub, "/levels/l1/");
  await pub.locator("[data-lesson-link=e2e-lesson]").waitFor({ timeout: 15_000 });   // live, no rebuild
  await pub.context().close();
  assert.ok(await page.locator("#f-title").isDisabled(), "published content is frozen");
  await page.context().close();
});

// ------------------------------------------------------------------ resource: changes requested path + upload fallback
let resourceId = "";
await check("resources: editors cannot upload files (super admin only) but YouTube resources still work", async () => {
  const page = await pageAs(TEST_USERS.editor);
  await go(page, "/admin/content/edit/?entity=resources");
  assert.equal(await page.inputValue("#f-provider"), "supabase", "upload is the default source");
  await page.locator("[data-upload-disabled]").waitFor();
  await page.selectOption("#f-kind", "video");
  await page.selectOption("#f-provider", "youtube");
  await page.fill("#f-title", "مقطع من الاختبار الآلي");
  await page.fill("#f-youtube_id", "dQw4w9WgXcQ");
  await page.locator("[data-save]").click();
  await page.waitForURL(/entity=resources&id=/);
  resourceId = new URL(page.url()).searchParams.get("id");
  await page.locator("[data-transition=submitted]").click();
  await page.locator('[data-workflow] [data-status="submitted"]').waitFor();
  await page.context().close();
});

await check("reviewer must explain a change request; the editor sees the comment and can edit again", async () => {
  const rev = await pageAs(TEST_USERS.reviewer);
  await go(rev, `/admin/content/edit/?entity=resources&id=${resourceId}`);
  await rev.locator("[data-transition=under_review]").click();
  await rev.locator('[data-workflow] [data-status="under_review"]').waitFor();
  await rev.locator("[data-transition=changes_requested]").click();
  assert.ok((await rev.locator("[data-workflow]").innerText()).includes("اكتب ملاحظة"));
  await rev.fill('[aria-label="ملاحظة المراجعة"]', "يرجى توضيح العنوان.");
  await rev.locator("[data-transition=changes_requested]").click();
  await rev.locator('[data-workflow] [data-status="changes_requested"]').waitFor();
  const ed = await pageAs(TEST_USERS.editor);
  await go(ed, `/admin/content/edit/?entity=resources&id=${resourceId}`);
  await ed.locator("[data-workflow]").getByText("يرجى توضيح العنوان.").first().waitFor();   // banner (+ history)
  assert.ok(await ed.locator("#f-title").isEnabled());
  await rev.context().close(); await ed.context().close();
});

// ------------------------------------------------------------------ question bank → exam builder
let questionId = "", versionId = "", examId = "";
await check("question editor rejects answer data in the prompt and saves a valid version with its key", async () => {
  const page = await pageAs(TEST_USERS.editor);
  await go(page, "/admin/questions/edit/");
  await page.locator("[data-save-scope]").click();
  await page.waitForURL(/questions\/edit\/\?id=/);
  questionId = new URL(page.url()).searchParams.get("id");
  await page.locator("[data-prompt-json]").waitFor();
  const bad = { stem: "سؤال", parts: [{ id: "p1", type: "single_choice", marks: 1, correct: "a", options: [{ id: "a", text: "أ" }, { id: "b", text: "ب" }] }] };
  await page.fill("[data-prompt-json]", JSON.stringify(bad));
  assert.ok((await page.locator("[data-validation-errors]").innerText()).includes("بيانات الإجابة"));
  const good = { stem: "سؤال من الاختبار الآلي", parts: [{ id: "p1", type: "single_choice", marks: 2, options: [{ id: "a", text: "أ" }, { id: "b", text: "ب" }] }] };
  await page.fill("[data-prompt-json]", JSON.stringify(good));
  await page.fill("[data-key-json]", JSON.stringify({ p1: { correct: "b" } }));
  await page.locator("[data-question-preview]").getByText("سؤال من الاختبار الآلي").waitFor();
  await page.locator("[data-save-version]").click();
  await page.getByText("تم الحفظ.").waitFor();
  versionId = (await sql("select id from public.question_versions where question_id = $1", [questionId]))[0].id;
  const k = (await sql("select key from public.question_keys where question_version_id = $1", [versionId]))[0];
  assert.deepEqual(k.key, { p1: { correct: "b" } });
  await page.locator("[data-transition=submitted]").click();
  await page.locator('[data-workflow] [data-status="submitted"]').waitFor();
  await page.context().close();
});

await check("reviewer sees the answer key during review; review admin publishes the version", async () => {
  const rev = await pageAs(TEST_USERS.reviewer);
  await go(rev, "/admin/review/");
  await rev.locator(`[data-review-item="${versionId}"]`).click();
  await rev.locator("[data-review-key]").waitFor();
  await rev.locator("[data-review-detail] [data-transition=under_review]").click();
  // the queue reloads after each transition: wait for the new status before reopening
  await rev.locator(`[data-review-item="${versionId}"] [data-status="under_review"]`).waitFor();
  await rev.locator(`[data-review-item="${versionId}"]`).click();
  await rev.locator("[data-review-detail] [data-transition=approved]").click();
  await rev.locator(`[data-review-item="${versionId}"] [data-status="approved"]`).waitFor();
  const ra = await pageAs(TEST_USERS.reviewAdmin);
  await go(ra, `/admin/questions/edit/?id=${questionId}`);
  await ra.locator("[data-version-editor] [data-transition=published]").click();
  await ra.locator('[data-version-editor] [data-status="published"]').waitFor();
  assert.equal((await dbStatus("question_versions", versionId)).status, "published");
  await rev.context().close(); await ra.context().close();
});

await check("exam builder: create, add the published question, publish", async () => {
  const page = await pageAs(TEST_USERS.editor);
  await go(page, "/admin/exams/edit/");
  await page.fill("#f-title", "اختبار من الاختبار الآلي");
  await page.locator("[data-save-exam]").click();
  await page.waitForURL(/exams\/edit\/\?id=/);
  examId = new URL(page.url()).searchParams.get("id");
  await selectWhenReady(page, '[aria-label="إضافة سؤال منشور"]', versionId);
  await page.locator("[data-add-question]").click();
  await page.locator("[data-exam-paper] li").first().waitFor();
  await page.locator("[data-publish-exam]").click();
  await page.locator('[data-exam-status="published"]').waitFor();
  const r = (await sql("select status, total_marks from public.exams where id = $1", [examId]))[0];
  assert.equal(r.status, "published"); assert.equal(Number(r.total_marks), 2);
  await page.context().close();
});

// ------------------------------------------------------------------ grading
await check("grader scores a pending essay; the attempt becomes graded", async () => {
  const s = (await sql("select public.start_attempt($1) as r", [exam.formal.id]))[0].r;
  const answers = { [examQuestionId("formal", "q1")]: { parts: { p1: { choice: "b" } } }, [examQuestionId("formal", "q11")]: { parts: { p1: { text: "إجابة مقالية للتصحيح" } } } };
  await sql("select public.submit_attempt($1, $2::jsonb, $3)", [s.attempt_id, JSON.stringify(answers), s.guest_token]);
  const page = await pageAs(TEST_USERS.grader);
  await go(page, "/admin/grading/");
  const item = page.locator("[data-grade-item]", { hasText: "إجابة مقالية للتصحيح" });
  await item.locator('input[type="number"]').fill("2.5");
  await item.locator("textarea").fill("أحسنت");
  await item.locator("[data-grade-submit]").click();
  await page.locator("[data-grade-item]", { hasText: "إجابة مقالية للتصحيح" }).waitFor({ state: "detached" });
  const r = (await sql("select status, total_score from public.exam_attempts where id = $1", [s.attempt_id]))[0];
  assert.equal(r.status, "graded"); assert.equal(Number(r.total_score), 3.5);
  await page.context().close();
});

// ------------------------------------------------------------------ team + announcements
await check("super admin grants a team role from the team page", async () => {
  const page = await pageAs(TEST_USERS.super);
  await go(page, "/admin/team/");
  await selectWhenReady(page, '[aria-label="المستخدم"]', TEST_USERS.learner.id);
  await page.selectOption('[aria-label="الدور"]', "moderator");
  await page.getByRole("button", { name: "منح الدور" }).click();
  await page.locator("[data-team] td", { hasText: TEST_USERS.learner.id }).waitFor();
  const r = { rows: await sql("select role from public.platform_role_assignments where user_id = $1", [TEST_USERS.learner.id]) };
  assert.deepEqual(r.rows.map((x) => x.role), ["moderator"]);
  await sql("delete from public.platform_role_assignments where user_id = $1", [TEST_USERS.learner.id]);
  await page.context().close();
});

await check("editor publishes an announcement (no review needed)", async () => {
  const page = await pageAs(TEST_USERS.editor);
  await go(page, "/admin/content/edit/?entity=announcements");
  await page.fill("#f-title", "إعلان من الاختبار الآلي");
  await page.fill("#f-body", "نص الإعلان");
  await page.locator("[data-save]").click();
  await page.waitForURL(/entity=announcements&id=/, { timeout: 15_000 }).catch(async () => {
    const status = await page.locator("[data-entity-editor] [role=status]").allInnerTexts();
    throw new Error(`no redirect after save; url=${page.url()} status=${JSON.stringify(status)}`);
  });
  const r = { rows: await sql("select count(*)::int as n from public.announcements where title = 'إعلان من الاختبار الآلي'") };
  assert.equal(r.rows[0].n, 1);
  await page.context().close();
});

// ------------------------------------------------------------------ learner account
await check("learner imports browser progress and claims a guest attempt into the account", async () => {
  const s = (await sql("select public.start_attempt($1) as r", [exam.formal.id]))[0].r;
  await sql("select public.submit_attempt($1, $2::jsonb, $3)", [s.attempt_id, JSON.stringify({ [examQuestionId("formal", "q1")]: { parts: { p1: { choice: "b" } } }, [examQuestionId("formal", "q11")]: { parts: { p1: { text: "x" } } } }), s.guest_token]);
  const page = await pageAs(TEST_USERS.learner, { localStorage: {
    "haqq:progress:v1": JSON.stringify({ [lessonId]: { viewed_at: new Date().toISOString(), completed_at: new Date().toISOString() } }),
    "haqq:attempts:v1": JSON.stringify([{ attempt_id: s.attempt_id, exam_id: exam.formal.id, exam_title: "x", token: s.guest_token, started_at: new Date().toISOString(), finished: true }]),
  } });
  await go(page, "/account/");
  await page.locator("[data-sync-guest]").click();
  await page.locator("[data-account] [role=status]").waitFor();
  const syncMsg = await page.locator("[data-account] [role=status]").innerText();
  assert.ok(syncMsg.includes("محاولة أُضيفت إلى حسابك"), syncMsg);
  const a = (await sql("select user_id from public.exam_attempts where id = $1", [s.attempt_id]))[0];
  assert.equal(a.user_id, TEST_USERS.learner.id);
  const p = (await sql("select completed_at from public.lesson_progress where user_id = $1 and lesson_id = $2", [TEST_USERS.learner.id, lessonId]))[0];
  assert.ok(p?.completed_at, "completion imported");
  await page.locator("[data-attempt-history] li").first().waitFor();
  await page.context().close();
});

await check("account-only exam: learner submits, sees 'unreleased', then sees the score after release", async () => {
  const page = await pageAs(TEST_USERS.learner);
  await go(page, `/exams/${exam.account.id}/`);
  await page.locator("[data-start]").click();
  await page.waitForURL(/\/attempts\//);
  await page.locator("li[data-question]").first().getByRole("radio", { name: "صواب" }).click();
  await page.getByRole("button", { name: "تسليم الاختبار" }).click();
  await page.getByRole("button", { name: "تأكيد التسليم" }).click();
  await page.locator("[data-result=unreleased]").waitFor({ timeout: 15_000 });
  const ed = await pageAs(TEST_USERS.editor);
  await go(ed, `/admin/exams/edit/?id=${exam.account.id}`);
  await ed.getByRole("button", { name: "إعلان النتائج" }).click();
  await ed.getByText("أُعلنت النتائج.").waitFor();
  await page.reload({ waitUntil: "load" });
  await page.locator("[data-result=graded]").waitFor();
  assert.ok((await page.locator("[data-score]").innerText()).includes("١"));
  await page.context().close(); await ed.context().close();
});

// ------------------------------------------------------------------ solo super admin (v1 workflow)
const SB = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54329";
const level1Id = (await sql("select md5('haqq:level:minhaj-al-darisin-ed2-2026:l1')::uuid as id"))[0].id;

await check("super admin sees exactly 5 sidebar sections; grading is hidden", async () => {
  const page = await pageAs(TEST_USERS.super);
  await go(page, "/admin/");
  await page.locator("[data-admin-home]").waitFor();
  const items = (await page.locator('nav[aria-label="لوحة الفريق"] a').allInnerTexts()).map((t) => t.trim());
  assert.deepEqual(items, ["الرئيسية", "الملفات والملخصات", "الدروس", "بنك الأسئلة والاختبارات", "الإعلانات", "الأكاديمية والفريق"]);
  assert.equal(await page.locator('a[href="/admin/grading/"]').count(), 0);
  await page.context().close();
});

let soloLesson = "";
await check("super admin publishes a lesson in one click; it is public immediately (no rebuild)", async () => {
  const page = await pageAs(TEST_USERS.super);
  await go(page, "/admin/content/edit/?entity=lessons");
  await selectWhenReady(page, "#f-chapter_id", SEED.chapterL1C2);
  await page.fill("#f-code", "solo-lesson");
  await page.fill("#f-sort_order", "60");
  await page.fill("#f-title", "درس المدير المنفرد");
  await page.selectOption("#f-origin", "supplementary_explanation");
  await page.locator("[data-save]").click();
  await page.waitForURL(/entity=lessons&id=/);
  soloLesson = new URL(page.url()).searchParams.get("id");
  await page.locator("[data-direct=published]").click();
  await page.locator('[data-workflow] [data-status="published"]').waitFor();
  const r = await dbStatus("lessons", soloLesson);
  assert.equal(r.status, "published"); assert.equal(r.v, true, "direct publish counts as verified");
  const pub = await pageAs(null);
  await go(pub, "/levels/l1/");
  await pub.locator("[data-lesson-link=solo-lesson]").waitFor({ timeout: 15_000 });
  await page.locator("[data-direct=archived]").click();
  await page.locator('[data-workflow] [data-status="archived"]').waitFor();
  await pub.reload({ waitUntil: "load" });
  await pub.locator("[data-lesson-link=zz-test-lesson]").waitFor();
  assert.equal(await pub.locator("[data-lesson-link=solo-lesson]").count(), 0, "archived lesson hidden");
  await page.context().close(); await pub.context().close();
});

let uploadedKey = "";
await check("super admin uploads a PDF to Supabase Storage, attaches it to level 1 and publishes it", async () => {
  const page = await pageAs(TEST_USERS.super);
  await go(page, "/admin/content/edit/?entity=resources");
  await page.locator("[data-upload-enabled]").waitFor();
  await page.setInputFiles("[data-upload-input]", { name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await page.getByText("نوع الملف غير مسموح").waitFor();
  await page.setInputFiles("[data-upload-input]", { name: "summary.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.getByText(/تم الرفع/).waitFor();
  uploadedKey = await page.inputValue("#f-object_key");
  assert.match(uploadedKey, /^pdf\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
  await page.fill("#f-title", "ملخص رفعه المدير");
  await page.locator("[data-save]").click();
  await page.waitForURL(/entity=resources&id=/);
  await selectWhenReady(page, '[aria-label="إضافة إلى يظهر في صفحة المستوى"]', level1Id);
  await page.locator('[data-links="level_resources"]').getByRole("button", { name: "إضافة" }).click();
  await page.locator('[data-links="level_resources"] li', { hasText: "المستوى الأول" }).waitFor();
  const anon = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"role":"anon"}').toString("base64url")}.x`;
  const before = await fetch(`${SB}/storage/v1/object/sign/materials/${uploadedKey}`, { method: "POST", headers: { authorization: `Bearer ${anon}`, "content-type": "application/json" }, body: "{}" });
  assert.equal(before.status, 400, "draft file not downloadable");
  await page.locator("[data-direct=published]").click();
  await page.locator('[data-workflow] [data-status="published"]').waitFor();
  const pub = await pageAs(null);
  await go(pub, "/levels/l1/");
  const item = pub.locator("[data-resource]", { hasText: "ملخص رفعه المدير" });
  await item.waitFor({ timeout: 15_000 });
  await Promise.all([
    pub.context().waitForEvent("request", (r) => r.url().includes(`/object/sign/materials/${uploadedKey}`) && r.method() === "GET"),
    item.locator("[data-download]").click(),
  ]);
  await page.context().close(); await pub.context().close();
});

await check("storage refuses uploads from editors and guests at the server (not just in the UI)", async () => {
  const ed = await pageAs(TEST_USERS.editor);
  await go(ed, "/admin/content/edit/?entity=resources");
  await ed.locator("[data-upload-disabled]").waitFor();
  await ed.context().close();
  const tok = (u) => u ? sessionFor(u).access_token : `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"role":"anon"}').toString("base64url")}.x`;
  for (const who of [TEST_USERS.editor, null]) {
    const r = await fetch(`${SB}/storage/v1/object/materials/pdf/2026/11/hack.pdf`, { method: "POST", headers: { authorization: `Bearer ${tok(who)}`, "content-type": "application/pdf" }, body: "%PDF" });
    assert.equal(r.status, 403, `${who?.email ?? "guest"} upload must be refused`);
  }
  const del = await fetch(`${SB}/storage/v1/object/materials`, { method: "DELETE", headers: { authorization: `Bearer ${tok(TEST_USERS.editor)}`, "content-type": "application/json" }, body: JSON.stringify({ prefixes: [uploadedKey] }) });
  assert.deepEqual(await del.json(), [], "editor cannot delete");
  assert.equal((await sql("select count(*)::int as n from storage.objects where name = $1", [uploadedKey]))[0].n, 1);
});

await check("question builder: essay/audio parts are rejected in v1; no essay template", async () => {
  const page = await pageAs(TEST_USERS.super);
  await go(page, "/admin/questions/edit/");
  await page.locator("[data-save-scope]").click();
  await page.waitForURL(/questions\/edit\/\?id=/);
  await page.locator("[data-prompt-json]").waitFor();
  assert.equal(await page.getByRole("button", { name: "سؤال مقالي" }).count(), 0);
  for (const t of ["إكمال الفراغ", "سحب الكلمات وإفلاتها", "توصيل", "ترتيب", "إكمال جدول", "أحكام الراء (وصل/وقف/سبب)"]) {
    assert.equal(await page.getByRole("button", { name: t }).count(), 1, `template ${t}`);
  }
  await page.fill("[data-prompt-json]", JSON.stringify({ stem: "اشرح", parts: [{ id: "e", type: "long_text", marks: 2 }] }));
  await page.fill("[data-key-json]", "{}");
  assert.ok((await page.locator("[data-validation-errors]").innerText()).includes("غير مفعّلة"));
  await page.context().close();
});

await check("exam builder: a new formal exam defaults to account-only; practice stays open to guests", async () => {
  const page = await pageAs(TEST_USERS.super);
  await go(page, "/admin/exams/edit/");
  assert.equal(await page.isChecked("#f-requires_account"), false);
  await page.selectOption("#f-kind", "formal");
  assert.equal(await page.isChecked("#f-requires_account"), true);
  await page.context().close();
});

await check("auth forms render for guests (sign in / sign up / reset)", async () => {
  const page = await pageAs(null);
  await go(page, "/account/");
  await page.locator("[data-auth=signin]").waitFor();
  await page.getByRole("button", { name: "إنشاء حساب جديد" }).click();
  await page.locator("[data-auth=signup]").waitFor();
  assert.ok(await page.getByLabel(/الاسم الكامل/).isVisible());
  await page.getByRole("button", { name: "نسيت كلمة المرور" }).click();
  await page.locator("[data-auth=forgot]").waitFor();
  await page.context().close();
});

await check("no uncaught page errors", async () => assert.deepEqual(errors, []));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
