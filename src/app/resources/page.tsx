import { ResourceItem } from "@/components/content/ResourceItem";
import { Breadcrumbs, EmptyState, PageTitle, Section, UNDER_REVIEW_NOTE } from "@/components/ui";
import { getSite } from "@/lib/content/site";
import { KIND_LABEL } from "@/lib/files";
import type { Database } from "@/lib/database.types";

export const metadata = { title: "المواد والملفات" };

const ORDER: Database["public"]["Enums"]["resource_kind"][] = ["pdf", "audio", "video", "document", "diagram", "image", "link"];
const GROUP_TITLE: Record<string, string> = { pdf: "ملفات PDF", audio: "مقاطع صوتية", video: "مقاطع مرئية", document: "مستندات", diagram: "رسوم توضيحية", image: "صور", link: "روابط" };

export default async function ResourcesPage() {
  const site = await getSite();
  return (
    <>
      <Breadcrumbs items={[{ label: "المواد" }]} />
      <PageTitle title="المواد والملفات" subtitle="ملفات للتحميل ومقاطع صوتية ومرئية مراجَعة علميًا. التحميل مجاني ودون تسجيل." />
      {site.resources.length === 0 ? <EmptyState title="لا توجد مواد منشورة بعد">{UNDER_REVIEW_NOTE}</EmptyState> : (
        ORDER.map((kind) => {
          const items = site.resources.filter((r) => r.kind === kind);
          return items.length ? (
            <Section key={kind} title={GROUP_TITLE[kind] ?? KIND_LABEL[kind]} id={kind}>
              <ul className="space-y-3">{items.map((r) => <ResourceItem key={r.id} r={r} />)}</ul>
            </Section>
          ) : null;
        })
      )}
    </>
  );
}
