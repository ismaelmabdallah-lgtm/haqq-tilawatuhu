import Link from "next/link";
import { Markdown } from "@/components/content/Markdown";
import { Breadcrumbs, NotFoundNotice, PageTitle, ProvenanceBadges, Section } from "@/components/ui";
import { characteristicHref, letterHref, lettersWithCharacteristic } from "@/lib/content/academy";
import { getSite, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.characteristics.map((c) => ({ code: c.code })), ["code"]);
}

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const c = (await getSite()).characteristics.find((x) => x.code === code);
  return c ? { title: `صفة ${c.name}` } : { title: "غير موجود", robots: { index: false } };
}

export default async function CharacteristicPage({ params }: Props) {
  const { code } = await params;
  const site = await getSite();
  const c = site.characteristics.find((x) => x.code === code);
  if (!c) return <NotFoundNotice what="صفحة الصفة" />;
  const opposite = c.opposite_id ? site.characteristics.find((x) => x.id === c.opposite_id)
    : site.characteristics.find((x) => x.opposite_id === c.id);
  const letters = lettersWithCharacteristic(site, c.id);

  return (
    <article>
      <Breadcrumbs items={[{ href: "/academy/", label: "الأكاديمية" }, { href: "/academy/#characteristics", label: "الصفات" }, { label: c.name }]} />
      <PageTitle title={`صفة ${c.name}`} subtitle={c.has_opposite ? "من الصفات التي لها ضد" : "من الصفات التي لا ضد لها"}>
        <ProvenanceBadges origin={c.origin} verified={c.scientifically_verified} pageStart={c.source_page_start} />
      </PageTitle>
      {opposite && <p>ضدها: <Link href={characteristicHref(opposite.code)} className="font-bold text-brand-700 underline">{opposite.name}</Link></p>}
      {c.description_md && <Section title="الوصف"><Markdown source={c.description_md} riwayahCode={site.edition?.riwayah?.code} /></Section>}
      {letters.length > 0 && (
        <Section title="حروفها">
          <ul className="flex flex-wrap gap-2">
            {letters.map((l) => <li key={l.id}><Link href={letterHref(l)} className="tap grid h-14 w-14 place-items-center rounded-xl border border-line bg-white text-2xl font-bold hover:border-brand-500">{l.letter}</Link></li>)}
          </ul>
        </Section>
      )}
    </article>
  );
}
