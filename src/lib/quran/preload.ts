/** Build-time: resolve references from the verified bundle for pre-rendered pages. */
import "server-only";
import type { Resolved } from "@/components/quran/QuranVerseClient";
import { quranKey } from "@/lib/content/model";
import { loadSurah } from "./server";
import { excerpt, isHafs, parseToken, QURAN_TOKEN, type QuranRef } from "./ref";

export function refsInMarkdown(...sources: (string | null | undefined)[]): QuranRef[] {
  return sources.flatMap((s) => [...(s ?? "").matchAll(QURAN_TOKEN)].map(parseToken).filter((r): r is QuranRef => r !== null));
}

export function preloadQuran(refs: { ref: QuranRef; riwayahCode?: string | null }[]): Record<string, Resolved> {
  const out: Record<string, Resolved> = {};
  for (const { ref, riwayahCode } of refs) {
    if (ref.surah < 1 || ref.surah > 114) continue;
    const s = loadSurah(ref.surah);
    out[quranKey(ref)] = { pieces: isHafs(riwayahCode) ? excerpt(s, ref) : null, name: s.name };
  }
  return out;
}
