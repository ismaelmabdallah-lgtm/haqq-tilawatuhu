import { Breadcrumbs, PageTitle } from "@/components/ui";
import { getSite } from "@/lib/content/site";
import { ExamsList } from "./ExamsList";

export const metadata = { title: "الاختبارات" };

export default async function ExamsPage() {
  const site = await getSite();
  return (
    <>
      <Breadcrumbs items={[{ label: "الاختبارات" }]} />
      <PageTitle title="الاختبارات والتدريبات" subtitle="اختبر نفسك وشاهد نتيجتك وتصحيحك فورًا — دون تسجيل. بعض الاختبارات النهائية تتطلب حسابًا اختياريًا." />
      <ExamsList initial={site.exams} levels={site.levels.map((l) => ({ id: l.id, title: l.title, sort: l.sort_order }))} />
    </>
  );
}
