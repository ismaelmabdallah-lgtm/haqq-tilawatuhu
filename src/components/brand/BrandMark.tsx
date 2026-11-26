/**
 * Brand emblem: an open Mushaf resting on a rahl (book stand), emerald
 * (#14532d), warm gold (#d97706) and warm ivory (#fdfbf7). Pure SVG, no text,
 * so it stays crisp at favicon size. public/icon.svg is the same drawing.
 */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="شعار حق تلاوته">
      <rect width="64" height="64" rx="16" fill="#14532d" />
      {/* eight-point star ornament */}
      <g transform="translate(32 15)" fill="#d97706">
        <rect x="-4.2" y="-4.2" width="8.4" height="8.4" rx="1" />
        <rect x="-4.2" y="-4.2" width="8.4" height="8.4" rx="1" transform="rotate(45)" />
      </g>
      <circle cx="32" cy="15" r="2" fill="#14532d" />
      {/* open pages */}
      <path d="M32 26c-5-3.6-11.5-4.8-18-4v22c6.5-.8 13 .4 18 4z" fill="#fdfbf7" />
      <path d="M32 26c5-3.6 11.5-4.8 18-4v22c-6.5-.8-13 .4-18 4z" fill="#fdfbf7" />
      <path d="M32 26v22" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
      {/* text lines on the pages */}
      <g stroke="#14532d" strokeWidth="1.3" strokeLinecap="round" opacity=".55">
        <path d="M18 28.5c3.5-.4 7 .2 10 1.6M18 33c3.5-.4 7 .2 10 1.6M18 37.5c3.5-.4 7 .2 10 1.6" />
        <path d="M46 28.5c-3.5-.4-7 .2-10 1.6M46 33c-3.5-.4-7 .2-10 1.6M46 37.5c-3.5-.4-7 .2-10 1.6" />
      </g>
      {/* rahl (stand) */}
      <path d="M13 47.5 32 55l19-7.5" fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Emblem + diacritic-free wordmark (easier to read at small sizes). */
export function BrandLogo({ size = 40, tagline = false, tone = "dark" }: { size?: number; tagline?: boolean; tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="flex flex-col leading-tight">
        <span className={`text-xl font-bold tracking-tight ${tone === "dark" ? "text-brand-700" : "text-white"}`}>حق تلاوته</span>
        {tagline && <span className={`text-xs ${tone === "dark" ? "text-muted" : "text-brand-100"}`}>رحلتك نحو إتقان تلاوة القرآن الكريم</span>}
      </span>
    </span>
  );
}
