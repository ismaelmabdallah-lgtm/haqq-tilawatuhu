import { AcademyItem } from "@/components/learn/AcademyViews";
import { getSite, lightSite, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.letters.map((l) => ({ n: String(l.sort_order) })), ["n"]);
}

type Props = { params: Promise<{ n: string }> };

export async function generateMetadata({ params }: Props) {
  const { n } = await params;
  const l = (await getSite()).letters.find((x) => String(x.sort_order) === n);
  return l ? { title: `الحرف ${l.letter}` } : { title: "الحرف", robots: { index: false } };
}

export default async function LetterPage({ params }: Props) {
  const { n } = await params;
  return <AcademyItem initial={lightSite(await getSite())} type="letter" itemKey={n} />;
}
