/**
 * Shared helpers for Cloudflare Pages Functions. These run on Cloudflare only;
 * they are not part of the static Next.js export.
 *
 * Authorization: the caller sends their Supabase access token; we ask Postgres
 * (the authorization boundary) whether that user holds the needed role by
 * calling the same SQL helper the RLS policies use. No service key is needed.
 */
export interface Env {
  SUPABASE_URL: string;          // plain var (same value as NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_ANON_KEY: string;     // plain var (public anon key)
  PAGES_DEPLOY_HOOK_URL?: string; // secret — Cloudflare Pages deploy hook
}

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

export type RoleCheck = "is_publisher" | "is_content_staff" | "is_super_admin";

/** Returns true only when Postgres confirms the bearer token's user passes `check`. */
export async function callerPasses(request: Request, env: Env, check: RoleCheck): Promise<boolean> {
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth) || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${check}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth, "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

/** Same-origin guard for state-changing requests made from the admin UI. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
