/**
 * E2E (Phase 3): guest exam journeys against the REAL exam SQL (PGlite via
 * tests/e2e/pglite-api.mjs) on the Cloudflare Pages emulator. Nothing touches
 * the live database: every /rest/v1 request is answered by PGlite.
 *   (fixture build) npx wrangler pages dev out --port 8788
 *   node tests/e2e/exam-flow.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { waitForSite } from "./warmup.mjs";
import { readFileSync } from "node:fs";
import { sql } from "./sql.mjs";
import { EXAMS } from "../fixtures/exam-fixture.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:8799";
await waitForSite(BASE);
const exam = Object.fromEntries(EXAMS.map((e) => [e.key, e]));
const raw = readFileSync("vendor/tanzil/quran-uthmani.txt", "utf8");
const ayah = (s, a) => raw.split("\n").find((l) => l.startsWith(`${s}|${a}|`)).replace(/\r$/, "").split("|").slice(2).join("|");

const browser = await chromium.launch();
const errors = [];
const leaked = [];

async function newPage({ clock = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar" });
  const page = await ctx.newPage();
  if (clock) await page.clock.install();
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  // Before submission nothing the browser receives may contain answer keys.
  page.on("response", async (res) => {
    if (!/rpc\/(get_attempt_paper|save_answer|start_attempt)/.test(res.url())) return;
    const body = await res.text().catch(() => "");
    if (/"correct"|"accepted"|الإظهار والإدغام والإقلاب والإخفاء\./.test(body)) leaked.push(res.url());
  });
  return page;
}

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n   ${e.message.split("\n")[0]}`); }
}
const q = (page, n) => page.locator("li[data-question]").nth(n - 1);

async function startExam(page, key, name) {
  await page.goto(`${BASE}/exams/${exam[key].id}/`, { waitUntil: "networkidle" });
  if (name !== undefined) await page.getByLabel(/اسمك/).fill(name);
  await page.locator("[data-start]").click();
  await page.waitForURL(/\/attempts\/[0-9a-f-]{36}\/$/);
  await page.locator("[data-exam-player]").waitFor();
  return new URL(page.url()).pathname.split("/")[2];
}

async function reorder(page, n, wanted) {
  for (let target = 0; target < wanted.length; target++) {
    for (;;) {
      const texts = await q(page, n).locator("ol li span.flex-1").allInnerTexts();
      const at = texts.indexOf(wanted[target]);
      if (at === target) break;
      await q(page, n).getByRole("button", { name: `تحريك «${wanted[target]}» لأعلى` }).click();
    }
  }
  // Options are shuffled per attempt: if they already arrived in the right order
  // no move was made, and the student must confirm the order explicitly.
  const confirm = q(page, n).getByRole("button", { name: "اعتماد هذا الترتيب" });
  if (await confirm.count()) await confirm.click();
}

// ------------------------------------------------------------------ practice exam (all auto-graded types)
let practiceAttempt = "";
{
  const page = await newPage();
  await check("exam intro shows settings; guest can start without an account", async () => {
    await page.goto(`${BASE}/exams/${exam.practice.id}/`, { waitUntil: "networkidle" });
    const t = await page.locator("main").innerText();
    assert.ok(t.includes(exam.practice.title) && t.includes("١٥") && t.includes("فور التسليم"), "title, 15 marks, immediate result");
    practiceAttempt = await startExam(page, "practice", "طالب تجريبي");
    assert.equal(await page.locator("li[data-question]").count(), 10);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("haqq:attempts:v1")));
    assert.equal(stored[0].attempt_id, practiceAttempt);
    assert.ok(stored[0].token.length >= 20, "guest token kept in this browser");
  });

  await check("question with quran_ref renders verbatim Tanzil text (الفاتحة ٢–٤)", async () => {
    const verse = await q(page, 10).locator("[data-quran-ref] blockquote").innerText();
    for (const a of [2, 3, 4]) assert.ok(verse.includes(ayah(1, a)));
  });

  await check("answers autosave and survive a page refresh", async () => {
    await q(page, 1).getByLabel("أربعة").check();
    await q(page, 2).getByLabel("الهمزة").check();              // partial: 1 of 2 correct choices
    await q(page, 3).getByRole("radio", { name: "صواب" }).click();
    await q(page, 4).locator("input").fill("الاظهار");          // normalized match for «الإظهار»
    await page.locator("[data-save-state]", { hasText: "تم حفظ إجاباتك" }).waitFor({ timeout: 10_000 });
    await page.reload({ waitUntil: "load" });
    await page.locator("[data-exam-player]").waitFor();
    assert.ok(await q(page, 1).getByLabel("أربعة").isChecked());
    assert.equal(await q(page, 4).locator("input").inputValue(), "الاظهار");
  });

  await check("required questions are enforced before submission", async () => {
    await page.getByRole("button", { name: "تسليم الاختبار" }).click();
    assert.ok((await page.locator("main").innerText()).includes("لم تُجب عن ٦ سؤال إلزامي"));
    assert.ok(await page.getByRole("button", { name: "تأكيد التسليم" }).isDisabled());
    await page.getByRole("button", { name: "رجوع" }).click();
  });

  await check("fill-blank, ordering, matching, table and drag-drop inputs", async () => {
    await q(page, 5).getByLabel("الفراغ b1").fill("الإدغام");
    await q(page, 5).getByLabel("الفراغ b2").fill("الإخفاء");
    await reorder(page, 6, ["الإظهار", "الإدغام", "الإقلاب", "الإخفاء"]);
    await q(page, 7).getByLabel("ما يقابل: الإظهار").selectOption({ label: "حروف الحلق" });
    await q(page, 7).getByLabel("ما يقابل: الإقلاب").selectOption({ label: "الباء" });
    await q(page, 8).getByLabel("النون الساكنة قبل الباء — الحكم").fill("الإقلاب");
    await q(page, 8).getByLabel("النون الساكنة قبل الهمزة — الحكم").fill("الإظهار");
    await q(page, 9).getByLabel("الفراغ s1").selectOption({ label: "الباء" });
    await q(page, 10).getByLabel("الفاتحة").check();
  });

  await check("no answer key reached the browser before submission", async () => assert.deepEqual(leaked, []));

  await check("submission is graded by the database: 14/15 with partial credit, keys and explanation shown", async () => {
    await page.getByRole("button", { name: "تسليم الاختبار" }).click();
    await page.getByRole("button", { name: "تأكيد التسليم" }).click();
    await page.locator("[data-result=graded]").waitFor({ timeout: 15_000 });
    const score = await page.locator("[data-score]").innerText();
    assert.ok(score.includes("١٤") && score.includes("١٥"), score);
    assert.ok((await page.locator("[data-outcome]").innerText()).includes("ناجح"));
    assert.ok((await q2Badge(page)).includes("١ / ٢"), "multiple choice partial credit");
    assert.ok((await page.locator("[data-explanation]").first().innerText()).includes("الإظهار والإدغام والإقلاب والإخفاء"));
    assert.ok(await page.locator("[data-correct]").count() >= 9, "correct answers shown (model_answer_visibility = after_submission)");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("haqq:attempts:v1")));
    assert.equal(stored[0].finished, true);
  });

  await check("the result reopens from the same link after refresh", async () => {
    await page.reload({ waitUntil: "load" });
    await page.locator("[data-result=graded]").waitFor();
    const n = { rows: await sql("select status, total_score from public.exam_attempts where id = $1", [practiceAttempt]) };
    assert.equal(n.rows[0].status, "graded");
    assert.equal(Number(n.rows[0].total_score), 14);
  });
  await page.context().close();
}
async function q2Badge(page) { return page.locator("[data-result-item]").nth(1).locator("header").innerText(); }

// ------------------------------------------------------------------ formal exam: essay → pending, resume
{
  const page = await newPage();
  let attempt = "";
  await check("formal exam shows a server-synced timer and resumes the same attempt", async () => {
    attempt = await startExam(page, "formal", "");
    assert.ok((await page.getByRole("timer").innerText()).match(/[٤٥]:/), "≈5 minute countdown");
    await q(page, 1).getByLabel("أربعة").check();
    await page.locator("[data-save-state]", { hasText: "تم حفظ إجاباتك" }).waitFor({ timeout: 10_000 });
    await page.goto(`${BASE}/exams/${exam.formal.id}/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "متابعة المحاولة" }).click();
    await page.waitForURL(`**/attempts/${attempt}/`);
    await page.locator("[data-exam-player]").waitFor();
    assert.ok(await q(page, 1).getByLabel("أربعة").isChecked());
  });

  await check("essay answer leaves the result pending manual grading", async () => {
    await q(page, 2).locator("textarea").fill("إجابة مقالية تجريبية.");
    await page.getByRole("button", { name: "تسليم الاختبار" }).click();
    await page.getByRole("button", { name: "تأكيد التسليم" }).click();
    await page.locator("[data-result=pending]").waitFor({ timeout: 15_000 });
    const t = await page.locator("main").innerText();
    assert.ok(t.includes("بانتظار التصحيح اليدوي") && t.includes("قيد التصحيح"));
    const r = { rows: await sql("select status from public.exam_attempts where id = $1", [attempt]) };
    assert.equal(r.rows[0].status, "submitted");
  });

  await check("an attempt link opened in another browser (no token) cannot be read", async () => {
    const other = await newPage();
    await other.goto(`${BASE}/attempts/${attempt}/`, { waitUntil: "networkidle" });
    await other.locator("[data-attempt-missing]").waitFor();
    await other.context().close();
  });
  await page.context().close();
}

// ------------------------------------------------------------------ timer auto-submit
await check("when the timer reaches zero the attempt is submitted automatically", async () => {
  const page = await newPage({ clock: true });
  const attempt = await startExam(page, "formal", "");
  await q(page, 1).getByLabel("أربعة").check();
  await q(page, 2).locator("textarea").fill("إجابة.");
  await page.clock.fastForward("05:05");
  await page.locator("[data-result]").waitFor({ timeout: 15_000 });
  const r = { rows: await sql("select status from public.exam_attempts where id = $1", [attempt]) };
  assert.notEqual(r.rows[0].status, "in_progress");
  await page.context().close();
});

// ------------------------------------------------------------------ account-only exam
await check("account-only exam asks guests to sign in and offers no start button", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/exams/${exam.account.id}/`, { waitUntil: "networkidle" });
  const t = await page.locator("main").innerText();
  assert.ok(t.includes("يتطلب تسجيل الدخول"));
  assert.equal(await page.locator("[data-start]").count(), 0);
  await page.context().close();
});

await check("exam list shows the published test exams (live query)", async () => {
  const page = await newPage();
  await page.goto(`${BASE}/exams/`, { waitUntil: "networkidle" });
  await page.locator("[data-exam-link]", { hasText: "كل أنواع الأسئلة" }).waitFor();
  assert.equal(await page.locator("[data-exam-link]").count(), 3);
  await page.context().close();
});

await check("no uncaught page errors", async () => assert.deepEqual(errors, []));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
