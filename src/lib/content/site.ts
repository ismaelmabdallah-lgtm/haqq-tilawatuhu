/**
 * BUILD-TIME snapshot for the pre-rendered pages (fast, indexable, readable
 * even while the free database is paused). Pages refresh this live in the
 * browser (src/lib/content/live.ts), so publishing needs no rebuild.
 * Any database error fails the build instead of deploying an empty site.
 */
import "server-only";
import { getBuildClient } from "@/lib/supabase/client";
import { loadSnapshot, type Site } from "./model";

export * from "./model";

let cached: Promise<Site> | null = null;
/** Loaded once per build worker, through the anonymous role (RLS: published only). */
export function getSite(): Promise<Site> {
  cached ??= loadSnapshot(getBuildClient()).catch((e: Error) => { throw new Error(`[build] ${e.message}`); });
  return cached;
}
