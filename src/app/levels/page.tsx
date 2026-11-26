import { Breadcrumbs, Card, EmptyState, PageTitle, UNDER_REVIEW_NOTE, pagesLabel } from "@/components/ui";
import { chapterHref, chaptersOf, getSite, levelHref, lessonsOf, lessonsOfLevel } from "@/lib/content/site";
import { arDigits } from "@/lib/quran/ref";

export const metadata = { title: "المستويات" };

export default async function LevelsPage() {
  const site = await getSite();
  const ed = site.edition;
  return (
    <>
      <Breadcrumbs items={[{ label: "المستويات" }]} />
      <PageTitle title="المنهج والمستويات" subtitle={ed ? `${ed.curriculum.title} — ${ed.label}${ed.year_ce ? ` (${arDigits(ed.year_ce)}م)` : ""}` : null}>
        {ed && (
          <div className="space-y-1 text-sm text-muted">
            {ed.riwayah && <p>الرواية: {ed.riwayah.name_ar}{ed.riwayah.tariq ? ` من طريق ${ed.riwayah.tariq}` : ""}</p>}
            {ed.authors.length > 0 && <p>إعداد: {ed.authors.join("، ")}</p>}
            {ed.curriculum.affiliation_note && <p className="rounded bg-gold-100 px-2 py-1 text-gold-700">{ed.curriculum.affiliation_note}</p>}
          </div>
        )}
      </PageTitle>

      {site.levels.length === 0 ? (
        <EmptyState title="لم يُنشر المنهج بعد">{UNDER_REVIEW_NOTE}</EmptyState>
      ) : (
        <ol className="space-y-4">
          {site.levels.map((l) => {
            const chapters = chaptersOf(site, l.id);
            const published = lessonsOfLevel(site, l.id).length;
            return (
              <li key={l.id}>
                <Card>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a href={levelHref(l)} className="text-xl font-bold text-brand-900 hover:underline">
                      {l.title}{l.subtitle ? ` (${l.subtitle})` : ""}
                    </a>
                    <span className="text-xs text-muted">{pagesLabel(l.source_page_start, l.source_page_end)}</span>
                  </div>
                  {l.description && <p className="mt-1 text-sm text-muted">{l.description}</p>}
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {chapters.map((c) => {
                      const n = lessonsOf(site, c.id).length;
                      return (
                        <li key={c.id}>
                          <a href={chapterHref(l, c)} className="tap flex items-center justify-between gap-2 rounded-lg bg-brand-50/60 px-3 py-2 hover:bg-brand-50">
                            <span><span className="text-gold-700">{c.label ? `${c.label}: ` : ""}</span>{c.title}</span>
                            <span className="shrink-0 text-xs text-muted">{n ? `${arDigits(n)} درس` : "قيد المراجعة"}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-muted">{published ? `${arDigits(published)} درسًا منشورًا ومراجَعًا` : UNDER_REVIEW_NOTE}</p>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
