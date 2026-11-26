#!/usr/bin/env node
/**
 * Runs the database test suite on PGlite (PostgreSQL compiled to WebAssembly,
 * in-process) — no Docker, no local Supabase, no server:
 *   shim → migrations 0001–0005 → curriculum seed → supabase/tests/10_*.sql
 * then, on a fresh database, scripts/test_seed.sql + test_seed_cleanup.sql.
 *
 *   npm run test:db:pglite
 *
 * Emulates the few psql features the suite uses: \set (ignored), \gset and
 * :var / :'var' substitution. PASS notices are recorded in a table and counted.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();

/** Index just after the last top-level ';' (ignores quotes, dollar-quotes, comments). */
function lastStatementStart(sql) {
  let i = 0, last = 0, dollar = null;
  while (i < sql.length) {
    const c = sql[i];
    if (dollar) { if (sql.startsWith(dollar, i)) { i += dollar.length; dollar = null; } else i++; continue; }
    if (c === "'") { i++; while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1; i++; continue; }
    if (c === "-" && sql[i + 1] === "-") { while (i < sql.length && sql[i] !== "\n") i++; continue; }
    if (c === "$") { const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i)); if (m) { dollar = m[0]; i += m[0].length; continue; } }
    if (c === ";") last = i + 1;
    i++;
  }
  return last;
}

function substitute(sql, vars) {
  return sql
    .replace(/(?<!:):'([A-Za-z_][A-Za-z0-9_]*)'/g, (m, v) => (v in vars ? `'${String(vars[v]).replace(/'/g, "''")}'` : m))
    .replace(/(?<![:\w]):([A-Za-z_][A-Za-z0-9_]*)/g, (m, v) => (v in vars ? String(vars[v]) : m));
}

/** psql stores \gset values as text: json/jsonb columns arrive from PGlite as objects. */
const asText = (v) => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);

async function runPsqlScript(db, sql) {
  const vars = {};
  // \set NAME 'value' (variables); \set ON_ERROR_STOP 1 etc. are psql options and ignored.
  const text = sql.replace(/^\\set\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.*)$/gm, (_, name, value) => {
    const v = value.trim();
    if (/^'.*'$/.test(v)) vars[name] = v.slice(1, -1).replace(/''/g, "'");
    return "";
  }).replace(/^\\echo .*$/gm, "");
  const chunks = text.split("\\gset");
  for (let k = 0; k < chunks.length; k++) {
    const chunk = chunks[k];
    if (k === chunks.length - 1) { await db.exec(substitute(chunk, vars)); break; }
    const cut = lastStatementStart(chunk);
    if (chunk.slice(0, cut).trim()) await db.exec(substitute(chunk.slice(0, cut), vars));
    const res = await db.query(substitute(chunk.slice(cut), vars));
    for (const [k2, v] of Object.entries(res.rows[0] ?? {})) vars[k2] = asText(v);
  }
}

async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  await db.exec(read("supabase/tests/00_supabase_shim.sql"));
  for (const m of migrations) {
    try { await db.exec(read(`supabase/migrations/${m}`)); }
    catch (e) { throw new Error(`migration ${m} failed: ${e.message}`); }
  }
  await db.exec(read("supabase/seed/0001_minhaj_al_darisin.sql"));
  return db;
}

let failed = false;

// ---------------------------------------------------------------- 93-check suite
{
  const db = await freshDb();
  console.log(`migrated: ${migrations.join(", ")} + seed`);
  const suite = read("supabase/tests/10_security_and_workflow.sql")
    .replace("create schema tests;", "create schema tests;\ncreate table tests.passes (label text);\ngrant usage on schema tests to anon, authenticated;\ngrant insert on tests.passes to anon, authenticated;")
    .replace(/raise notice 'PASS: %', label;/g, "insert into tests.passes values (label);")
    .replace(/raise notice 'PASS: % \(rejected: %\)', label, sqlerrm;/g, "insert into tests.passes values (label);");
  try {
    await runPsqlScript(db, suite);
    await db.exec("reset role;");
    const { rows } = await db.query("select count(*)::int as n from tests.passes");
    console.log(`✔ DB suite: ${rows[0].n} checks passed`);
  } catch (e) {
    failed = true;
    await db.exec("rollback; reset role;").catch(() => {});
    const { rows } = await db.query("select count(*)::int as n from tests.passes").catch(() => ({ rows: [{ n: "?" }] }));
    console.log(`✖ DB suite failed after ${rows[0].n} passing checks:\n   ${e.message}`);
  }
  await db.close();
}

// ---------------------------------------------------------------- test seed + cleanup
{
  const db = await freshDb();
  const anonCount = async (sql) => {
    await db.exec(`select set_config('request.jwt.claims', '{"role":"anon"}', false); set role anon;`);
    const { rows } = await db.query(sql);
    await db.exec("reset role;");
    return rows[0];
  };
  try {
    await db.exec(read("scripts/test_seed.sql"));
    const seen = await anonCount(`select (select count(*) from public.lessons)::int as lessons,
      (select count(*) from public.exams)::int as exams, (select count(*) from public.quranic_examples)::int as examples`);
    if (seen.lessons !== 1 || seen.exams !== 3 || seen.examples !== 1) throw new Error(`anon sees ${JSON.stringify(seen)}`);
    // a guest can start the practice exam and receive a paper without answer data
    await db.exec(`select set_config('request.jwt.claims', '{"role":"anon"}', false), set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', false); set role anon;`);
    const exam = (await db.query("select id from public.exams where slug = 'zz-test-practice'")).rows[0].id;
    const start = (await db.query("select public.start_attempt($1) as r", [exam])).rows[0].r;
    const paper = (await db.query("select public.get_attempt_paper($1, $2) as p", [start.attempt_id, start.guest_token])).rows[0].p;
    await db.exec("reset role;");
    if (paper.questions.length !== 10) throw new Error(`paper has ${paper.questions.length} questions`);
    if (/"(correct|accepted|order_key|pairs_key)"/.test(JSON.stringify(paper))) throw new Error("paper contains answer data");
    console.log(`✔ test_seed.sql: anon sees 1 lesson, 3 exams; guest attempt paper has 10 questions and no answer data`);

    await db.exec(read("scripts/test_seed_cleanup.sql"));
    const { rows } = await db.query(`select
      (select count(*) from public.exams where slug like 'zz-test-%')::int as exams,
      (select count(*) from public.lessons where code = 'zz-test-lesson')::int as lessons,
      (select count(*) from public.questions where 'test' = any(tags))::int as questions,
      (select count(*) from public.exam_attempts)::int as attempts,
      (select count(*) from public.lessons)::int as seeded_lessons`);
    const r = rows[0];
    if (r.exams || r.lessons || r.questions || r.attempts || r.seeded_lessons !== 101) throw new Error(`after cleanup: ${JSON.stringify(r)}`);
    console.log("✔ test_seed_cleanup.sql: all test rows and attempts removed; the 101 seeded lessons untouched");
  } catch (e) {
    failed = true;
    console.log(`✖ test seed check failed:\n   ${e.message}`);
  }
  await db.close();
}

process.exit(failed ? 1 : 0);
