import Link from "next/link";
import { Markdown } from "@/components/content/Markdown";
import { ResourceItem } from "@/components/content/ResourceItem";
import { QuranVerse } from "@/components/quran/QuranVerse";
import { Breadcrumbs, NotFoundNotice, PageTitle, ProvenanceBadges, Section } from "@/components/ui";
import { characteristicHref, characteristicsOfLetter, examplesOfLetter, pointHref } from "@/lib/content/academy";
import { getSite, orPlaceholder } from "@/lib/content/site";
import { fromExample } from "@/lib/quran/ref";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.letters.map((l) => ({ n: String(l.sort_order) })), ["n"]);
}

type Props = { params: Promise<{ n: string }> };

export async function generateMetadata({ params }: Props) {
  const { n } = await params;
  const l = (await getSite()).letters.find((x) => String(x.sort_order) === n);
  return l ? { title: `الحرف ${l.letter}` } : { title: "غير موجود", robots: { index: false } };
}

export default async function LetterPage({ params }: Props) {
  const { n } = await params;
  const site = await getSite();
  const letter = site.letters.find((l) => String(l.sort_order) === n);
  if (!letter) return <NotFoundNotice what="صفحة الحرف" />;
  const point = site.points.find((p) => p.id === letter.articulation_point_id);
  const chars = characteristicsOfLetter(site, letter.id);
  const examples = examplesOfLetter(site, letter.id);
  const audio = site.resources.find((r) => r.id === letter.audio_resource_id);
  const riwayahCode = site.edition?.riwayah?.code;

  return (
    <article>
      <Breadcrumbs items={[{ href: "/academy/", label: "الأكاديمية" }, { label: `الحرف ${letter.letter}` }]} />
      <PageTitle title={`الحرف «${letter.letter}»`}>
        <ProvenanceBadges origin={letter.origin} verified={letter.scientifically_verified} pageStart={letter.source_page_start} />
      </PageTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-muted">المخرج</p>
          {point ? <Link href={pointHref(point.code)} className="font-bold text-brand-700 underline">{point.name} ({point.general_area})</Link> : <p>—</p>}
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-muted">الصفات</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {chars.length ? chars.map((c) => <li key={c.id}><Link href={characteristicHref(c.code)} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">{c.name}</Link></li>) : <li>—</li>}
          </ul>
        </div>
      </div>
      {audio && <Section title="النطق الصحيح"><ul><ResourceItem r={audio} /></ul></Section>}
      {letter.description_md && <Section title="الوصف"><Markdown source={letter.description_md} riwayahCode={riwayahCode} /></Section>}
      {letter.common_mistakes_md && <Section title="أخطاء شائعة"><Markdown source={letter.common_mistakes_md} riwayahCode={riwayahCode} /></Section>}
      {examples.length > 0 && (
        <Section title="أمثلة قرآنية">
          {examples.map((e) => <QuranVerse key={e.id} quranRef={fromExample(e)} riwayahCode={site.riwayat.find((r) => r.id === e.riwayah_id)?.code ?? riwayahCode} note={e.note} />)}
        </Section>
      )}
    </article>
  );
}
