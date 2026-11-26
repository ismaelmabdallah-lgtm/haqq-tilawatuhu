#!/usr/bin/env node
/**
 * READ-ONLY check of what an anonymous visitor can do on the live project.
 * Writes nothing (start_attempt is never called).
 *   node --env-file=.env.local scripts/check-live-access.mjs
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let bad = 0;
const ok = (name, pass, detail = "") => { if (!pass) bad++; console.log(`${pass ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`); };

for (const t of ["curriculum_editions", "levels", "chapters", "lessons", "resources", "tajweed_topics", "articulation_points",
                 "letter_characteristics", "academy_letters", "quranic_examples", "exams", "announcements"]) {
  const { data, error } = await sb.from(t).select("*").limit(200);
  ok(`anon can read ${t}`, !error, error ? error.message : `${data.length} visible row(s)`);
}
for (const t of ["question_keys", "exam_questions", "exam_attempts", "attempt_answers", "guest_rate", "audit_log"]) {
  const { data, error } = await sb.from(t).select("*").limit(1);
  ok(`anon sees nothing in ${t}`, Boolean(error) || data.length === 0, error ? `blocked (${error.code})` : `${data.length} row(s)`);
}
{
  const { data } = await sb.from("lessons").select("status").neq("status", "published").limit(1);
  ok("no unpublished lesson visible to anon", (data ?? []).length === 0);
}
{
  const { error } = await sb.rpc("get_attempt_result", { p_attempt: "00000000-0000-0000-0000-000000000000", p_token: "x" });
  ok("attempt lookup works (expects 'attempt not found')", error?.code === "P0002", error ? `${error.code} ${error.message}` : "no error");
}
{
  const { error } = await sb.rpc("search_content", { p_query: "النون" });
  ok("search_content runs", !error, error?.message);
}
{
  const { error } = await sb.rpc("heartbeat");
  ok("heartbeat() not callable by anon", Boolean(error), error ? `blocked (${error.code})` : "CALLABLE");
}
console.log(bad ? `\n${bad} check(s) failed` : "\nall checks passed");
process.exit(bad ? 1 : 0);
