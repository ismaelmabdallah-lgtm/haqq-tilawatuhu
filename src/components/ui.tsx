import Link from "next/link";
import type { Database } from "@/lib/database.types";
import { arDigits } from "@/lib/quran/ref";

type Origin = Database["public"]["Enums"]["content_origin"];

export const ORIGIN_LABEL: Record<Origin, string> = {
  curriculum_quoted: "منقول من المنهج",
  supplementary_explanation: "شرح مساند",
  independent_material: "مادة مستقلة",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "brand" | "gold" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-line/60 text-ink",
    brand: "bg-brand-50 text-brand-700",
    gold: "bg-gold-100 text-gold-700",
    warn: "bg-amber-50 text-warn",
    danger: "bg-red-50 text-danger",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function pagesLabel(start: number | null | undefined, end?: number | null) {
  if (!start) return null;
  return end && end !== start ? `ص ${arDigits(start)}–${arDigits(end)}` : `ص ${arDigits(start)}`;
}

/** Origin + page reference + review status — shown on every content item. */
export function ProvenanceBadges({ origin, verified, pageStart, pageEnd, editionLabel }: {
  origin: Origin; verified: boolean; pageStart?: number | null; pageEnd?: number | null; editionLabel?: string | null;
}) {
  const pages = pagesLabel(pageStart, pageEnd);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {verified && <Badge tone="brand">✓ مراجَع علميًا</Badge>}
      <Badge tone={origin === "curriculum_quoted" ? "gold" : "neutral"}>{ORIGIN_LABEL[origin]}</Badge>
      {pages && <Badge>{editionLabel ? `${editionLabel}، ` : ""}{pages}</Badge>}
    </div>
  );
}

export type Crumb = { href?: string; label: string };
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="مسار التصفح" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li><Link href="/" className="hover:underline">الرئيسية</Link></li>
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            <span aria-hidden>‹</span>
            {c.href ? <Link href={c.href} className="hover:underline">{c.label}</Link> : <span aria-current="page" className="text-ink">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string | null; children?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold leading-snug text-brand-900 sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 p-6 text-center" data-empty-state>
      <p className="font-bold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Card({ href, children, className = "" }: { href?: string; children: React.ReactNode; className?: string }) {
  const cls = `block rounded-xl border border-line bg-card p-4 shadow-sm ${href ? "transition hover:border-brand-500 hover:shadow" : ""} ${className}`;
  return href ? <Link href={href} className={cls}>{children}</Link> : <div className={cls}>{children}</div>;
}

export function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="mt-8" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <h2 id={id ? `${id}-h` : undefined} className="mb-3 text-xl font-bold text-brand-900">{title}</h2>
      {children}
    </section>
  );
}

export const UNDER_REVIEW_NOTE = "محتوى هذا القسم قيد الاستخراج والمراجعة العلمية، ولا يُنشر إلا بعد اعتماده من مراجع علمي مؤهل.";

export function NotFoundNotice({ what = "الصفحة" }: { what?: string }) {
  return (
    <div className="py-10 text-center" data-not-found>
      <h1 className="text-2xl font-bold text-brand-900">{what} غير موجودة</h1>
      <p className="mt-2 text-muted">ربما لم يُنشر هذا المحتوى بعد، أو تغيّر رابطه.</p>
      <Link href="/levels/" className="tap mt-4 inline-flex items-center rounded-lg bg-brand-700 px-4 text-white">تصفّح المستويات</Link>
    </div>
  );
}
