/**
 * TEST-ONLY stand-in for the Supabase REST API, backed by PGlite running the
 * REAL schema (shim → migrations → curriculum seed → scripts/test_seed.sql).
 * Playwright routes the browser's /rest/v1/* calls here, so the UI is tested
 * against the actual SQL functions, grading and RLS — as the `anon` role or as
 * a signed-in test user — without touching the live database.
 *
 * Supports exactly what the app uses: POST /rest/v1/rpc/<fn> with named args,
 * and GET/POST/PATCH/DELETE /rest/v1/<table> with eq/neq/in/is filters, select,
 * order and limit.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const IDENT = /^[a-z_][a-z0-9_]*$/;

export async function createApi({ extraSql = [] } = {}) {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  await db.exec(read("supabase/tests/00_supabase_shim.sql"));
  for (const m of readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(read(`supabase/migrations/${m}`));
  }
  await db.exec(read("supabase/seed/0001_minhaj_al_darisin.sql"));
  await db.exec(read("scripts/test_seed.sql"));
  for (const sql of extraSql) await db.exec(sql);

  // PGlite has one connection: serialize requests.
  let chain = Promise.resolve();
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  /** Runs `fn` as the API caller (anon, or authenticated with a user id), like PostgREST. */
  async function asCaller(userId, ip, fn) {
    return db.transaction(async (tx) => {
      const claims = userId ? { sub: userId, role: "authenticated" } : { role: "anon" };
      await tx.query("select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)",
        [JSON.stringify(claims), JSON.stringify({ "x-forwarded-for": ip })]);
      await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
      return fn(tx);
    });
  }

  function pgError(e) {
    return { status: e.code === "42501" ? 403 : e.code === "P0002" ? 404 : 400,
      body: { code: e.code ?? "XX000", message: e.message, details: null, hint: null } };
  }

  async function rpc(fn, args, userId, ip) {
    if (!IDENT.test(fn)) return { status: 404, body: { message: "unknown function" } };
    // Argument types decide the wire format: json/jsonb → JSON text, arrays → array literal.
    const meta = await db.query(`select proretset, coalesce(proargnames, '{}') as names,
        array(select format_type(t, null) from unnest(proargtypes) t) as types
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname = $1 limit 1`, [fn]);
    if (!meta.rows.length) return { status: 404, body: { code: "PGRST202", message: `function ${fn} not found` } };
    const typeOf = Object.fromEntries(meta.rows[0].names.map((n, i) => [n, meta.rows[0].types[i] ?? "text"]));
    const entries = Object.entries(args ?? {}).filter(([, v]) => v !== undefined && v !== null);
    const params = entries.map(([k, v]) => {
      const t = typeOf[k] ?? "text";
      if (t === "json" || t === "jsonb") return JSON.stringify(v);
      if (Array.isArray(v)) return `{${v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(",")}}`;
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
    const named = entries.map(([k], i) => { if (!IDENT.test(k)) throw new Error("bad arg"); return `${k} => $${i + 1}`; }).join(", ");
    // Set-returning functions come back as rows, scalar ones as a single value (like PostgREST).
    try {
      return await asCaller(userId, ip, async (tx) => {
        if (meta.rows[0].proretset) return { status: 200, body: (await tx.query(`select * from public.${fn}(${named})`, params)).rows };
        return { status: 200, body: (await tx.query(`select public.${fn}(${named}) as r`, params)).rows[0].r ?? null };
      });
    } catch (e) { return pgError(e); }
  }

  function where(url, params) {
    const clauses = [];
    for (const [k, v] of url.searchParams) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      if (!IDENT.test(k)) throw new Error(`bad column ${k}`);
      const [op, ...rest] = v.split("."); const val = rest.join(".");
      if (op === "eq") { params.push(val); clauses.push(`${k} = $${params.length}`); }
      else if (op === "neq") { params.push(val); clauses.push(`${k} <> $${params.length}`); }
      else if (op === "is") clauses.push(`${k} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`);
      else if (op === "in") {
        const items = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""));
        params.push(`{${items.join(",")}}`); clauses.push(`${k}::text = any($${params.length}::text[])`);
      } else throw new Error(`unsupported filter ${op}`);
    }
    return clauses.length ? ` where ${clauses.join(" and ")}` : "";
  }

  async function table(method, name, url, bodyText, userId, ip) {
    if (!IDENT.test(name)) return { status: 404, body: { message: "unknown table" } };
    try {
      return await asCaller(userId, ip, async (tx) => {
        const params = [];
        const sel = url.searchParams.get("select") ?? "*";
        const cols = sel === "*" ? "*" : sel.split(",").map((c) => { if (!IDENT.test(c.trim())) throw new Error(`bad select ${c}`); return c.trim(); }).join(", ");
        if (method === "GET") {
          let sql = `select ${cols} from public.${name}${where(url, params)}`;
          const order = url.searchParams.getAll("order").flatMap((o) => o.split(","));
          if (order.length) sql += " order by " + order.map((o) => { const [c, dir] = o.split("."); if (!IDENT.test(c)) throw new Error("bad order"); return `${c} ${dir === "desc" ? "desc" : "asc"}`; }).join(", ");
          if (url.searchParams.get("limit")) sql += ` limit ${Number(url.searchParams.get("limit"))}`;
          return { status: 200, body: (await tx.query(sql, params)).rows };
        }
        if (method === "POST") {
          const rows = [JSON.parse(bodyText || "[]")].flat();
          const out = [];
          for (const row of rows) {
            const keys = Object.keys(row).filter((k) => IDENT.test(k));
            const vals = keys.map((k) => (row[k] !== null && typeof row[k] === "object" && !Array.isArray(row[k]) ? JSON.stringify(row[k]) : row[k]));
            const r = await tx.query(`insert into public.${name} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`, vals);
            out.push(...r.rows);
          }
          return { status: 201, body: out };
        }
        if (method === "PATCH") {
          const row = JSON.parse(bodyText || "{}");
          const keys = Object.keys(row).filter((k) => IDENT.test(k));
          keys.forEach((k) => params.push(row[k] !== null && typeof row[k] === "object" && !Array.isArray(row[k]) ? JSON.stringify(row[k]) : row[k]));
          const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
          return { status: 200, body: (await tx.query(`update public.${name} set ${sets}${where(url, params)} returning *`, params)).rows };
        }
        if (method === "DELETE") return { status: 200, body: (await tx.query(`delete from public.${name}${where(url, params)} returning *`, params)).rows };
        return { status: 405, body: { message: "method" } };
      });
    } catch (e) { return pgError(e); }
  }

  /**
   * Playwright route handler. The caller is taken from the bearer token's
   * claims exactly as PostgREST would (signatures are NOT verified — test only):
   * role "authenticated" + sub → that user; anything else → anon.
   */
  async function handle(route, ip = "203.0.113.50") {
    const req = route.request();
    let userId = null;
    const bearer = (req.headers()["authorization"] ?? "").replace(/^Bearer /, "");
    try {
      const claims = JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString("utf8"));
      if (claims.role === "authenticated" && typeof claims.sub === "string") userId = claims.sub;
    } catch { /* anon */ }
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const res = await serial(() => path.startsWith("rpc/")
      ? rpc(path.slice(4), req.postData() ? JSON.parse(req.postData()) : {}, userId, ip)
      : table(req.method(), path, url, req.postData(), userId, ip));
    const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    let body = res.body;
    if (wantsObject && Array.isArray(body) && res.status < 300) {
      if (body.length !== 1) return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${body.length} rows`, hint: null }) });
      body = body[0];
    }
    await route.fulfill({ status: res.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  }

  /** Direct SQL as the database owner, with request settings defined like PostgREST does. */
  const query = (sql, p) => serial(() => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', '{}', true), set_config('request.headers', '{}', true)");
    return tx.query(sql, p);
  }));

  return { db, handle, query, close: () => db.close() };
}
