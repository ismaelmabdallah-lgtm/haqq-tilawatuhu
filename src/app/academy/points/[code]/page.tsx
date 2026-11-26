import Link from "next/link";
import { Markdown } from "@/components/content/Markdown";
import { ResourceItem } from "@/components/content/ResourceItem";
import { Breadcrumbs, NotFoundNotice, PageTitle, ProvenanceBadges, Section } from "@/components/ui";
import { letterHref, lettersOfPoint } from "@/lib/content/academy";
import { getSite, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.points.map((p) => ({ code: p.code })), ["code"]);
}

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const p = (await getSite()).points.find((x) => x.code === code);
  return p ? { title: `مخرج ${p.name}` } : { title: "غير موجود", robots: { index: false } };
}

export default async function PointPage({ params }: Props) {
  const { code } = await params;
  const site = await getSite();
  const point = site.points.find((p) => p.code === code);
  if (!point) return <NotFoundNotice what="صفحة المخرج" />;
  const letters = lettersOfPoint(site, point.id);
  const diagram = site.resources.find((r) => r.id === point.diagram_resource_id);

  return (
    <article>
      <Breadcrumbs items={[{ href: "/academy/", label: "الأكاديمية" }, { href: "/academy/#points", label: "المخارج" }, { label: point.name }]} />
      <PageTitle title={point.name} subtitle={point.general_area}>
        <ProvenanceBadges origin={point.origin} verified={point.scientifically_verified} pageStart={point.source_page_start} />
      </PageTitle>
      {letters.length > 0 && (
        <Section title="الحروف الخارجة منه">
          <ul className="flex flex-wrap gap-2">
            {letters.map((l) => <li key={l.id}><Link href={letterHref(l)} className="tap grid h-14 w-14 place-items-center rounded-xl border border-line bg-white text-2xl font-bold hover:border-brand-500">{l.letter}</Link></li>)}
          </ul>
        </Section>
      )}
      {point.description_md && <Section title="الوصف"><Markdown source={point.description_md} riwayahCode={site.edition?.riwayah?.code} /></Section>}
      {diagram && <Section title="رسم توضيحي"><ul><ResourceItem r={diagram} /></ul></Section>}
    </article>
  );
}
