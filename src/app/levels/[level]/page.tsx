import { ExamLinks } from "@/components/content/ExamLinks";
import { Breadcrumbs, EmptyState, NotFoundNotice, PageTitle, Section, UNDER_REVIEW_NOTE, pagesLabel } from "@/components/ui";
import { chapterHref, chaptersOf, getSite, levelByCode, lessonsOf, orPlaceholder } from "@/lib/content/site";
import { arDigits } from "@/lib/quran/ref";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.levels.map((l) => ({ level: l.code })), ["level"]);
}

type Props = { params: Promise<{ level: string }> };

export async function generateMetadata({ params }: Props) {
  const level = levelByCode(await getSite(), (await params).level);
  return { title: level?.title ?? "غير موجود", robots: level ? undefined : { index: false } };
}

export default async function LevelPage({ params }: Props) {
  const site = await getSite();
  const level = levelByCode(site, (await params).level);
  if (!level) return <NotFoundNotice what="المستوى" />;
  const chapters = chaptersOf(site, level.id);
  const exams = site.exams.filter((e) => e.level_id === level.id && !e.chapter_id && !e.lesson_id);

  return (
    <>
      <Breadcrumbs items={[{ href: "/levels/", label: "المستويات" }, { label: level.title }]} />
      <PageTitle title={`${level.title}${level.subtitle ? ` (${level.subtitle})` : ""}`} subtitle={pagesLabel(level.source_page_start, level.source_page_end)}>
        {level.description && <p className="whitespace-pre-line">{level.description}</p>}
      </PageTitle>

      {chapters.length === 0 ? <EmptyState title="لا توجد أبواب منشورة">{UNDER_REVIEW_NOTE}</EmptyState> : (
        <ol className="space-y-3">
          {chapters.map((c) => {
            const lessons = lessonsOf(site, c.id);
            return (
              <li key={c.id}>
                <a href={chapterHref(level, c)} className="tap block rounded-xl border border-line bg-white p-4 hover:border-brand-500">
                  <span className="text-sm text-gold-700">{c.label}</span>
                  <span className="block text-lg font-bold text-brand-900">{c.title}</span>
                  <span className="text-xs text-muted">
                    {pagesLabel(c.source_page_start, c.source_page_end)} · {lessons.length ? `${arDigits(lessons.length)} درس منشور` : "الدروس قيد المراجعة العلمية"}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}

      {exams.length > 0 && <Section title="اختبارات المستوى"><ExamLinks exams={exams} /></Section>}
    </>
  );
}
