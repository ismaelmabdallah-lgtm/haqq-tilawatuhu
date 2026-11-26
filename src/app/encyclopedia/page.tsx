import { Breadcrumbs, Card, EmptyState, PageTitle, UNDER_REVIEW_NOTE } from "@/components/ui";
import { getSite } from "@/lib/content/site";

export const metadata = { title: "موسوعة التجويد" };

export default async function EncyclopediaPage() {
  const site = await getSite();
  const byLetter = new Map<string, typeof site.topics>();
  for (const t of site.topics) {
    const first = t.title.replace(/^(ال)/, "").trim().charAt(0) || "؟";
    byLetter.set(first, [...(byLetter.get(first) ?? []), t]);
  }
  const groups = [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b, "ar"));

  return (
    <>
      <Breadcrumbs items={[{ label: "الموسوعة" }]} />
      <PageTitle title="موسوعة التجويد" subtitle="تعريفات الأحكام وشرحها، مرتبطة بدروس المنهج. كل مدخل مراجَع علميًا قبل نشره." />
      {site.topics.length === 0 ? <EmptyState title="لا توجد مداخل منشورة بعد">{UNDER_REVIEW_NOTE}</EmptyState> : (
        <div className="space-y-6">
          {groups.map(([letter, topics]) => (
            <section key={letter} aria-label={`حرف ${letter}`}>
              <h2 className="mb-2 text-lg font-bold text-gold-700">{letter}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {topics.map((t) => (
                  <li key={t.id}>
                    <Card href={`/encyclopedia/${t.slug}/`}>
                      <p className="font-bold text-brand-900">{t.title}</p>
                      {t.definition && <p className="mt-1 line-clamp-2 text-sm text-muted">{t.definition}</p>}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
