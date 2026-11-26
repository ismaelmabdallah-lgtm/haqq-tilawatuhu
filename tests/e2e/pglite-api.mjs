/**
 * TEST-ONLY stand-in for the Supabase APIs the app uses, backed by PGlite
 * running the REAL schema (shim → migrations → curriculum seed → test seed →
 * e2e content). Every request runs as PostgREST would: as `anon`, or as
 * `authenticated` with the token's `sub` (signatures are NOT verified — test
 * only), so RLS, storage policies and SQL functions decide everything.
 *
 * Covers: REST (/rest/v1 tables + rpc), Storage (/storage/v1 upload, sign,
 * signed download, delete — enforced by storage.objects RLS) and the few Auth
 * calls the app makes.
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

  let chain = Promise.resolve();
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  async function asCaller(userId, ip, fn) {
    return db.transaction(async (tx) => {
      const claims = userId ? { sub: userId, role: "authenticated" } : { role: "anon" };
      await tx.query("select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)",
        [JSON.stringify(claims), JSON.stringify({ "x-forwarded-for": ip })]);
      await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
      return fn(tx);
    });
  }
  const pgError = (e) => ({ status: e.code === "42501" ? 403 : e.code === "P0002" ? 404 : 400,
    body: { code: e.code ?? "XX000", message: e.message, details: null, hint: null } });

  async function rpc(fn, args, userId, ip) {
    if (!IDENT.test(fn)) return { status: 404, body: { message: "unknown function" } };
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
  const toParam = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v);

  async function table(method, name, url, bodyText, userId, ip) {
    if (!IDENT.test(name)) return { status: 404, body: { message: "unknown table" } };
    try {
      return await asCaller(userId, ip, async (tx) => {
        const params = [];
        const sel = url.searchParams.get("select") ?? "*";
        const cols = sel === "*" ? "*" : sel.split(",").map((c) => { if (!IDENT.test(c.trim())) throw new Error(`bad select ${c}`); return c.trim(); }).join(", ");
        if (method === "GET" || method === "HEAD") {
          let sql = `select ${cols} from public.${name}${where(url, params)}`;
          const order = url.searchParams.getAll("order").flatMap((o) => o.split(","));
          if (order.length) sql += " order by " + order.map((o) => { const [c, dir] = o.split("."); if (!IDENT.test(c)) throw new Error("bad order"); return `${c} ${dir === "desc" ? "desc" : "asc"}`; }).join(", ");
          if (url.searchParams.get("limit")) sql += ` limit ${Number(url.searchParams.get("limit"))}`;
          return { status: 200, body: (await tx.query(sql, params)).rows };
        }
        if (method === "POST") {
          const out = [];
          for (const row of [JSON.parse(bodyText || "[]")].flat()) {
            const keys = Object.keys(row).filter((k) => IDENT.test(k));
            const r = await tx.query(`insert into public.${name} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`, keys.map((k) => toParam(row[k])));
            out.push(...r.rows);
          }
          return { status: 201, body: out };
        }
        if (method === "PATCH") {
          const row = JSON.parse(bodyText || "{}");
          const keys = Object.keys(row).filter((k) => IDENT.test(k));
          keys.forEach((k) => params.push(toParam(row[k])));
          return { status: 200, body: (await tx.query(`update public.${name} set ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")}${where(url, params)} returning *`, params)).rows };
        }
        if (method === "DELETE") return { status: 200, body: (await tx.query(`delete from public.${name}${where(url, params)} returning *`, params)).rows };
        return { status: 405, body: { message: "method" } };
      });
    } catch (e) { return pgError(e); }
  }

  // ---------------------------------------------------------------- storage (RLS on storage.objects decides)
  const storageError = (status, message) => ({ status, body: { statusCode: String(status), error: message, message } });
  async function storage(method, path, url, bodyText, userId, ip, contentType, rawBody) {
    let m;
    if (method === "POST" && (m = /^object\/sign\/([^/]+)\/(.+)$/.exec(path))) {
      const [, bucket, name] = m;
      const found = await asCaller(userId, ip, (tx) => tx.query("select 1 from storage.objects where bucket_id = $1 and name = $2", [bucket, decodeURIComponent(name)]));
      if (!found.rows.length) return storageError(400, "Object not found");
      return { status: 200, body: { signedURL: `/object/sign/${bucket}/${name}?token=test-signed` } };
    }
    if (method === "GET" && (m = /^object\/sign\/([^/]+)\/(.+)$/.exec(path))) {
      const ext = path.split(".").pop();
      const type = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", mp3: "audio/mpeg" }[ext] ?? "application/octet-stream";
      const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000000000200015e2c9e0b0000000049454e44ae426082", "hex");
      return { status: 200, raw: type === "image/png" ? png : Buffer.from("test file"), headers: { "content-type": type } };
    }
    if (method === "POST" && (m = /^object\/([^/]+)\/(.+)$/.exec(path)) && !path.startsWith("object/sign/")) {
      const [, bucket, name] = m;
      const b = (await db.query("select file_size_limit, allowed_mime_types from storage.buckets where id = $1", [bucket])).rows[0];
      if (!b) return storageError(404, "Bucket not found");
      // supabase-js sends browser File/Blob uploads as multipart/form-data (the file is the part with a type).
      let size = rawBody?.length ?? 0;
      let mime = (contentType ?? "").split(";")[0];
      if (mime === "multipart/form-data") {
        const form = await new Response(rawBody, { headers: { "content-type": contentType } }).formData();
        const file = [...form.values()].find((v) => typeof v !== "string");
        if (!file) return storageError(400, "no file in upload");
        size = file.size; mime = file.type;
      }
      if (b.file_size_limit && size > Number(b.file_size_limit)) return storageError(413, "The object exceeded the maximum allowed size");
      if (b.allowed_mime_types && !b.allowed_mime_types.includes(mime)) return storageError(415, `mime type ${mime} is not supported`);
      try {
        await asCaller(userId, ip, (tx) => tx.query("insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)", [bucket, decodeURIComponent(name), userId]));
      } catch (e) { return storageError(403, `new row violates row-level security policy: ${e.message}`); }
      return { status: 200, body: { Key: `${bucket}/${name}`, Id: name } };
    }
    if (method === "DELETE" && (m = /^object\/([^/]+)$/.exec(path))) {
      const prefixes = JSON.parse(bodyText || "{}").prefixes ?? [];
      const r = await asCaller(userId, ip, (tx) => tx.query("delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name", [m[1], `{${prefixes.join(",")}}`]));
      return { status: 200, body: r.rows };
    }
    return storageError(404, `unsupported storage call ${method} ${path}`);
  }

  /** Transport-neutral entry point: { method, url, headers, body (string), raw (Buffer) } → { status, body | raw, headers } */
  async function respond({ method, url, headers, body, raw, ip = "203.0.113.50" }) {
    const u = new URL(url);
    let userId = null;
    const bearer = (headers["authorization"] ?? "").replace(/^Bearer /, "");
    try {
      const claims = JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString("utf8"));
      if (claims.role === "authenticated" && typeof claims.sub === "string") userId = claims.sub;
    } catch { /* anon */ }
    if (u.pathname.startsWith("/auth/v1/")) return { status: u.pathname.endsWith("/logout") ? 204 : 200, body: {} };
    if (u.pathname.startsWith("/storage/v1/")) {
      return serial(() => storage(method, u.pathname.replace("/storage/v1/", ""), u, body, userId, ip, headers["content-type"], raw));
    }
    const path = u.pathname.replace(/^\/rest\/v1\//, "");
    const res = await serial(() => path.startsWith("rpc/")
      ? rpc(path.slice(4), body ? JSON.parse(body) : {}, userId, ip)
      : table(method, path, u, body, userId, ip));
    if ((headers["accept"] ?? "").includes("vnd.pgrst.object") && Array.isArray(res.body) && res.status < 300) {
      if (res.body.length !== 1) return { status: 406, body: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${res.body.length} rows`, hint: null } };
      return { ...res, body: res.body[0] };
    }
    return res;
  }

  /** Direct SQL as the database owner, with request settings defined like PostgREST does. */
  const query = (sql, p) => serial(() => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', '{}', true), set_config('request.headers', '{}', true)");
    if (p && p.length) return tx.query(sql, p);
    const results = await tx.exec(sql);          // multi-statement scripts (no parameters)
    return results[results.length - 1] ?? { rows: [] };
  }));

  return { db, respond, query, close: () => db.close() };
}
