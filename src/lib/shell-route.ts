/**
 * Client-only dynamic routes in a static export.
 *
 * /exams/:id, /attempts/:id and /certificates/:id are exported ONCE as a shell
 * page at /<route>/_/. Cloudflare Pages (public/_redirects) and `next dev`
 * (rewrites in next.config.ts) serve that shell for any id while the browser
 * keeps the real URL, so the id is read from window.location — which works for
 * client navigation, direct open and refresh alike.
 */
export const SHELL_PLACEHOLDER = "_";
export type ShellRoute = "exams" | "attempts" | "certificates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{2,80}$/;

/** Extracts the id segment from a pathname such as "/exams/<id>/". */
export function parseShellId(route: ShellRoute, pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== route || parts.length !== 2) return null;
  let id: string;
  try { id = decodeURIComponent(parts[1]!); } catch { return null; }
  if (id === SHELL_PLACEHOLDER) return null;
  if (UUID.test(id)) return id.toLowerCase();
  if (route === "exams" && SLUG.test(id)) return id;   // exams may also be addressed by slug
  return null;
}

export const isUuid = (s: string) => UUID.test(s);

export const shellHref = (route: ShellRoute, id: string) => `/${route}/${encodeURIComponent(id)}/`;
