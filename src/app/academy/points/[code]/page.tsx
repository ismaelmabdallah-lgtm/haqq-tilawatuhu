import { AcademyItem } from "@/components/learn/AcademyViews";
import { getSite, lightSite, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.points.map((p) => ({ code: p.code })), ["code"]);
}

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const p = (await getSite()).points.find((x) => x.code === code);
  return p ? { title: `مخرج ${p.name}` } : { title: "المخرج", robots: { index: false } };
}

export default async function PointPage({ params }: Props) {
  const { code } = await params;
  return <AcademyItem initial={lightSite(await getSite())} type="point" itemKey={code} />;
}
