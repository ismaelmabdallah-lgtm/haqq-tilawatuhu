"use client";
import { useEffect, useState } from "react";
import { fetchSurah } from "@/lib/quran/client";
import { excerpt, type AyahPiece, type QuranRef } from "@/lib/quran/ref";
import { QuranBlock } from "./QuranBlock";

/** Browser: renders a reference from the verified Tanzil bundle (/quran/<n>.json). */
export function QuranVerseClient({ quranRef }: { quranRef: QuranRef }) {
  const [state, setState] = useState<{ pieces: AyahPiece[] | null; name?: string } | null>(null);
  const { surah, ayah, ayahEnd, wordStart, wordEnd } = quranRef;
  useEffect(() => {
    let alive = true;
    fetchSurah(surah)
      .then((s) => { if (alive) setState({ pieces: excerpt(s, { surah, ayah, ayahEnd, wordStart, wordEnd }), name: s.name }); })
      .catch(() => { if (alive) setState({ pieces: null }); });
    return () => { alive = false; };
  }, [surah, ayah, ayahEnd, wordStart, wordEnd]);
  if (!state) return <div className="my-3 h-16 animate-pulse rounded-xl bg-gold-100/50" aria-label="جارٍ تحميل الآية" />;
  return <QuranBlock pieces={state.pieces} quranRef={quranRef} surahName={state.name} />;
}
