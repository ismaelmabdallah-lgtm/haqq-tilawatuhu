import Link from "next/link";
import { Breadcrumbs, Card, EmptyState, PageTitle, Section, UNDER_REVIEW_NOTE } from "@/components/ui";
import { characteristicHref, letterHref, lettersOfPoint, pointHref, pointsByArea } from "@/lib/content/academy";
import { getSite } from "@/lib/content/site";

export const metadata = { title: "أكاديمية المخارج والصفات" };

export default async function AcademyPage() {
  const site = await getSite();
  const empty = !site.points.length && !site.characteristics.length && !site.letters.length;
  const opposite = (id: string | null) => (id ? site.characteristics.find((c) => c.id === id) : undefined);
  const withOpposite = site.characteristics.filter((c) => c.has_opposite);
  const seen = new Set<string>();
  const pairs = withOpposite.flatMap((c) => {
    if (seen.has(c.id)) return [];
    const o = opposite(c.opposite_id);
    seen.add(c.id); if (o) seen.add(o.id);
    return [[c, o] as const];
  });
  const single = site.characteristics.filter((c) => !c.has_opposite);

  return (
    <>
      <Breadcrumbs items={[{ label: "أكاديمية المخارج والصفات" }]} />
      <PageTitle title="أكاديمية المخارج والصفات" subtitle="مخارج الحروف العربية وصفاتها، كما وردت في المنهج مع أرقام الصفحات، ومراجعة علميًا." />
      {empty && <EmptyState title="لم يُنشر محتوى الأكاديمية بعد">{UNDER_REVIEW_NOTE}</EmptyState>}

      {site.letters.length > 0 && (
        <Section title="الحروف" id="letters">
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {site.letters.map((l) => (
              <li key={l.id}>
                <Link href={letterHref(l)} className="tap grid aspect-square place-items-center rounded-xl border border-line bg-white text-3xl font-bold text-brand-900 hover:border-brand-500" aria-label={`الحرف ${l.letter}`}>
                  {l.letter}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {site.points.length > 0 && (
        <Section title="المخارج" id="points">
          <div className="space-y-4">
            {pointsByArea(site).map(([area, points]) => (
              <div key={area}>
                <h3 className="mb-2 font-bold text-gold-700">{area}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {points.map((p) => (
                    <li key={p.id}>
                      <Card href={pointHref(p.code)}>
                        <p className="font-bold">{p.name}</p>
                        <p className="mt-1 text-2xl tracking-widest text-brand-700">{lettersOfPoint(site, p.id).map((l) => l.letter).join(" ") || "—"}</p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {site.characteristics.length > 0 && (
        <Section title="الصفات" id="characteristics">
          {pairs.length > 0 && (
            <>
              <h3 className="mb-2 font-bold text-gold-700">صفات لها ضد</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {pairs.map(([a, b]) => (
                  <li key={a.id} className="flex items-stretch gap-2">
                    <Link href={characteristicHref(a.code)} className="tap flex flex-1 items-center justify-center rounded-lg border border-line bg-white font-bold hover:border-brand-500">{a.name}</Link>
                    <span className="self-center text-muted" aria-label="ضدها">⇄</span>
                    {b ? <Link href={characteristicHref(b.code)} className="tap flex flex-1 items-center justify-center rounded-lg border border-line bg-white font-bold hover:border-brand-500">{b.name}</Link> : <span className="flex-1" />}
                  </li>
                ))}
              </ul>
            </>
          )}
          {single.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 font-bold text-gold-700">صفات لا ضد لها</h3>
              <ul className="flex flex-wrap gap-2">
                {single.map((c) => <li key={c.id}><Link href={characteristicHref(c.code)} className="tap inline-flex items-center rounded-lg border border-line bg-white px-4 font-bold hover:border-brand-500">{c.name}</Link></li>)}
              </ul>
            </>
          )}
        </Section>
      )}
    </>
  );
}
