"use client";
import Link from "next/link";
import { ExamLinks } from "@/components/content/ExamLinks";
import { LessonProgressControls, LessonProgressDot } from "@/components/content/LessonProgress";
import { MarkdownClient } from "@/components/content/MarkdownClient";
import { ResourceItem, YouTube } from "@/components/content/ResourceItem";
import { QuranVerseClient } from "@/components/quran/QuranVerseClient";
import { Breadcrumbs, EmptyState, NotFoundNotice, PageTitle, ProvenanceBadges, Section, UNDER_REVIEW_NOTE, pagesLabel } from "@/components/ui";
import { definitions, rules, tables } from "@/lib/content/lesson-json";
import { useFullLesson, useLiveSite } from "@/lib/content/live";
import {
  builtFrom, chapterLink, chaptersOf, examplesOfLesson, examsOfLevel, findLesson, lessonLink, lessonPath, lessonsOf, lessonsOfLevel,
  levelByCode, levelLink, resourcesOfLesson, resourcesOfLevel, type Lesson, type Site,
} from "@/lib/content/model";
import { isYoutubeId } from "@/lib/files";
import { arDigits, fromExample } from "@/lib/quran/ref";

// ---------------------------------------------------------------------------
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="جارٍ التحميل" data-skeleton>
      <div className="skeleton h-8 w-2/3" />
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-20" />)}
    </div>
  );
}

function Offline() {
  return <EmptyState title="تعذر الاتصال بالخادم">تحقق من اتصالك وأعد تحميل الصفحة.</EmptyState>;
}

/** Shared loading logic: pre-rendered snapshot first, live snapshot when ready. */
function useView(initial: Site | null) {
  const { site, live, failed } = useLiveSite(initial);
  return { site, live, failed, built: builtFrom(initial) };
}

// ---------------------------------------------------------------------------
export function LevelsOverview({ initial }: { initial: Site | null }) {
  const { site, failed, built } = useView(initial);
  if (!site) return failed ? <Offline /> : <ListSkeleton />;
  const ed = site.edition;
  return (
    <>
      <Breadcrumbs items={[{ label: "المستويات" }]} />
      <PageTitle title="المستويات الأربعة" subtitle={ed ? `${ed.curriculum.title} — ${ed.label}` : null}>
        {ed?.riwayah && <p className="text-sm text-muted">الرواية: {ed.riwayah.name_ar}{ed.riwayah.tariq ? ` من طريق ${ed.riwayah.tariq}` : ""}</p>}
        {ed?.curriculum.affiliation_note && <p className="mt-2 rounded-lg bg-gold-100 px-3 py-2 text-sm text-gold-700">{ed.curriculum.affiliation_note}</p>}
      </PageTitle>
      {site.levels.length === 0 ? <EmptyState title="لم يُنشر المنهج بعد">{UNDER_REVIEW_NOTE}</EmptyState> : (
        <ol className="grid gap-4 sm:grid-cols-2" data-levels>
          {site.levels.map((l) => {
            const lessons = lessonsOfLevel(site, l.id).length;
            const files = resourcesOfLevel(site, l.id).length;
            const exams = examsOfLevel(site, l.id).length;
            return (
              <li key={l.id}>
                <Link href={levelLink(built, l)} className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow" data-level-card={l.code}>
                  <span className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-700 text-xl font-bold text-white">{arDigits(l.sort_order)}</span>
                    <span>
                      <span className="block text-lg font-bold text-brand-900">{l.title}</span>
                      {l.subtitle && <span className="text-sm text-gold-700">{l.subtitle}</span>}
                    </span>
                  </span>
                  <span className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-muted">
                    <Stat n={lessons} label="درس" /><Stat n={files} label="ملف" /><Stat n={exams} label="اختبار" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
const Stat = ({ n, label }: { n: number; label: string }) => (
  <span className="rounded-xl bg-paper py-2"><b className="block text-base text-ink">{arDigits(n)}</b>{label}</span>
);

// ---------------------------------------------------------------------------
export function LevelHub({ initial, code }: { initial: Site | null; code: string }) {
  const { site, live, failed, built } = useView(initial);
  if (!site) return failed ? <Offline /> : <ListSkeleton />;
  const level = levelByCode(site, code);
  if (!level) return live || failed || initial ? <NotFoundNotice what="المستوى" /> : <ListSkeleton />;
  const chapters = chaptersOf(site, level.id);
  const files = resourcesOfLevel(site, level.id);
  const exams = examsOfLevel(site, level.id);
  const lessonCount = lessonsOfLevel(site, level.id).length;

  return (
    <div data-level-hub={level.code}>
      <Breadcrumbs items={[{ href: "/levels/", label: "المستويات" }, { label: level.title }]} />
      <header className="mb-6 rounded-2xl bg-brand-700 p-5 text-white">
        <p className="text-sm text-brand-100">{level.subtitle ?? `المستوى ${arDigits(level.sort_order)}`}{pagesLabel(level.source_page_start, level.source_page_end) ? ` · ${pagesLabel(level.source_page_start, level.source_page_end)}` : ""}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{level.title}</h1>
        {level.description && <p className="mt-2 whitespace-pre-line text-brand-100">{level.description}</p>}
        <p className="mt-3 text-sm text-brand-100">{arDigits(lessonCount)} درسًا · {arDigits(files.length)} ملفًا · {arDigits(exams.length)} اختبارًا</p>
      </header>

      <Section title="الملفات والملخصات" id="files">
        {files.length ? <ul className="grid gap-3 sm:grid-cols-2">{files.map((r) => <ResourceItem key={r.id} r={r} compact />)}</ul>
          : <p className="text-sm text-muted">ستُضاف ملخصات المستوى ونماذج الاختبارات قريبًا.</p>}
      </Section>

      <Section title="الدروس" id="lessons">
        {chapters.length === 0 ? <EmptyState title="لا توجد أبواب منشورة">{UNDER_REVIEW_NOTE}</EmptyState> : (
          <ol className="space-y-4">
            {chapters.map((c) => {
              const lessons = lessonsOf(site, c.id);
              return (
                <li key={c.id} className="rounded-2xl border border-line bg-white p-4">
                  <Link href={chapterLink(built, level, c)} className="block">
                    <span className="text-sm text-gold-700">{c.label}</span>
                    <span className="block text-lg font-bold text-brand-900">{c.title}</span>
                  </Link>
                  {lessons.length ? (
                    <ul className="mt-3 space-y-2">
                      {lessons.map((l) => {
                        const p = { level, chapter: c, lesson: l };
                        return (
                          <li key={l.id}>
                            <Link href={lessonLink(built, p)} className="tap flex items-center gap-2 rounded-xl bg-paper px-3 hover:bg-brand-50" data-lesson-link={l.code}>
                              <LessonProgressDot lessonId={l.id} /><span className="flex-1">{l.title}</span>
                              <span className="shrink-0 text-xs text-muted">{pagesLabel(l.source_page_start, l.source_page_end)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="mt-2 text-sm text-muted">دروس هذا الباب قيد الإعداد والمراجعة.</p>}
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="اختبارات المستوى" id="exams">
        {exams.length ? <ExamLinks exams={exams} /> : <p className="text-sm text-muted">لا توجد اختبارات منشورة لهذا المستوى بعد.</p>}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ChapterView({ initial, levelCode, chapterCode }: { initial: Site | null; levelCode: string; chapterCode: string }) {
  const { site, live, failed, built } = useView(initial);
  if (!site) return failed ? <Offline /> : <ListSkeleton />;
  const level = levelByCode(site, levelCode);
  const chapter = level ? chaptersOf(site, level.id).find((c) => c.code === chapterCode) : undefined;
  if (!level || !chapter) return live || failed || initial ? <NotFoundNotice what="الباب" /> : <ListSkeleton />;
  const lessons = lessonsOf(site, chapter.id);
  const exams = site.exams.filter((e) => e.chapter_id === chapter.id && !e.lesson_id);
  const ids = new Set(lessons.map((l) => l.id));
  const top = lessons.filter((l) => !l.parent_lesson_id || !ids.has(l.parent_lesson_id));
  const item = (l: Lesson, depth: number): React.ReactNode => (
    <li key={l.id}>
      <Link href={lessonLink(built, { level, chapter, lesson: l })} className={`tap flex items-center gap-2 rounded-xl border border-line bg-white px-3 hover:border-brand-500 ${depth ? "ms-5" : ""}`}>
        <LessonProgressDot lessonId={l.id} /><span className="flex-1">{l.title}</span>
        <span className="shrink-0 text-xs text-muted">{pagesLabel(l.source_page_start, l.source_page_end)}</span>
      </Link>
      {lessons.some((c) => c.parent_lesson_id === l.id) && <ul className="mt-2 space-y-2">{lessons.filter((c) => c.parent_lesson_id === l.id).map((c) => item(c, depth + 1))}</ul>}
    </li>
  );
  return (
    <>
      <Breadcrumbs items={[{ href: "/levels/", label: "المستويات" }, { href: levelLink(built, level), label: level.title }, { label: chapter.title }]} />
      <PageTitle title={chapter.title} subtitle={[chapter.label, pagesLabel(chapter.source_page_start, chapter.source_page_end)].filter(Boolean).join(" · ")} />
      {lessons.length === 0 ? <EmptyState title="لا توجد دروس منشورة في هذا الباب بعد">{UNDER_REVIEW_NOTE}</EmptyState>
        : <ul className="space-y-2">{top.map((l) => item(l, 0))}</ul>}
      {exams.length > 0 && <Section title="اختبارات الباب"><ExamLinks exams={exams} /></Section>}
    </>
  );
}

// ---------------------------------------------------------------------------
export function LessonView({ initial, levelCode, chapterCode, lessonCode, prerendered }: {
  initial: Site | null; levelCode: string; chapterCode: string; lessonCode: string; prerendered: Lesson | null;
}) {
  const { site, live, failed, built } = useView(initial);
  const path = site ? findLesson(site, levelCode, chapterCode, lessonCode) : null;
  const lesson = useFullLesson(path?.lesson ?? null, prerendered);
  if (!site) return failed ? <Offline /> : <ListSkeleton />;
  if (!path) return live || failed || initial ? <NotFoundNotice what="الدرس" /> : <ListSkeleton />;
  if (!lesson) return <ListSkeleton rows={3} />;
  const { level, chapter } = path;

  const riwayahCode = site.edition?.riwayah?.code;
  const editionLabel = lesson.source_edition_id === site.edition?.id ? site.edition?.label : null;
  const defs = definitions(lesson.definitions);
  const rls = rules(lesson.rules);
  const tbls = tables(lesson.tables);
  const examples = examplesOfLesson(site, lesson.id);
  const resources = resourcesOfLesson(site, lesson.id);
  const media = resources.filter((r) => r.kind === "image" || r.kind === "diagram" || r.kind === "audio");
  const files = resources.filter((r) => !media.includes(r));
  const videos = lesson.youtube_ids.filter(isYoutubeId);
  const related = site.lessonRelations.filter((r) => r.lesson_id === lesson.id).map((r) => lessonPath(site, r.related_lesson_id)).filter((p) => p !== null);
  const topics = site.topicLessons.filter((t) => t.lesson_id === lesson.id).map((t) => site.topics.find((x) => x.id === t.topic_id)).filter((t) => t !== undefined);
  const exams = site.exams.filter((e) => e.lesson_id === lesson.id);
  const siblings = lessonsOf(site, chapter.id);
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 ? siblings[idx + 1] : undefined;
  const pageRef = (p?: number) => (p ? <span className="text-xs text-muted"> ({pagesLabel(p)})</span> : null);

  return (
    <article data-lesson={lesson.code}>
      <Breadcrumbs items={[{ href: "/levels/", label: "المستويات" }, { href: levelLink(built, level), label: level.title }, { href: chapterLink(built, level, chapter), label: chapter.title }, { label: lesson.title }]} />
      <PageTitle title={lesson.title} subtitle={lesson.description}>
        <ProvenanceBadges origin={lesson.origin} verified={lesson.scientifically_verified} pageStart={lesson.source_page_start} pageEnd={lesson.source_page_end} editionLabel={editionLabel} />
      </PageTitle>

      {lesson.objectives.length > 0 && (
        <Section title="أهداف الدرس"><ul className="list-disc space-y-1 ps-6">{lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></Section>
      )}
      {lesson.body_md && <Section title="الشرح"><MarkdownClient source={lesson.body_md} riwayahCode={riwayahCode} /></Section>}
      {media.length > 0 && <Section title="صور ومقاطع صوتية"><ul className="space-y-3">{media.map((r) => <ResourceItem key={r.id} r={r} />)}</ul></Section>}

      {defs.length > 0 && (
        <Section title="التعريفات">
          <dl className="space-y-3">
            {defs.map((d, i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-4">
                <dt className="font-bold text-brand-900">{d.term}{pageRef(d.source_page)}</dt>
                <dd className="mt-1 whitespace-pre-line">{d.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {rls.length > 0 && (
        <Section title="الأحكام والقواعد">
          <ol className="space-y-3">
            {rls.map((r, i) => (
              <li key={i} className="rounded-2xl border-s-4 border-gold-500 bg-white p-4">
                <p className="font-bold">{r.title}{pageRef(r.source_page)}</p>
                <MarkdownClient source={r.body} riwayahCode={riwayahCode} />
              </li>
            ))}
          </ol>
        </Section>
      )}
      {tbls.map((t, i) => (
        <Section key={i} title={t.caption ?? "جدول"}>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead className="bg-brand-50"><tr>{t.columns.map((c, j) => <th key={j} scope="col" className="border-b border-line px-3 py-2 text-start">{c}</th>)}</tr></thead>
              <tbody>{t.rows.map((r, j) => <tr key={j} className="even:bg-paper">{r.map((c, k) => <td key={k} className="border-b border-line px-3 py-2">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {t.source_page && <p className="mt-1 text-xs text-muted">{pagesLabel(t.source_page)}</p>}
        </Section>
      ))}
      {examples.length > 0 && (
        <Section title="أمثلة قرآنية">
          {examples.map(({ link, example }) => (
            <QuranVerseClient key={example.id} quranRef={fromExample(example)}
              riwayahCode={site.riwayat.find((r) => r.id === example.riwayah_id)?.code ?? riwayahCode}
              note={[link.rule_note, example.note, pagesLabel(example.source_page_start, example.source_page_end)].filter(Boolean).join(" · ") || null} />
          ))}
        </Section>
      )}
      {videos.length > 0 && <Section title="شرح مرئي">{videos.map((id) => <YouTube key={id} id={id} title={lesson.title} />)}</Section>}
      {files.length > 0 && <Section title="ملفات الدرس"><ul className="space-y-3">{files.map((r) => <ResourceItem key={r.id} r={r} />)}</ul></Section>}
      {exams.length > 0 && <Section title="تدرّب واختبر نفسك"><ExamLinks exams={exams} /></Section>}
      {(related.length > 0 || topics.length > 0) && (
        <Section title="ذو صلة">
          <ul className="flex flex-wrap gap-2">
            {related.map((p) => <li key={p.lesson.id}><Link href={lessonLink(built, p)} className="tap inline-flex items-center rounded-full bg-brand-50 px-4 text-sm text-brand-700">{p.lesson.title}</Link></li>)}
            {topics.map((t) => <li key={t.id}><Link href={`/encyclopedia/${t.slug}/`} className="tap inline-flex items-center rounded-full bg-gold-100 px-4 text-sm text-gold-700">الموسوعة: {t.title}</Link></li>)}
          </ul>
        </Section>
      )}

      <LessonProgressControls lessonId={lesson.id} />
      <nav aria-label="التنقل بين الدروس" className="mt-6 grid grid-cols-2 gap-3 text-sm">
        {prev ? <Link href={lessonLink(built, { level, chapter, lesson: prev })} className="tap flex items-center rounded-xl border border-line bg-white px-3">→ {prev.title}</Link> : <span />}
        {next ? <Link href={lessonLink(built, { level, chapter, lesson: next })} className="tap flex items-center justify-end rounded-xl border border-line bg-white px-3 text-end">{next.title} ←</Link> : <span />}
      </nav>
    </article>
  );
}
