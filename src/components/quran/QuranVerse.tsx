import "server-only";
import { loadSurah } from "@/lib/quran/server";
import { excerpt, isHafs, type QuranRef } from "@/lib/quran/ref";
import { QuranBlock } from "./QuranBlock";

/** Build-time: renders a reference from the verified Tanzil bundle. */
export function QuranVerse({ quranRef: ref, riwayahCode, note, inline }: { quranRef: QuranRef; riwayahCode?: string | null; note?: string | null; inline?: boolean }) {
  if (ref.surah < 1 || ref.surah > 114) return null;
  const surah = loadSurah(ref.surah);
  const pieces = isHafs(riwayahCode) ? excerpt(surah, ref) : null;
  return <QuranBlock pieces={pieces} quranRef={ref} surahName={surah.name} note={note} inline={inline} />;
}
