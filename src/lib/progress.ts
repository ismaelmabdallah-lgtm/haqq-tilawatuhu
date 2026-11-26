"use client";
/**
 * Guest progress kept in this browser (no account needed). With an optional
 * account it is also synced via mark_lesson(), and can be imported once with
 * import_guest_progress() (viewed/completed only — never practice/mastery).
 */
const KEY = "haqq:progress:v1";
export type LocalProgress = Record<string, { viewed_at?: string; completed_at?: string }>;

const listeners = new Set<() => void>();
let snapshot: LocalProgress | null = null;
const EMPTY: LocalProgress = {};

function read(): LocalProgress {
  if (snapshot) return snapshot;
  try { snapshot = JSON.parse(localStorage.getItem(KEY) ?? "{}") as LocalProgress; } catch { snapshot = {}; }
  return snapshot;
}
function write(next: LocalProgress) {
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full / private mode */ }
  listeners.forEach((l) => l());
}

export const progressStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) { snapshot = null; cb(); } };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
  },
  get: read,
  server: () => EMPTY,
};

export function markLocal(lessonId: string, action: "viewed" | "completed" | "uncompleted") {
  const cur = read();
  const now = new Date().toISOString();
  const item = { ...cur[lessonId] };
  if (action === "viewed") item.viewed_at ??= now;
  if (action === "completed") { item.viewed_at ??= now; item.completed_at ??= now; }
  if (action === "uncompleted") delete item.completed_at;
  write({ ...cur, [lessonId]: item });
}

export function importItems(p: LocalProgress) {
  return Object.entries(p).map(([lesson_id, v]) => ({ lesson_id, completed: Boolean(v.completed_at) }));
}
