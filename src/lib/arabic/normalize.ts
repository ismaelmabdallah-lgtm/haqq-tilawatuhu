/**
 * Arabic normalization for SEARCH ONLY — mirrors public.normalize_arabic() in
 * supabase/migrations/…_curriculum_content_review.sql. Never apply this to
 * displayed Quranic or curriculum text.
 *
 * Removes: harakat, tanween, shadda, sukun, superscript alef, Quranic
 * annotation marks (U+06D6–U+06ED), tatweel. Unifies: أ إ آ ٱ → ا, ى → ي,
 * ة → ه, ؤ → و, ئ → ي. Collapses whitespace.
 */
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const MAP: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي",
};
const MAP_RE = /[أإآٱىةؤئ]/g;

export function normalizeArabic(input: string | null | undefined): string {
  return (input ?? "")
    .replace(MARKS, "")
    .replace(MAP_RE, (ch) => MAP[ch] ?? ch)
    .replace(/\s+/g, " ")
    .trim();
}

/** Same comparison the database uses to grade short text answers. */
export function normAnswer(input: string | null | undefined): string {
  return normalizeArabic(input).toLowerCase();
}
