import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui";
import { getSite, lessonHref, lessonPath } from "@/lib/content/site";
import { AccountClient, type LessonIndex } from "./AccountClient";

export const metadata = { title: "حسابي (اختياري)", robots: { index: false } };

export default async function AccountPage() {
  const site = await getSite();
  // Static index so progress can be shown without extra database reads.
  const lessons: LessonIndex["lessons"] = site.lessons.flatMap((l) => {
    const p = lessonPath(site, l.id);
    return p ? [{ id: l.id, title: l.title, href: lessonHref(p), levelId: p.level.id }] : [];
  });
  const levels = site.levels.map((l) => ({ id: l.id, title: l.title }));
  return (
    <>
      <Breadcrumbs items={[{ label: "حسابي" }]} />
      <Suspense fallback={<p>جارٍ التحميل…</p>}>
        <AccountClient index={{ lessons, levels }} />
      </Suspense>
    </>
  );
}
