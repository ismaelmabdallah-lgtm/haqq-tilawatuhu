import { AcademyHome } from "@/components/learn/AcademyViews";
import { getSite, lightSite } from "@/lib/content/site";

export const metadata = { title: "أكاديمية المخارج والصفات" };

export default async function AcademyPage() {
  return <AcademyHome initial={lightSite(await getSite())} />;
}
