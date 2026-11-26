import { arDigits, refLabel, type AyahPiece, type QuranRef } from "@/lib/quran/ref";

/** Presentational: verbatim ayat from the verified source + reference label. */
export function QuranBlock({ pieces, quranRef: ref, surahName, note, inline = false }: {
  pieces: AyahPiece[] | null; quranRef: QuranRef; surahName?: string; note?: string | null; inline?: boolean;
}) {
  const label = refLabel(surahName, ref);
  if (!pieces) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-gold-100 px-2 py-0.5 text-sm text-gold-700" data-quran-ref>
        ﴿ {label} ﴾ <span className="sr-only">(النص غير متاح)</span>
      </span>
    );
  }
  const Wrapper = inline ? "span" : "figure";
  return (
    <Wrapper className={inline ? "inline" : "my-3 rounded-xl border border-gold-100 bg-white px-4 py-3"} data-quran-ref>
      <blockquote className="quran text-ink" lang="ar" dir="rtl">
        {pieces.map((p, i) => (
          <span key={p.ayah}>
            {i > 0 && " "}
            {p.text}
            {(pieces.length > 1 || !ref.wordStart) && <span className="mx-1 text-gold-700" aria-hidden>﴿{arDigits(p.ayah)}﴾</span>}
          </span>
        ))}
      </blockquote>
      {!inline && (
        <figcaption className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{label}{ref.wordStart ? ` — الكلمات ${arDigits(ref.wordStart)}${ref.wordEnd && ref.wordEnd !== ref.wordStart ? `–${arDigits(ref.wordEnd)}` : ""}` : ""}</span>
          {note && <span>{note}</span>}
        </figcaption>
      )}
    </Wrapper>
  );
}
