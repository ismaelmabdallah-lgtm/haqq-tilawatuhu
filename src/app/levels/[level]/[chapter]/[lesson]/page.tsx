import { LessonView } from "@/components/learn/LearnViews";
import { QuranPreloadProvider } from "@/components/quran/QuranPreloadProvider";
import { examplesOfLesson, findLesson, getSite, lessonPath, lightSite, orPlaceholder } from "@/lib/content/site";
import { definitions, rules } from "@/lib/content/lesson-json";
import { preloadQuran, refsInMarkdown } from "@/lib/quran/preload";
import { fromExample } from "@/lib/quran/ref";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  const params = site.lessons.flatMap((l) => {
    const p = lessonPath(site, l.id);
    return p ? [{ level: p.level.code, chapter: p.chapter.code, lesson: p.lesson.code }] : [];
  });
  return orPlaceholder(params, ["level", "chapter", "lesson"]);
}

type Params = { level: string; chapter: string; lesson: string };
type Props = { params: Promise<Params> };

export async function generateMetadata({ params }: Props) {
  const p = await params;
  const f = findLesson(await getSite(), p.level, p.chapter, p.lesson);
  return f ? { title: f.lesson.title, description: f.lesson.description ?? `${f.chapter.title} — ${f.level.title}` } : { title: "الدرس", robots: { index: false } };
}

/** Pre-rendered lesson (full text + verses resolved at build) that refreshes live. */
export default async function LessonPage({ params }: Props) {
  const p = await params;
  const site = await getSite();
  const f = findLesson(site, p.level, p.chapter, p.lesson);
  const riwayahCode = site.edition?.riwayah?.code;
  const quran = f ? preloadQuran([
    ...refsInMarkdown(f.lesson.body_md, ...rules(f.lesson.rules).map((r) => r.body), ...definitions(f.lesson.definitions).map((d) => d.definition))
      .map((ref) => ({ ref, riwayahCode })),
    ...examplesOfLesson(site, f.lesson.id).map(({ example }) => ({ ref: fromExample(example), riwayahCode: site.riwayat.find((r) => r.id === example.riwayah_id)?.code ?? riwayahCode })),
  ]) : {};
  return (
    <QuranPreloadProvider value={quran}>
      <LessonView initial={lightSite(site)} levelCode={p.level} chapterCode={p.chapter} lessonCode={p.lesson} prerendered={f?.lesson ?? null} />
    </QuranPreloadProvider>
  );
}
