import { LevelHub } from "@/components/learn/LearnViews";
import { getSite, levelByCode, lightSite, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.levels.map((l) => ({ level: l.code })), ["level"]);
}

type Props = { params: Promise<{ level: string }> };

export async function generateMetadata({ params }: Props) {
  const level = levelByCode(await getSite(), (await params).level);
  return { title: level?.title ?? "المستوى", robots: level ? undefined : { index: false } };
}

/** The level hub: files, lessons and exams of one level (live-refreshed). */
export default async function LevelPage({ params }: Props) {
  const { level } = await params;
  return <LevelHub initial={lightSite(await getSite())} code={level} />;
}
