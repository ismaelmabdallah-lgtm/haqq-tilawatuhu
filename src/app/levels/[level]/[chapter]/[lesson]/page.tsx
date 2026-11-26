import Link from "next/link";
import { ExamLinks } from "@/components/content/ExamLinks";
import { LessonProgressControls } from "@/components/content/LessonProgress";
import { Markdown } from "@/components/content/Markdown";
import { ResourceItem, YouTube } from "@/components/content/ResourceItem";
import { QuranVerse } from "@/components/quran/QuranVerse";
import { Breadcrumbs, NotFoundNotice, PageTitle, ProvenanceBadges, Section, pagesLabel } from "@/components/ui";
import { definitions, rules, tables } from "@/lib/content/lesson-json";
import {
  chapterHref, chaptersOf, examplesOfLesson, getSite, levelByCode, levelHref, lessonHref, lessonPath, lessonsOf,
  orPlaceholder, resourcesOfLesson, type Site,
} from "@/lib/content/site";
import { isYoutubeId } from "@/lib/files";
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

function find(site: Site, p: Params) {
  const level = levelByCode(site, p.level);
  const chapter = level ? chaptersOf(site, level.id).find((c) => c.code === p.chapter) : undefined;
  const lesson = chapter ? lessonsOf(site, chapter.id).find((l) => l.code === p.lesson) : undefined;
  return level && chapter && lesson ? { level, chapter, lesson } : null;
}

export async function generateMetadata({ params }: Props) {
  const f = find(await getSite(), await params);
  return f
    ? { title: f.lesson.title, description: f.lesson.description ?? `${f.chapter.title} — ${f.level.title}` }
    : { title: "غير موجود", robots: { index: false } };
}

export default async function LessonPage({ params }: Props) {
  const site = await getSite();
  const f = find(site, await params);
  if (!f) return <NotFoundNotice what="الدرس" />;
  const { level, chapter, lesson } = f;

  const riwayahCode = site.edition?.riwayah?.code;
  const editionLabel = lesson.source_edition_id === site.edition?.id ? site.edition?.label : null;
  const defs = definitions(lesson.definitions);
  const rls = rules(lesson.rules);
  const tbls = tables(lesson.tables);
  const examples = examplesOfLesson(site, lesson.id);
  const resources = resourcesOfLesson(site, lesson.id);
  const videos = lesson.youtube_ids.filter(isYoutubeId);
  const related = site.lessonRelations.filter((r) => r.lesson_id === lesson.id)
    .map((r) => lessonPath(site, r.related_lesson_id)).filter((p) => p !== null);
  const topics = site.topicLessons.filter((t) => t.lesson_id === lesson.id)
    .map((t) => site.topics.find((x) => x.id === t.topic_id)).filter((t) => t !== undefined);
  const exams = site.exams.filter((e) => e.lesson_id === lesson.id);
  const siblings = lessonsOf(site, chapter.id);
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 ? siblings[idx + 1] : undefined;
  const pageRef = (p?: number) => (p ? <span className="text-xs text-muted"> ({pagesLabel(p)})</span> : null);

  return (
    <article data-lesson={lesson.code}>
      <Breadcrumbs items={[
        { href: "/levels/", label: "المستويات" }, { href: levelHref(level), label: level.title },
        { href: chapterHref(level, chapter), label: chapter.title }, { label: lesson.title },
      ]} />
      <PageTitle title={lesson.title} subtitle={lesson.description}>
        <ProvenanceBadges origin={lesson.origin} verified={lesson.scientifically_verified}
          pageStart={lesson.source_page_start} pageEnd={lesson.source_page_end} editionLabel={editionLabel} />
      </PageTitle>

      {lesson.objectives.length > 0 && (
        <Section title="أهداف الدرس">
          <ul className="list-disc space-y-1 ps-6">{lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </Section>
      )}

      {lesson.body_md && <Section title="الشرح"><Markdown source={lesson.body_md} riwayahCode={riwayahCode} /></Section>}

      {defs.length > 0 && (
        <Section title="التعريفات">
          <dl className="space-y-3">
            {defs.map((d, i) => (
              <div key={i} className="rounded-xl border border-line bg-white p-4">
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
              <li key={i} className="rounded-xl border-s-4 border-gold-500 bg-white p-4">
                <p className="font-bold">{r.title}{pageRef(r.source_page)}</p>
                <div className="mt-1"><Markdown source={r.body} riwayahCode={riwayahCode} /></div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {tbls.map((t, i) => (
        <Section key={i} title={t.caption ?? "جدول"}>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
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
            <QuranVerse key={example.id} quranRef={fromExample(example)}
              riwayahCode={site.riwayat.find((r) => r.id === example.riwayah_id)?.code ?? riwayahCode}
              note={[link.rule_note, example.note, pagesLabel(example.source_page_start, example.source_page_end)].filter(Boolean).join(" · ") || null} />
          ))}
        </Section>
      )}

      {videos.length > 0 && (
        <Section title="شرح مرئي">{videos.map((id) => <YouTube key={id} id={id} title={lesson.title} />)}</Section>
      )}

      {resources.length > 0 && (
        <Section title="ملفات ومواد الدرس"><ul className="space-y-3">{resources.map((r) => <ResourceItem key={r.id} r={r} />)}</ul></Section>
      )}

      {exams.length > 0 && <Section title="تدرّب واختبر نفسك"><ExamLinks exams={exams} /></Section>}

      {(related.length > 0 || topics.length > 0) && (
        <Section title="ذو صلة">
          <ul className="flex flex-wrap gap-2">
            {related.map((p) => <li key={p.lesson.id}><Link href={lessonHref(p)} className="tap inline-flex items-center rounded-full bg-brand-50 px-3 text-sm text-brand-700">{p.lesson.title}</Link></li>)}
            {topics.map((t) => <li key={t.id}><Link href={`/encyclopedia/${t.slug}/`} className="tap inline-flex items-center rounded-full bg-gold-100 px-3 text-sm text-gold-700">الموسوعة: {t.title}</Link></li>)}
          </ul>
        </Section>
      )}

      <LessonProgressControls lessonId={lesson.id} />

      <nav aria-label="التنقل بين الدروس" className="mt-6 flex justify-between gap-3 text-sm">
        {prev ? <Link href={`/levels/${level.code}/${chapter.code}/${prev.code}/`} className="tap inline-flex items-center rounded-lg border border-line bg-white px-3">→ {prev.title}</Link> : <span />}
        {next ? <Link href={`/levels/${level.code}/${chapter.code}/${next.code}/`} className="tap inline-flex items-center rounded-lg border border-line bg-white px-3">{next.title} ←</Link> : <span />}
      </nav>
    </article>
  );
}
