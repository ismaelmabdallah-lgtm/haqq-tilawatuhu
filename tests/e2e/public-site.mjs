/**
 * E2E: public site — pre-rendered pages, live refresh without rebuild, level
 * hubs, files from Supabase Storage, navigation. Run via `npm run test:e2e`
 * (static build and live data both come from the PGlite stand-in).
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { waitForSite } from "./warmup.mjs";
import { sql } from "./sql.mjs";
import { EXAMS } from "../fixtures/exam-fixture.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:8799";
const SB = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54329";
await waitForSite(BASE, ["/", "/levels/", "/levels/l1/", "/levels/l1/l1-c2/zz-test-lesson/", "/academy/", "/learn/"]);
const raw = readFileSync("vendor/tanzil/quran-uthmani.txt", "utf8");
const ayah = (s, a) => raw.split("\n").find((l) => l.startsWith(`${s}|${a}|`)).replace(/\r$/, "").split("|").slice(2).join("|");
const LESSON = "/levels/l1/l1-c2/zz-test-lesson/";
const practice = EXAMS.find((e) => e.key === "practice");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n   ${process.env.DEBUG ? e.stack : e.message.split("\n")[0]}`); }
}
const go = (p) => page.goto(BASE + p, { waitUntil: "load" });
const main = () => page.locator("main");

await check("pages are pre-rendered: the lesson HTML already contains its text and verse (no JavaScript)", async () => {
  const html = await (await fetch(BASE + LESSON)).text();
  assert.ok(html.includes("درس تجريبي لأحكام النون"), "lesson title in HTML");
  assert.ok(html.includes(ayah(2, 121).split(" ").slice(0, 6).join(" ")), "verse resolved at build time");
  const levels = await (await fetch(BASE + "/levels/")).text();
  assert.ok(levels.includes("متطلب الإجازة"), "levels in HTML");
});

await check("home: RTL, brand emblem, verified hero verse, live level cards", async () => {
  await go("/");
  assert.equal(await page.getAttribute("html", "dir"), "rtl");
  assert.ok(await page.locator('header svg[aria-label="شعار حق تلاوته"]').count());
  assert.equal((await page.locator("[data-quran-ref] blockquote").first().innerText()).trim(), ayah(2, 121).split(" ").slice(0, 6).join(" "));
  await main().getByText("المستوى الأول").first().waitFor();
  assert.equal(await page.getAttribute('link[rel="icon"]', "href"), "/icon.svg");
});

await check("mobile: fixed bottom navigation with the 4 core tabs + account; no top menu", async () => {
  const nav = page.locator("[data-bottom-nav]");
  assert.ok(await nav.isVisible());
  assert.deepEqual((await nav.locator("a").allInnerTexts()).map((t) => t.trim()), ["المستويات", "الأكاديمية", "الاختبارات", "الإعلانات", "دخول"]);
  for (const a of await nav.locator("a").all()) assert.ok((await a.boundingBox()).height >= 44, "touch target ≥ 44px");
  await nav.getByText("الأكاديمية").click();
  await page.waitForURL("**/academy/");
});

await check("desktop: top navigation has exactly the 4 core items + account (no encyclopedia/search)", async () => {
  const d = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await d.goto(BASE + "/", { waitUntil: "load" });
  const items = (await d.locator('header nav[aria-label="القائمة الرئيسية"] a').allInnerTexts()).map((t) => t.trim());
  assert.deepEqual(items, ["المستويات", "الأكاديمية", "الاختبارات", "الإعلانات", "دخول"]);
  assert.equal(await d.locator("[data-bottom-nav]").isVisible(), false);
  await d.close();
});

await check("levels overview: 4 levels with lesson / file / exam counts", async () => {
  await go("/levels/");
  await page.locator("[data-level-card]").nth(3).waitFor();
  assert.equal(await page.locator("[data-level-card]").count(), 4);
  const l1 = await page.locator('[data-level-card="l1"]').innerText();
  assert.ok(l1.includes("١\nدرس") && l1.includes("١\nملف") && l1.includes("٣\nاختبار"), l1);
});

await check("level hub: downloadable PDF summary (signed Storage URL), lessons and exams; drafts hidden", async () => {
  await go("/levels/l1/");
  const hub = page.locator("[data-level-hub=l1]");
  await hub.getByText("[تجريبي] ملخص المستوى الأول").waitFor();
  const t = await hub.innerText();
  assert.ok(!t.includes("ملف مسودة") && !t.includes("درس مسودة"), "no drafts");
  assert.ok(t.includes("درس تجريبي لأحكام النون"));
  assert.ok(await hub.locator("a[href^='/exams/']").count() >= 3, "level exams listed");
  // The signed URL opens in a new tab (a PDF download in headless Chromium, so watch the request).
  const [req] = await Promise.all([
    page.context().waitForEvent("request", (r) => r.url().includes("/storage/v1/object/sign/materials/pdf/2026/11/e2e-summary.pdf") && r.method() === "GET"),
    hub.locator("[data-download]").first().click(),
  ]);
  assert.ok(req.url().includes("token="), "signed URL");
});

await check("a draft file cannot be signed for download (storage RLS)", async () => {
  const anon = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"role":"anon"}').toString("base64url")}.x`;
  const r = await fetch(`${SB}/storage/v1/object/sign/materials/pdf/2026/11/e2e-draft.pdf`, { method: "POST", headers: { authorization: `Bearer ${anon}`, "content-type": "application/json" }, body: "{}" });
  assert.equal(r.status, 400);
});

await check("lesson: provenance, structured content, verbatim Quran, audio clip, video, files, exam", async () => {
  await go(LESSON);
  await page.locator("[data-lesson=zz-test-lesson]").waitFor();
  const t = await main().innerText();
  for (const s of ["مراجَع علميًا", "شرح مساند", "ص ٤٩–٦٥", "التعريفات", "الأحكام والقواعد", "أقصى الحلق", "صور ومقاطع صوتية"]) assert.ok(t.includes(s), `missing «${s}»`);
  const verses = (await page.locator("[data-quran-ref] blockquote").allInnerTexts()).join("\n");
  assert.ok(verses.includes(ayah(2, 121).split(" ").slice(0, 6).join(" ")));
  for (const a of [2, 3, 4]) assert.ok(verses.includes(ayah(1, a)), `example 1:${a}`);
  await page.locator("audio[data-audio]").waitFor({ state: "attached" });
  assert.match(await page.getAttribute("audio[data-audio]", "src"), /\/object\/sign\/materials\/audio\//);
  assert.ok(await page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]').count());
  assert.ok(await page.locator('a[href="https://tanzil.net"]').count());
  assert.equal(await page.locator(`a[href="/exams/${practice.id}/"]`).count(), 1);
});

await check("lesson progress is saved in the browser for guests", async () => {
  await page.getByRole("button", { name: "أكملت الدرس" }).click();
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: "✓ أكملت هذا الدرس" }).waitFor();
});

await check("LIVE: a lesson published after the build appears and opens without a rebuild", async () => {
  await sql(`select set_config('app.content_transition','on',true);
    insert into public.lessons (id, chapter_id, code, sort_order, title, body_md, origin, status, scientifically_verified)
    values (md5('haqq:e2e:live')::uuid, md5('haqq:chapter:minhaj-al-darisin-ed2-2026:l1-c2')::uuid, 'zz-live-lesson', 97,
            'درس نُشر بعد البناء', E'شرح حي.\\n\\n[[quran:1:5]]', 'supplementary_explanation', 'published', true)`);
  await go("/levels/l1/");
  const link = page.locator("[data-lesson-link=zz-live-lesson]");
  await link.waitFor({ timeout: 15_000 });
  assert.match(await link.getAttribute("href"), /^\/learn\/\?level=l1&chapter=l1-c2&lesson=zz-live-lesson$/);
  await link.click();
  await page.locator("[data-lesson=zz-live-lesson]").waitFor();
  assert.ok((await page.locator("[data-quran-ref] blockquote").innerText()).includes(ayah(1, 5)));
});

await check("LIVE: a shared link to the new lesson's canonical URL redirects to the live route", async () => {
  await go("/levels/l1/l1-c2/zz-live-lesson/");
  await page.waitForURL(/\/learn\/\?level=l1&chapter=l1-c2&lesson=zz-live-lesson/);
  await page.locator("[data-lesson=zz-live-lesson]").waitFor();
});

await check("LIVE: archiving hides the lesson again without a rebuild; drafts never open", async () => {
  await sql(`select set_config('app.content_transition','on',true); update public.lessons set status = 'archived' where id = md5('haqq:e2e:live')::uuid`);
  await go("/levels/l1/");
  await page.locator("[data-lesson-link=zz-test-lesson]").waitFor();
  assert.equal(await page.locator("[data-lesson-link=zz-live-lesson]").count(), 0);
  await go("/levels/l1/l1-c2/zz-draft-lesson/");
  await page.waitForURL(/\/learn\//);
  await page.locator("[data-not-found]").waitFor();
  assert.ok(!(await main().innerText()).includes("درس مسودة"));
});

await check("pre-rendered pages stay readable when the database is unreachable", async () => {
  const p = await browser.newPage();
  await p.route((url) => url.href.startsWith(SB), (r) => r.abort());
  await p.goto(BASE + "/levels/l1/", { waitUntil: "load" });
  await p.locator("[data-lesson-link=zz-test-lesson]").waitFor();
  await p.close();
});

await check("academy hub, letter, point and characteristic pages", async () => {
  await go("/academy/");
  await page.locator("[data-academy]").getByText("أقصى الحلق").first().waitFor();
  const t = await main().innerText();
  for (const s of ["الجهر", "الهمس", "الصفير", "صفات لها ضد"]) assert.ok(t.includes(s), s);
  await page.getByRole("link", { name: "الحرف ء" }).click();
  await page.waitForURL("**/academy/letters/1/");
  await page.locator("[data-academy-letter]").getByText("أخطاء شائعة").waitFor();
  await go("/academy/characteristics/jahr/");
  await page.getByText("ضدها: الهمس").waitFor();
});

await check("resources page lists published files only", async () => {
  await go("/resources/");
  await page.locator("[data-resources]").getByText("[تجريبي] ملخص المستوى الأول").waitFor();
  const t = await main().innerText();
  assert.ok(t.includes("ملفات PDF") && t.includes("مقاطع صوتية") && t.includes("روابط"));
  assert.ok(!t.includes("ملف مسودة"));
});

await check("announcements: pinned shown, expired hidden", async () => {
  await go("/announcements/");
  await page.locator("[data-announcement]").first().waitFor();
  const t = await main().innerText();
  assert.ok(t.includes("إعلان مثبّت") && !t.includes("إعلان منتهي"));
});

await check("encyclopedia and search remain available (footer links)", async () => {
  await go("/encyclopedia/izhar-halqi/");
  assert.ok((await main().innerText()).includes("التعريف"));
  await go("/search/");
  await page.fill("#q", "الاظهار");
  await page.getByText(/نتيجة/).waitFor();
});

await check("no uncaught page errors", async () => assert.deepEqual(errors, []));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
