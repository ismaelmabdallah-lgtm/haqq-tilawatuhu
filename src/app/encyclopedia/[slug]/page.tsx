import Link from "next/link";
import { Markdown } from "@/components/content/Markdown";
import { Breadcrumbs, NotFoundNotice, PageTitle, ProvenanceBadges, Section, pagesLabel } from "@/components/ui";
import { rules } from "@/lib/content/lesson-json";
import { getSite, lessonHref, lessonPath, orPlaceholder } from "@/lib/content/site";

export const dynamicParams = false;
export async function generateStaticParams() {
  const site = await getSite();
  return orPlaceholder(site.topics.map((t) => ({ slug: t.slug })), ["slug"]);
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = (await getSite()).topics.find((x) => x.slug === slug);
  return t ? { title: t.title, description: t.definition ?? undefined } : { title: "غير موجود", robots: { index: false } };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const site = await getSite();
  const topic = site.topics.find((t) => t.slug === slug);
  if (!topic) return <NotFoundNotice what="المدخل" />;
  const riwayahCode = site.riwayat.find((r) => r.id === topic.riwayah_id)?.code ?? site.edition?.riwayah?.code;
  const lessons = site.topicLessons.filter((tl) => tl.topic_id === topic.id).map((tl) => lessonPath(site, tl.lesson_id)).filter((p) => p !== null);
  const topicRules = rules(topic.rules);

  return (
    <article>
      <Breadcrumbs items={[{ href: "/encyclopedia/", label: "الموسوعة" }, { label: topic.title }]} />
      <PageTitle title={topic.title}>
        <ProvenanceBadges origin={topic.origin} verified={topic.scientifically_verified} pageStart={topic.source_page_start} pageEnd={topic.source_page_end} />
      </PageTitle>
      {topic.definition && (
        <p className="rounded-xl border-s-4 border-brand-500 bg-white p-4 text-lg"><span className="font-bold">التعريف: </span>{topic.definition}</p>
      )}
      {topic.explanation_md && <Section title="الشرح"><Markdown source={topic.explanation_md} riwayahCode={riwayahCode} /></Section>}
      {topicRules.length > 0 && (
        <Section title="الأحكام">
          <ol className="space-y-3">
            {topicRules.map((r, i) => (
              <li key={i} className="rounded-xl border border-line bg-white p-4">
                <p className="font-bold">{r.title}{r.source_page ? <span className="text-xs text-muted"> ({pagesLabel(r.source_page)})</span> : null}</p>
                <Markdown source={r.body} riwayahCode={riwayahCode} />
              </li>
            ))}
          </ol>
        </Section>
      )}
      {lessons.length > 0 && (
        <Section title="دروس ذات صلة">
          <ul className="space-y-2">
            {lessons.map((p) => (
              <li key={p.lesson.id}><Link href={lessonHref(p)} className="tap flex items-center rounded-lg border border-line bg-white px-3 hover:border-brand-500">{p.lesson.title} <span className="ms-2 text-xs text-muted">— {p.level.title}</span></Link></li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
