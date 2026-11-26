"use client";
import Link from "next/link";
import { AnnouncementList } from "@/components/content/AnnouncementList";
import { ResourceItem } from "@/components/content/ResourceItem";
import { ListSkeleton } from "@/components/learn/LearnViews";
import { Breadcrumbs, EmptyState, PageTitle, Section, UNDER_REVIEW_NOTE } from "@/components/ui";
import { useLiveSite } from "@/lib/content/live";
import { builtFrom, examsOfLevel, lessonsOfLevel, levelLink, liveAnnouncements, resourcesOfLevel, type Site } from "@/lib/content/model";
import { KIND_LABEL } from "@/lib/files";
import { arDigits } from "@/lib/quran/ref";
import type { Database } from "@/lib/database.types";

const ORDER: Database["public"]["Enums"]["resource_kind"][] = ["pdf", "audio", "video", "document", "diagram", "image", "link"];
const GROUP_TITLE: Record<string, string> = { pdf: "ملفات PDF", audio: "مقاطع صوتية", video: "مقاطع مرئية", document: "مستندات", diagram: "رسوم توضيحية", image: "صور", link: "روابط" };

export function ResourcesView({ initial }: { initial: Site | null }) {
  const { site, failed } = useLiveSite(initial);
  if (!site) return failed ? <EmptyState title="تعذر الاتصال بالخادم" /> : <ListSkeleton />;
  return (
    <div data-resources>
      <Breadcrumbs items={[{ label: "المواد والملخصات" }]} />
      <PageTitle title="المواد والملخصات" subtitle="ملخصات ونماذج اختبارات ومقاطع صوتية ومرئية مراجَعة علميًا. التحميل مجاني ودون تسجيل." />
      {site.resources.length === 0 ? <EmptyState title="لا توجد مواد منشورة بعد">{UNDER_REVIEW_NOTE}</EmptyState> : ORDER.map((kind) => {
        const items = site.resources.filter((r) => r.kind === kind);
        return items.length ? (
          <Section key={kind} title={GROUP_TITLE[kind] ?? KIND_LABEL[kind]} id={kind}>
            <ul className="grid gap-3 sm:grid-cols-2">{items.map((r) => <ResourceItem key={r.id} r={r} compact />)}</ul>
          </Section>
        ) : null;
      })}
    </div>
  );
}

export function AnnouncementsView({ initial }: { initial: Site | null }) {
  const { site, failed } = useLiveSite(initial);
  return (
    <div data-announcements>
      <Breadcrumbs items={[{ label: "الإعلانات" }]} />
      <PageTitle title="الإعلانات" />
      {site ? <AnnouncementList items={site.announcements} resources={site.resources} /> : failed ? <EmptyState title="تعذر الاتصال بالخادم" /> : <ListSkeleton rows={3} />}
    </div>
  );
}

/** Home page sections that should reflect newly published content without a rebuild. */
export function HomeLive({ initial }: { initial: Site | null }) {
  const { site } = useLiveSite(initial);
  const built = builtFrom(initial);
  if (!site) return <ListSkeleton rows={2} />;
  const news = liveAnnouncements(site).slice(0, 3);
  return (
    <>
      <Section title="ابدأ من مستواك" id="levels">
        {site.levels.length === 0 ? <EmptyState title="لم يُنشر المنهج بعد">{UNDER_REVIEW_NOTE}</EmptyState> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {site.levels.map((l) => (
              <Link key={l.id} href={levelLink(built, l)} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm hover:border-brand-500">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl font-bold text-brand-700">{arDigits(l.sort_order)}</span>
                <span className="min-w-0">
                  <span className="block text-lg font-bold text-brand-900">{l.title}</span>
                  <span className="text-sm text-muted">
                    {arDigits(lessonsOfLevel(site, l.id).length)} درس · {arDigits(resourcesOfLevel(site, l.id).length)} ملف · {arDigits(examsOfLevel(site, l.id).length)} اختبار
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>
      {news.length > 0 && (
        <Section title="آخر الإعلانات" id="news">
          <AnnouncementList items={news} resources={site.resources} compact />
          <Link href="/announcements/" className="tap mt-2 inline-flex items-center font-medium text-brand-700 underline">كل الإعلانات</Link>
        </Section>
      )}
    </>
  );
}
