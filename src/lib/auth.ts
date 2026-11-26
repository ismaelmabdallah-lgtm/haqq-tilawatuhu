"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type PlatformRole = Database["public"]["Enums"]["platform_role"];

export type SessionState = { loading: true; session: null } | { loading: false; session: Session | null };

/** Current optional session (accounts are never required for learning). */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    isSupabaseConfigured ? { loading: true, session: null } : { loading: false, session: null });
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getBrowserClient();
    let alive = true;
    sb.auth.getSession().then(({ data }) => { if (alive) setState({ loading: false, session: data.session }); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (alive) setState({ loading: false, session }); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return state;
}

export type RolesState = { loading: boolean; roles: PlatformRole[] };

/**
 * The caller's platform team roles. RLS (pra_select) returns only the caller's
 * own rows. This drives UI only — every action is re-checked in Postgres.
 * Pass undefined while the session is loading, null when signed out.
 */
export function useRoles(userId: string | null | undefined): RolesState {
  const [result, setResult] = useState<{ userId: string; roles: PlatformRole[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getBrowserClient().from("platform_role_assignments").select("role").eq("user_id", userId)
      .then(({ data }) => { if (alive) setResult({ userId, roles: (data ?? []).map((r) => r.role) }); });
    return () => { alive = false; };
  }, [userId]);
  if (userId === undefined) return { loading: true, roles: [] };   // session still loading
  if (!userId) return { loading: false, roles: [] };
  if (result?.userId !== userId) return { loading: true, roles: [] };
  return { loading: false, roles: result.roles };
}

const has = (roles: PlatformRole[], allowed: PlatformRole[]) => roles.some((r) => allowed.includes(r));

/** Mirrors the SQL helpers in migration 0001/0003/0004 (UI gating only). */
export const can = {
  team: (r: PlatformRole[]) => r.length > 0,
  superAdmin: (r: PlatformRole[]) => has(r, ["super_admin"]),
  contentStaff: (r: PlatformRole[]) => has(r, ["super_admin", "scientific_review_admin", "scientific_reviewer", "content_editor"]),
  review: (r: PlatformRole[]) => has(r, ["super_admin", "scientific_review_admin", "scientific_reviewer"]),
  publish: (r: PlatformRole[]) => has(r, ["super_admin", "scientific_review_admin"]),
  exams: (r: PlatformRole[]) => has(r, ["super_admin", "scientific_review_admin", "content_editor"]),
  grade: (r: PlatformRole[]) => has(r, ["super_admin", "scientific_review_admin", "grader"]),
  announcements: (r: PlatformRole[]) => has(r, ["super_admin", "moderator", "content_editor"]),
};

export const ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "مدير عام",
  scientific_review_admin: "مدير المراجعة العلمية",
  scientific_reviewer: "مراجع علمي",
  content_editor: "محرر محتوى",
  grader: "مصحح",
  moderator: "مشرف إعلانات",
};
