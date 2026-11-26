/**
 * E2E (Phase 2): public site built from the TEST fixture, served by the
 * Cloudflare Pages emulator.
 *   node tests/fixtures/make-site-fixture.mjs
 *   HAQQ_CONTENT_FIXTURE=tests/fixtures/site.fixture.json NEXT_PUBLIC_FILES_BASE_URL=https://files.test npm run build
 *   npx wrangler pages dev out --port 8788
 *   node tests/e2e/public-site.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { waitForSite } from "./warmup.mjs";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:8788";
await waitForSite(BASE);
const raw = readFileSync("vendor/tanzil/quran-uthmani.txt", "utf8");
const ayah = (s, a) => raw.split("\n").find((l) => l.startsWith(`${s}|${a}|`)).replace(/\r$/, "").split("|").slice(2).join("|");
const LESSON = "/levels/l1/l1-c2/l1-c2-01/";
const fid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n   ${e.message.split("\n")[0]}`); }
}
const go = (p) => page.goto(BASE + p, { waitUntil: "networkidle" });
const text = () => page.locator("main").innerText();

await check("home: RTL, levels, verified hero verse", async () => {
  await go("/");
  assert.equal(await page.getAttribute("html", "dir"), "rtl");
  assert.equal(await page.getAttribute("html", "lang"), "ar");
  const t = await text();
  assert.ok(t.includes("المستوى الأول") && t.includes("المستوى الثاني"));
  const hero = await page.locator("[data-quran-ref] blockquote").first().innerText();
  assert.equal(hero.trim(), ayah(2, 121).split(" ").slice(0, 6).join(" "));
});

await check("levels overview lists levels, chapters, published counts", async () => {
  await go("/levels/");
  const t = await text();
  assert.ok(t.includes("أحكام النون الساكنة والتنوين"));
  assert.ok(t.includes("٢ درس"), "l1-c2 shows 2 published lessons (draft excluded)");
  assert.ok(t.includes("منهج تجريبي لأغراض الاختبار فقط"), "affiliation note");
});

await check("chapter lists published lessons with nesting, never drafts", async () => {
  await go("/levels/l1/l1-c2/");
  const t = await text();
  assert.ok(t.includes("الإظهار الحلقي"));
  assert.ok(!t.includes("درس مسودة"), "draft lesson must not appear");
});

await check("lesson page: provenance, page refs, structured content", async () => {
  await go(LESSON);
  const t = await text();
  for (const s of ["مراجَع علميًا", "منقول من المنهج", "ص ٤٩–٦٥", "أهداف الدرس", "النون الساكنة", "حروف الإظهار", "أقصى الحلق", "ص ٥١"]) {
    assert.ok(t.includes(s), `missing «${s}»`);
  }
  assert.ok(!t.includes("مورد مسودة"), "draft resource must not appear");
});

await check("lesson page: Quranic text is verbatim Tanzil (token + example), draft example hidden", async () => {
  const blocks = await page.locator("[data-quran-ref] blockquote").allInnerTexts();
  const joined = blocks.join("\n");
  assert.ok(joined.includes(ayah(2, 121).split(" ").slice(0, 6).join(" ")), "[[quran:2:121:1-6]]");
  for (const a of [2, 3, 4]) assert.ok(joined.includes(ayah(1, a)), `example 1:${a}`);
  assert.ok(!joined.includes(ayah(112, 1)), "draft example 112:1 must not render");
});

await check("lesson page: YouTube (nocookie), R2 download URL, exam link", async () => {
  assert.ok(await page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]').count());
  assert.equal(await page.locator('a[href="https://files.test/resources/2026/11/test.pdf"]').count(), 1);
  assert.equal(await page.locator(`a[href="/exams/${fid(110)}/"]`).count(), 1);
});

await check("lesson progress: marked viewed, completion toggles and survives reload", async () => {
  await page.getByRole("button", { name: "أكملت الدرس" }).click();
  await page.getByRole("button", { name: "✓ أكملت هذا الدرس" }).waitFor();
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: "✓ أكملت هذا الدرس" }).waitFor();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("haqq:progress:v1") ?? "{}"));
  assert.ok(stored[fid(30)]?.completed_at && stored[fid(30)]?.viewed_at);
  await go("/levels/l1/l1-c2/");
  assert.ok(await page.locator('[aria-label="مكتمل"]').count() >= 1, "progress dot on chapter page");
});

await check("draft lesson URL is not exported (404)", async () => {
  const res = await page.goto(BASE + "/levels/l1/l1-c2/l1-c2-03/");
  assert.equal(res.status(), 404);
});

await check("exam link opens the client-only exam route", async () => {
  await go(LESSON);
  await page.locator(`a[href="/exams/${fid(110)}/"]`).click();
  await page.waitForURL(`**/exams/${fid(110)}/`);
  await page.locator(`[data-shell-id="${fid(110)}"]`).waitFor({ timeout: 10_000 });
});

await check("encyclopedia index + entry with verse and related lesson", async () => {
  await go("/encyclopedia/");
  await page.getByRole("link", { name: /الإظهار الحلقي/ }).first().click();
  await page.waitForURL("**/encyclopedia/izhar-halqi/");
  const t = await text();
  assert.ok(t.includes("التعريف") && t.includes("دروس ذات صلة"));
  assert.ok((await page.locator("[data-quran-ref] blockquote").innerText()).includes(ayah(1, 1)));
});

await check("academy: letters, points by area, characteristic pairs", async () => {
  await go("/academy/");
  const t = await text();
  for (const s of ["أقصى الحلق", "الجهر", "الهمس", "الصفير", "صفات لها ضد"]) assert.ok(t.includes(s), `missing ${s}`);
  await page.getByRole("link", { name: "الحرف ء" }).click();
  await page.waitForURL("**/academy/letters/1/");
  const lt = await text();
  assert.ok(lt.includes("أقصى الحلق") && lt.includes("الجهر") && lt.includes("أخطاء شائعة"));
  await go("/academy/characteristics/jahr/");
  assert.ok((await text()).includes("ضدها: الهمس"));
});

await check("resources page groups published files only", async () => {
  await go("/resources/");
  const t = await text();
  assert.ok(t.includes("ملفات PDF") && t.includes("ملخص أحكام النون") && t.includes("رابط خارجي"));
  assert.ok(!t.includes("مورد مسودة"));
});

await check("announcements: pinned shown, expired hidden", async () => {
  await go("/announcements/");
  const t = await text();
  assert.ok(t.includes("إعلان مثبّت") && t.includes("مثبّت"));
  assert.ok(!t.includes("إعلان منتهي"));
});

await check("search ignores diacritics/hamza forms and finds lessons + encyclopedia", async () => {
  await go("/search/");
  await page.fill("#q", "الاظهار");
  await page.getByText(/نتيجة/).waitFor();
  const t = await text();
  assert.ok(t.includes("الموسوعة") && t.includes("درس"));
});

await check("about page renders approved text and the name's verse", async () => {
  await go("/about/");
  const t = await text();
  assert.ok(t.includes("الرؤية والرسالة") && t.includes("الاستقلالية") && t.includes("مشروع تنزيل"));
  assert.ok((await page.locator("[data-quran-ref] blockquote").innerText()).includes(ayah(2, 121)));
});

await check("mobile menu opens and navigates", async () => {
  await go("/");
  await page.getByRole("button", { name: "القائمة" }).click();
  await page.locator("#mobile-nav").getByRole("link", { name: "الموسوعة" }).click();
  await page.waitForURL("**/encyclopedia/");
});

await check("no uncaught page errors", async () => assert.deepEqual(errors, []));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
