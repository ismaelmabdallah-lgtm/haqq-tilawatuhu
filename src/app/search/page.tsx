import { Breadcrumbs, PageTitle } from "@/components/ui";
import { getSite, lessonHref, lessonPath } from "@/lib/content/site";
import { normalizeArabic } from "@/lib/arabic/normalize";
import { SearchBox, type SearchEntry } from "./SearchBox";

export const metadata = { title: "البحث" };

/**
 * Search runs entirely in the browser over an index built from PUBLISHED
 * content at build time (zero database cost, works while the DB is paused).
 */
export default async function SearchPage() {
  const site = await getSite();
  const strip = (s: string | null | undefined) => (s ?? "").replace(/\[\[quran:[^\]]+\]\]/g, " ").replace(/[#*_>`|-]+/g, " ");
  const index: SearchEntry[] = [
    ...site.lessons.flatMap((l) => {
      const p = lessonPath(site, l.id);
      if (!p) return [];
      const text = [l.title, l.description, strip(l.body_md), JSON.stringify(l.definitions)].join(" ");
      return [{ kind: "درس", title: l.title, href: lessonHref(p), context: `${p.level.title} · ${p.chapter.title}`, snippet: l.description ?? "", n: normalizeArabic(text) }];
    }),
    ...site.topics.map((t) => ({ kind: "الموسوعة", title: t.title, href: `/encyclopedia/${t.slug}/`, context: "", snippet: t.definition ?? "", n: normalizeArabic([t.title, t.definition, strip(t.explanation_md)].join(" ")) })),
    ...site.points.map((p) => ({ kind: "مخرج", title: p.name, href: `/academy/points/${p.code}/`, context: p.general_area, snippet: "", n: normalizeArabic([p.name, p.general_area, strip(p.description_md)].join(" ")) })),
    ...site.characteristics.map((c) => ({ kind: "صفة", title: c.name, href: `/academy/characteristics/${c.code}/`, context: "", snippet: "", n: normalizeArabic([c.name, strip(c.description_md)].join(" ")) })),
    ...site.resources.map((r) => ({ kind: "مادة", title: r.title, href: "/resources/", context: "", snippet: r.description ?? "", n: normalizeArabic([r.title, r.description].join(" ")) })),
  ];
  return (
    <>
      <Breadcrumbs items={[{ label: "البحث" }]} />
      <PageTitle title="البحث" subtitle="ابحث في الدروس والموسوعة والأكاديمية والمواد المنشورة." />
      <SearchBox index={index} />
    </>
  );
}
