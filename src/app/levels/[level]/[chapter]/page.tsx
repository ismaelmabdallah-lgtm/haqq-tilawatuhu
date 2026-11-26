import { ChapterView } from "@/components/learn/LearnViews";
import { chaptersOf, getSite, levelByCode, lightSite, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  const params = site.chapters.flatMap((c) => {
    const level = site.levels.find((l) => l.id === c.level_id);
    return level ? [{ level: level.code, chapter: c.code }] : [];
  });
  return orPlaceholder(params, ["level", "chapter"]);
}

type Props = { params: Promise<{ level: string; chapter: string }> };

export async function generateMetadata({ params }: Props) {
  const p = await params;
  const site = await getSite();
  const level = levelByCode(site, p.level);
  const chapter = level ? chaptersOf(site, level.id).find((c) => c.code === p.chapter) : undefined;
  return { title: chapter && level ? `${chapter.title} — ${level.title}` : "الباب", robots: chapter ? undefined : { index: false } };
}

export default async function ChapterPage({ params }: Props) {
  const p = await params;
  return <ChapterView initial={lightSite(await getSite())} levelCode={p.level} chapterCode={p.chapter} />;
}
