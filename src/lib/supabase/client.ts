/**
 * Supabase clients. Only the PUBLIC anon key is ever used here; every query is
 * limited by Row Level Security and every privileged step runs in a checked
 * SECURITY DEFINER function. No service key exists in the static export.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type DB = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

function requireEnv(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (see .env.example).");
  }
  return { url, anonKey };
}

/** Fixed (project-independent) localStorage key for the optional session. */
export const AUTH_STORAGE_KEY = "haqq-auth";

let browserClient: DB | null = null;

/** Browser client: optional session persisted in localStorage. */
export function getBrowserClient(): DB {
  if (typeof window === "undefined") throw new Error("getBrowserClient() is browser-only");
  if (!browserClient) {
    const env = requireEnv();
    browserClient = createClient<Database>(env.url, env.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: AUTH_STORAGE_KEY },
    });
  }
  return browserClient;
}

let buildClient: DB | null = null;

/** Build-time client (static generation): anonymous, so RLS shows only published content. */
export function getBuildClient(): DB {
  if (!buildClient) {
    const env = requireEnv();
    buildClient = createClient<Database>(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return buildClient;
}
