import { AnnouncementsView } from "@/components/learn/LiveLists";
import { getSite, lightSite } from "@/lib/content/site";

export const metadata = { title: "الإعلانات" };

export default async function AnnouncementsPage() {
  return <AnnouncementsView initial={lightSite(await getSite())} />;
}
