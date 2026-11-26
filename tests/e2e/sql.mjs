/** TEST-ONLY: run SQL as the database owner on the e2e stand-in (never a real project). */
const BASE = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54329";

export async function sql(query, params = []) {
  const res = await fetch(`${BASE}/__test/sql`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sql: query, params }) });
  const body = await res.json();
  if (!res.ok) throw new Error(`sql failed: ${body.message}`);
  return body;
}
