#!/usr/bin/env node
/**
 * End-to-end run on the Cloudflare Pages emulator, fully offline from the live
 * database:
 *   1. builds the static site from tests/fixtures/site.fixture.json
 *   2. serves out/ + functions/ with `wrangler pages dev` (log: .wrangler/e2e-server.log)
 *   3. runs the browser suites (API calls answered by PGlite with the real schema)
 * Afterwards rebuild normally (`npm run build`) before deploying.
 *   npm run test:e2e
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.E2E_PORT ?? "8799";
const BASE = `http://localhost:${PORT}`;
const LOG = ".wrangler/e2e-server.log";
const env = { ...process.env, HAQQ_CONTENT_FIXTURE: "tests/fixtures/site.fixture.json", NEXT_PUBLIC_FILES_BASE_URL: "https://files.test" };
const run = (cmd, extra = {}) => execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });
const up = () => fetch(BASE, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);

// Never test against a stale emulator left over from an earlier run.
if (await up()) {
  console.error(`Port ${PORT} is already serving something (an old \`wrangler pages dev\`?). Stop it or set E2E_PORT.`);
  process.exit(1);
}

run("node tests/fixtures/make-site-fixture.mjs");
run("node tests/fixtures/make-test-seed.mjs");
run("npm run build");

// Start wrangler directly with Node (no npx/shell layer) so the whole process
// tree — including workerd — can be stopped reliably, and keep its output.
mkdirSync(".wrangler", { recursive: true });
// The OS writes wrangler output straight to the file: the suites run via execSync,
// which blocks this process, so a pipe would never be drained and wrangler would
// stall once the pipe buffer filled with request logs.
const logFd = openSync(LOG, "w");
const cli = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");   // not in the package exports
const server = spawn(process.execPath, [cli, "pages", "dev", "out", "--port", PORT, "--compatibility-date=2026-11-01"], { env, stdio: ["ignore", logFd, logFd] });
let exited = null;
server.on("exit", (code) => { exited = code; });

function stop() {
  if (exited !== null) return;
  if (process.platform === "win32") { try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" }); } catch { /* gone */ } }
  else server.kill("SIGTERM");
}
process.on("exit", stop);

for (let i = 0; i < 90 && !(await up()); i++) {
  if (exited !== null) break;
  await new Promise((r) => setTimeout(r, 1000));
}

let failed = false;
try {
  if (!(await up())) throw new Error("emulator did not start");
  for (const suite of ["shell-routes", "public-site", "exam-flow", "admin-flow"]) {
    console.log(`\n── ${suite}`);
    if (exited !== null) { failed = true; console.log(`emulator exited (code ${exited}) — see ${LOG}`); break; }
    try { run(`node tests/e2e/${suite}.mjs`, { BASE_URL: BASE }); } catch { failed = true; }
  }
} catch (e) {
  failed = true; console.log(String(e));
} finally {
  stop();
}
if (failed) {
  const tail = readFileSync(LOG, "utf8").split("\n").slice(-25).join("\n");
  console.log(`\n── last lines of ${LOG}\n${tail}`);
}
console.log(failed ? "\nE2E: FAILED" : "\nE2E: all suites passed");
console.log("Note: out/ now contains the TEST fixture build — run `npm run build` before deploying.");
process.exit(failed ? 1 : 0);
