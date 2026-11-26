/**
 * E2E: client-only dynamic routes on the real Cloudflare Pages emulator.
 *   npm run build && npx wrangler pages dev out --port 8788
 *   BASE_URL=http://localhost:8788 node tests/e2e/shell-routes.mjs
 * Checks direct open, refresh, and that hydration keeps the real URL.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { waitForSite } from "./warmup.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:8788";
await waitForSite(BASE);
const ID = "ab2c0d1e-1234-4abc-8def-0123456789ab";
const ROUTES = (process.env.ROUTES ?? "exams,attempts,certificates").split(",");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// Routing only: never reach the live API from this test.
await page.route(/\/(rest|auth)\/v1\//, (r) => r.abort());

let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n   ${e.message}`); }
}

for (const route of ROUTES) {
  for (const path of [`/${route}/${ID}/`, `/${route}/${ID}`]) {
    await check(`${path} direct open renders the id and keeps the URL`, async () => {
      await page.goto(BASE + path, { waitUntil: "load" });
      await page.waitForSelector(`[data-shell-id="${ID}"]`, { timeout: 30_000 });
      assert.match(new URL(page.url()).pathname, new RegExp(`^/${route}/${ID}/?$`));
    });
  }
  await check(`/${route}/${ID}/ survives refresh`, async () => {
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(`[data-shell-id="${ID}"]`, { timeout: 30_000 });
    assert.match(new URL(page.url()).pathname, new RegExp(`^/${route}/${ID}/?$`));
  });
  await check(`/${route}/not-valid!/ shows an invalid-link message`, async () => {
    await page.goto(`${BASE}/${route}/not-valid!/`, { waitUntil: "load" });
    await page.waitForSelector("[data-shell-invalid]", { timeout: 30_000 });
  });
}

await check("no uncaught page errors", async () => { assert.deepEqual(errors, []); });
await browser.close();
process.exit(failed ? 1 : 0);
