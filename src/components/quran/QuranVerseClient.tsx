"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { fetchSurah } from "@/lib/quran/client";
import { excerpt, isHafs, type AyahPiece, type QuranRef } from "@/lib/quran/ref";
import { quranKey } from "@/lib/content/model";
import { QuranBlock } from "./QuranBlock";

export type Resolved = { pieces: AyahPiece[] | null; name?: string };
/** Verses resolved at build time from the verified bundle, keyed by quranKey(ref). */
export const QuranPreload = createContext<Record<string, Resolved>>({});

/** Renders a reference from the verified Tanzil bundle (preloaded at build, or /quran/<n>.json). */
export function QuranVerseClient({ quranRef, riwayahCode, note }: { quranRef: QuranRef; riwayahCode?: string | null; note?: string | null }) {
  const pre = useContext(QuranPreload)[quranKey(quranRef)];
  const [state, setState] = useState<Resolved | null>(null);
  const { surah, ayah, ayahEnd, wordStart, wordEnd } = quranRef;
  const hafs = isHafs(riwayahCode);
  useEffect(() => {
    if (pre) return;
    let alive = true;
    fetchSurah(surah)
      .then((s) => { if (alive) setState({ pieces: hafs ? excerpt(s, { surah, ayah, ayahEnd, wordStart, wordEnd }) : null, name: s.name }); })
      .catch(() => { if (alive) setState({ pieces: null }); });
    return () => { alive = false; };
  }, [pre, hafs, surah, ayah, ayahEnd, wordStart, wordEnd]);
  const r = pre ?? state;
  if (!r) return <div className="skeleton my-3 h-20" aria-label="جارٍ تحميل الآية" />;
  return <QuranBlock pieces={r.pieces} quranRef={quranRef} surahName={r.name} note={note} />;
}
