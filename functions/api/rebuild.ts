/**
 * POST /api/rebuild — regenerate the static site after content is published.
 * Only review admins / super admins (SQL is_publisher()) may trigger it.
 * The deploy hook URL is a secret that never leaves Cloudflare.
 */
import { callerPasses, json, sameOrigin, type Env } from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!(await callerPasses(request, env, "is_publisher"))) return json({ error: "not allowed" }, 403);
  if (!env.PAGES_DEPLOY_HOOK_URL) return json({ error: "deploy hook not configured" }, 503);

  const res = await fetch(env.PAGES_DEPLOY_HOOK_URL, { method: "POST" });
  if (!res.ok) return json({ error: `deploy hook failed (${res.status})` }, 502);
  return json({ ok: true, queued_at: new Date().toISOString() });
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({ enabled: Boolean(env.PAGES_DEPLOY_HOOK_URL) });
