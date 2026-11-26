#!/usr/bin/env node
/**
 * End-to-end run, fully offline from the live project:
 *   1. starts a local Supabase stand-in (PGlite + real schema + test content)
 *   2. builds the static site FROM that stand-in (pre-rendered pages)
 *   3. serves out/ + functions/ with `wrangler pages dev`; the browser talks to
 *      the same stand-in live, so pre-rendered and live data agree
 *   4. runs the browser suites
 * Logs: .wrangler/e2e-server.log, .wrangler/e2e-supabase.log
 * Afterwards run `npm run build` again before deploying.
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.E2E_PORT ?? "8799";
const SB_PORT = process.env.FAKE_SUPABASE_PORT ?? "54329";
const BASE = `http://localhost:${PORT}`;
const SB = `http://127.0.0.1:${SB_PORT}`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ANON = `${b64({ alg: "none", typ: "JWT" })}.${b64({ role: "anon" })}.test`;
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: SB, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, NEXT_PUBLIC_FILES_BASE_URL: "https://files.test",
  SUPABASE_TEST_URL: SB, FAKE_SUPABASE_PORT: SB_PORT,
};
const run = (cmd, extra = {}) => execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });
const up = (url) => fetch(url, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);

for (const url of [BASE, `${SB}/__test/health`]) {
  if (await up(url)) { console.error(`${url} is already in use (an old test server?). Stop it first.`); process.exit(1); }
}

mkdirSync(".wrangler", { recursive: true });
const children = [];
function start(args, log) {
  // Output goes straight to a file: suites run via execSync (blocking), so a pipe would never be drained.
  const child = spawn(process.execPath, args, { env, stdio: ["ignore", openSync(log, "w"), openSync(log, "a")] });
  children.push(child);
  return child;
}
function stopAll() {
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (process.platform === "win32") { try { execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: "ignore" }); } catch { /* gone */ } }
    else c.kill("SIGTERM");
  }
}
process.on("exit", stopAll);
async function waitFor(url, what, child) {
  for (let i = 0; i < 120; i++) {
    if (await up(url)) return;
    if (child.exitCode !== null) throw new Error(`${what} exited (code ${child.exitCode})`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${what} did not start`);
}

let failed = false;
try {
  run("node tests/fixtures/make-test-seed.mjs");
  const sb = start(["tests/e2e/fake-supabase-server.mjs"], ".wrangler/e2e-supabase.log");
  await waitFor(`${SB}/__test/health`, "Supabase stand-in", sb);
  run("npm run build");
  const cli = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
  const pages = start([cli, "pages", "dev", "out", "--port", PORT, "--compatibility-date=2026-11-01"], ".wrangler/e2e-server.log");
  await waitFor(BASE, "Pages emulator", pages);
  for (const suite of ["shell-routes", "public-site", "exam-flow", "admin-flow"]) {
    console.log(`\n── ${suite}`);
    if (children.some((c) => c.exitCode !== null)) { failed = true; console.log("a test server exited — see .wrangler/e2e-*.log"); break; }
    try { run(`node tests/e2e/${suite}.mjs`, { BASE_URL: BASE }); } catch { failed = true; }
  }
} catch (e) {
  failed = true; console.log(String(e));
} finally {
  stopAll();
}
if (failed) {
  for (const log of [".wrangler/e2e-server.log", ".wrangler/e2e-supabase.log"]) {
    try { console.log(`\n── last lines of ${log}\n${readFileSync(log, "utf8").split("\n").slice(-15).join("\n")}`); } catch { /* none */ }
  }
}
console.log(failed ? "\nE2E: FAILED" : "\nE2E: all suites passed");
console.log("Note: out/ now contains a TEST build — run `npm run build` before deploying.");
process.exit(failed ? 1 : 0);
