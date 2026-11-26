"use client";
/**
 * Live refresh of published content in the browser (anonymous role → RLS shows
 * published content only). Pre-rendered pages start from their build-time
 * snapshot and swap in the live one, so newly published content appears
 * without a Cloudflare rebuild. If the database is unreachable (e.g. the free
 * project is paused) the pre-rendered content simply stays.
 */
import { useEffect, useState } from "react";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { loadLesson, loadSnapshot, type Lesson, type Site } from "./model";

let livePromise: Promise<Site | null> | null = null;

/** One light snapshot per page load, shared by every component on the page. */
export function fetchLiveSite(): Promise<Site | null> {
  livePromise ??= isSupabaseConfigured
    ? loadSnapshot(getBrowserClient(), { light: true }).catch(() => null)
    : Promise.resolve(null);
  return livePromise;
}

export type LiveState = { site: Site | null; live: boolean; failed: boolean };

/**
 * `initial` is the build-time snapshot (null on client-only routes).
 * Returns the live snapshot once loaded; heavy lesson fields from `initial` are
 * kept for lessons that are still published (the live snapshot is "light").
 */
export function useLiveSite(initial: Site | null): LiveState {
  const [state, setState] = useState<LiveState>({ site: initial, live: false, failed: false });
  useEffect(() => {
    let alive = true;
    void fetchLiveSite().then((live) => {
      if (!alive) return;
      if (!live) { setState((s) => ({ ...s, failed: true })); return; }
      const full = new Map((initial?.lessons ?? []).map((l) => [l.id, l]));
      setState({ site: { ...live, lessons: live.lessons.map((l) => (full.get(l.id)?.updated_at === l.updated_at ? full.get(l.id)! : l)) }, live: true, failed: false });
    });
    return () => { alive = false; };
  }, [initial]);
  return state;
}

/** Full lesson row: the pre-rendered one if unchanged, otherwise fetched live. */
export function useFullLesson(light: Lesson | null, prerendered: Lesson | null): Lesson | null {
  const [full, setFull] = useState<Lesson | null>(null);
  const upToDate = prerendered && light && prerendered.id === light.id && prerendered.updated_at === light.updated_at;
  useEffect(() => {
    if (!light || upToDate) return;
    let alive = true;
    void loadLesson(getBrowserClient(), light.id).then((l) => { if (alive) setFull(l); });
    return () => { alive = false; };
  }, [light, upToDate]);
  if (!light) return null;
  if (upToDate) return prerendered;
  return full && full.id === light.id ? full : null;
}
