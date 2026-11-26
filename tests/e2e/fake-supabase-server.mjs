#!/usr/bin/env node
/**
 * TEST-ONLY local HTTP stand-in for Supabase (REST, Storage, Auth) backed by
 * PGlite with the real schema — see tests/e2e/pglite-api.mjs. The e2e build
 * reads its pre-rendered content from here and the browser talks to it live,
 * so static and live data come from the same database. Never the live project.
 *
 *   node tests/e2e/fake-supabase-server.mjs        (port: FAKE_SUPABASE_PORT, default 54329)
 *
 * Test hooks (localhost only): GET /__test/health, POST /__test/sql {sql, params}
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createApi } from "./pglite-api.mjs";
import { usersSql } from "./session.mjs";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54329);
const api = await createApi({ extraSql: [usersSql(), readFileSync(new URL("../fixtures/e2e-content.sql", import.meta.url), "utf8")] });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD",
  "access-control-expose-headers": "content-range, content-type",
};

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { ...CORS, ...headers });
    res.end(body);
  };
  try {
    if (req.method === "OPTIONS") return send(204, "");
    const url = `http://127.0.0.1:${PORT}${req.url}`;
    if (req.url === "/__test/health") return send(200, "ok");
    if (req.url === "/__test/sql" && req.method === "POST") {
      const { sql, params } = JSON.parse(raw.toString("utf8"));
      const r = await api.query(sql, params ?? []);
      return send(200, JSON.stringify(r.rows), { "content-type": "application/json" });
    }
    const out = await api.respond({ method: req.method, url, headers: req.headers, body: raw.toString("utf8"), raw });
    if (out.raw) return send(out.status, out.raw, out.headers ?? {});
    return send(out.status, out.status === 204 ? "" : JSON.stringify(out.body), { "content-type": "application/json" });
  } catch (e) {
    return send(500, JSON.stringify({ message: String(e?.message ?? e) }), { "content-type": "application/json" });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`fake supabase ready on http://127.0.0.1:${PORT}`));
