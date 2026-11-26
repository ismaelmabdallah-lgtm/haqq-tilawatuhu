import { ExamLinks } from "@/components/content/ExamLinks";
import { LessonList } from "@/components/content/LessonList";
import { Breadcrumbs, EmptyState, NotFoundNotice, PageTitle, Section, UNDER_REVIEW_NOTE, pagesLabel } from "@/components/ui";
import { chaptersOf, getSite, levelByCode, levelHref, lessonsOf, orPlaceholder, type Site } from "@/lib/content/site";

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

function find(site: Site, p: { level: string; chapter: string }) {
  const level = levelByCode(site, p.level);
  const chapter = level ? chaptersOf(site, level.id).find((c) => c.code === p.chapter) : undefined;
  return level && chapter ? { level, chapter } : null;
}

export async function generateMetadata({ params }: Props) {
  const f = find(await getSite(), await params);
  return { title: f ? `${f.chapter.title} — ${f.level.title}` : "غير موجود", robots: f ? undefined : { index: false } };
}

export default async function ChapterPage({ params }: Props) {
  const site = await getSite();
  const f = find(site, await params);
  if (!f) return <NotFoundNotice what="الباب" />;
  const { level, chapter } = f;
  const lessons = lessonsOf(site, chapter.id);
  const exams = site.exams.filter((e) => e.chapter_id === chapter.id && !e.lesson_id);

  return (
    <>
      <Breadcrumbs items={[{ href: "/levels/", label: "المستويات" }, { href: levelHref(level), label: level.title }, { label: chapter.title }]} />
      <PageTitle title={chapter.title} subtitle={[chapter.label, pagesLabel(chapter.source_page_start, chapter.source_page_end)].filter(Boolean).join(" · ")} />
      {lessons.length === 0
        ? <EmptyState title="لا توجد دروس منشورة في هذا الباب بعد">{UNDER_REVIEW_NOTE}</EmptyState>
        : <LessonList lessons={lessons} hrefOf={(l) => `/levels/${level.code}/${chapter.code}/${l.code}/`} />}
      {exams.length > 0 && <Section title="اختبارات الباب"><ExamLinks exams={exams} /></Section>}
    </>
  );
}
