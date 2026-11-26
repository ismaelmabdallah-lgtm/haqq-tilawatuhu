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
import { createApi } from "./pglite-api.mjs";
import { sessionFor, TEST_USERS, usersSql } from "./session.mjs";
import { EXAMS, SEED, examQuestionId } from "../fixtures/exam-fixture.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:8788";
await waitForSite(BASE, ["/", "/admin/", "/account/"]);
const exam = Object.fromEntries(EXAMS.map((e) => [e.key, e]));
const api = await createApi({ extraSql: [usersSql()] });
const browser = await chromium.launch();
const errors = [];

async function pageAs(user, { localStorage: ls = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar" });
  const init = { ...ls };
  if (user) init["haqq-auth"] = JSON.stringify(sessionFor(user));
  await ctx.addInitScript((items) => { for (const [k, v] of Object.entries(items)) if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, init);
  const page = await ctx.newPage();
  await page.route(/\/rest\/v1\//, (route) => route.request().method() === "OPTIONS"
    ? route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } })
    : api.handle(route));
  await page.route(/\/auth\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  return page;
}

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n   ${e.message.split("\n")[0]}`); }
}
const go = (page, path) => page.goto(BASE + path, { waitUntil: "networkidle" });
const status = (page) => page.locator("[data-workflow] [data-status]").first().getAttribute("data-status");
const dbStatus = async (tbl, id) => (await api.query(`select status, scientifically_verified as v from public.${tbl} where id = $1`, [id])).rows[0];
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
  await page.getByText("إعادة بناء الموقع غير مُفعّلة").first().waitFor();   // /api/rebuild reports no deploy hook locally
  assert.ok(await page.locator("#f-title").isDisabled(), "published content is frozen");
  await page.context().close();
});

// ------------------------------------------------------------------ resource: changes requested path + upload fallback
let resourceId = "";
await check("resources: R2 upload is disabled without a binding, YouTube resources still work", async () => {
  const page = await pageAs(TEST_USERS.editor);
  await go(page, "/admin/content/edit/?entity=resources");
  await page.selectOption("#f-provider", "r2");
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
  assert.ok((await ed.locator("[data-workflow]").innerText()).includes("يرجى توضيح العنوان."));
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
  versionId = (await api.query("select id from public.question_versions where question_id = $1", [questionId])).rows[0].id;
  const k = (await api.query("select key from public.question_keys where question_version_id = $1", [versionId])).rows[0];
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
  await rev.locator(`[data-review-item="${versionId}"]`).click();
  await rev.locator("[data-review-detail] [data-transition=approved]").click();
  await rev.locator(`[data-review-item="${versionId}"]`).click();
  await rev.locator('[data-review-detail] [data-status="approved"]').waitFor();
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
  const r = (await api.query("select status, total_marks from public.exams where id = $1", [examId])).rows[0];
  assert.equal(r.status, "published"); assert.equal(Number(r.total_marks), 2);
  await page.context().close();
});

// ------------------------------------------------------------------ grading
await check("grader scores a pending essay; the attempt becomes graded", async () => {
  const s = (await api.query("select public.start_attempt($1) as r", [exam.formal.id])).rows[0].r;
  const answers = { [examQuestionId("formal", "q1")]: { parts: { p1: { choice: "b" } } }, [examQuestionId("formal", "q11")]: { parts: { p1: { text: "إجابة مقالية للتصحيح" } } } };
  await api.query("select public.submit_attempt($1, $2::jsonb, $3)", [s.attempt_id, JSON.stringify(answers), s.guest_token]);
  const page = await pageAs(TEST_USERS.grader);
  await go(page, "/admin/grading/");
  const item = page.locator("[data-grade-item]", { hasText: "إجابة مقالية للتصحيح" });
  await item.locator('input[type="number"]').fill("2.5");
  await item.locator("textarea").fill("أحسنت");
  await item.locator("[data-grade-submit]").click();
  await page.locator("[data-grade-item]", { hasText: "إجابة مقالية للتصحيح" }).waitFor({ state: "detached" });
  const r = (await api.query("select status, total_score from public.exam_attempts where id = $1", [s.attempt_id])).rows[0];
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
  const r = await api.query("select role from public.platform_role_assignments where user_id = $1", [TEST_USERS.learner.id]);
  assert.deepEqual(r.rows.map((x) => x.role), ["moderator"]);
  await api.query("delete from public.platform_role_assignments where user_id = $1", [TEST_USERS.learner.id]);
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
  const r = await api.query("select count(*)::int as n from public.announcements where title = 'إعلان من الاختبار الآلي'");
  assert.equal(r.rows[0].n, 1);
  await page.context().close();
});

// ------------------------------------------------------------------ learner account
await check("learner imports browser progress and claims a guest attempt into the account", async () => {
  const s = (await api.query("select public.start_attempt($1) as r", [exam.formal.id])).rows[0].r;
  await api.query("select public.submit_attempt($1, $2::jsonb, $3)", [s.attempt_id, JSON.stringify({ [examQuestionId("formal", "q1")]: { parts: { p1: { choice: "b" } } }, [examQuestionId("formal", "q11")]: { parts: { p1: { text: "x" } } } }), s.guest_token]);
  const page = await pageAs(TEST_USERS.learner, { localStorage: {
    "haqq:progress:v1": JSON.stringify({ [lessonId]: { viewed_at: new Date().toISOString(), completed_at: new Date().toISOString() } }),
    "haqq:attempts:v1": JSON.stringify([{ attempt_id: s.attempt_id, exam_id: exam.formal.id, exam_title: "x", token: s.guest_token, started_at: new Date().toISOString(), finished: true }]),
  } });
  await go(page, "/account/");
  await page.locator("[data-sync-guest]").click();
  await page.locator("[data-account] [role=status]").waitFor();
  const syncMsg = await page.locator("[data-account] [role=status]").innerText();
  assert.ok(syncMsg.includes("محاولة أُضيفت إلى حسابك"), syncMsg);
  const a = (await api.query("select user_id from public.exam_attempts where id = $1", [s.attempt_id])).rows[0];
  assert.equal(a.user_id, TEST_USERS.learner.id);
  const p = (await api.query("select completed_at from public.lesson_progress where user_id = $1 and lesson_id = $2", [TEST_USERS.learner.id, lessonId])).rows[0];
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
await api.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
