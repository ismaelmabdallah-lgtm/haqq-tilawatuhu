import { AcademyItem } from "@/components/learn/AcademyViews";
import { getSite, lightSite, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.characteristics.map((c) => ({ code: c.code })), ["code"]);
}

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const c = (await getSite()).characteristics.find((x) => x.code === code);
  return c ? { title: `صفة ${c.name}` } : { title: "الصفة", robots: { index: false } };
}

export default async function CharacteristicPage({ params }: Props) {
  const { code } = await params;
  return <AcademyItem initial={lightSite(await getSite())} type="characteristic" itemKey={code} />;
}
