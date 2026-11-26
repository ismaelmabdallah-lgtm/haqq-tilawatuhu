/**
 * Quranic references. Text is NEVER typed or stored here: it is looked up by
 * reference in the verified Tanzil bundle (public/quran/*.json, produced by
 * scripts/quran-setup.mjs) and shown verbatim.
 */
export type QuranRef = { surah: number; ayah: number; ayahEnd?: number; wordStart?: number; wordEnd?: number };

export type SurahFile = { surah: number; name: string; ayat: string[]; source: QuranSource };
export type SurahIndex = { source: QuranSource; surahs: { number: number; ayat: number; name: string; tname: string; type: string }[] };
export type QuranSource = { name: string; url: string; license: string; sha256: string; copyright: string };

/** Quranic annotation (waqf) marks, written as their own space-separated tokens in the Tanzil text. */
const MARK_ONLY = /^[ۖ-ۭؐ-ؚ]+$/;

export type AyahPiece = { ayah: number; text: string };

/**
 * Picks the referenced ayat (and, for a single ayah, a word range) VERBATIM.
 * Word numbers count words only; waqf marks inside the range are kept.
 */
export function excerpt(surah: SurahFile, ref: QuranRef): AyahPiece[] | null {
  const end = ref.ayahEnd ?? ref.ayah;
  if (ref.ayah < 1 || end < ref.ayah || end > surah.ayat.length) return null;
  const pieces: AyahPiece[] = [];
  for (let n = ref.ayah; n <= end; n++) pieces.push({ ayah: n, text: surah.ayat[n - 1]! });
  if (ref.wordStart && end === ref.ayah) {
    const tokens = pieces[0]!.text.split(" ");
    const wordEnd = ref.wordEnd ?? ref.wordStart;
    let word = 0;
    const kept: string[] = [];
    for (const tok of tokens) {
      if (!MARK_ONLY.test(tok)) word++;
      if (word >= ref.wordStart && word <= wordEnd) kept.push(tok);
    }
    if (word < wordEnd || kept.length === 0) return null;
    return [{ ayah: ref.ayah, text: kept.join(" ") }];
  }
  return pieces;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const arDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]!);

export function refLabel(surahName: string | undefined, ref: QuranRef): string {
  const ayat = ref.ayahEnd && ref.ayahEnd !== ref.ayah ? `${arDigits(ref.ayah)}–${arDigits(ref.ayahEnd)}` : arDigits(ref.ayah);
  return `${surahName ? `سورة ${surahName}` : `السورة ${arDigits(ref.surah)}`}: ${ayat}`;
}

/** Inline markdown syntax for editors: [[quran:2:121]], [[quran:2:121-123]], [[quran:2:121:3-5]]. */
export const QURAN_TOKEN = /\[\[quran:(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?(?::(\d{1,3})(?:-(\d{1,3}))?)?\]\]/g;

export function parseToken(m: RegExpMatchArray): QuranRef | null {
  const ref: QuranRef = { surah: Number(m[1]), ayah: Number(m[2]) };
  if (m[3]) ref.ayahEnd = Number(m[3]);
  if (m[4]) { ref.wordStart = Number(m[4]); ref.wordEnd = m[5] ? Number(m[5]) : Number(m[4]); }
  return ref.surah >= 1 && ref.surah <= 114 ? ref : null;
}

/** Converts DB shapes (quranic_examples row / question quran_ref) to a QuranRef. */
export function fromExample(e: { surah: number; ayah_start: number; ayah_end: number; word_start: number | null; word_end: number | null }): QuranRef {
  return { surah: e.surah, ayah: e.ayah_start, ayahEnd: e.ayah_end, wordStart: e.word_start ?? undefined, wordEnd: e.word_end ?? undefined };
}
export function fromPromptRef(r: { surah: number; ayah: number; ayah_end?: number; word_start?: number; word_end?: number }): QuranRef {
  return { surah: r.surah, ayah: r.ayah, ayahEnd: r.ayah_end, wordStart: r.word_start, wordEnd: r.word_end };
}

/** Only Hafs text is bundled; other riwayat show the reference without text. */
export const isHafs = (riwayahCode: string | null | undefined) => !riwayahCode || riwayahCode.startsWith("hafs");
