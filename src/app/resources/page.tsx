import { ResourcesView } from "@/components/learn/LiveLists";
import { getSite, lightSite } from "@/lib/content/site";

export const metadata = { title: "المواد والملخصات" };

export default async function ResourcesPage() {
  return <ResourcesView initial={lightSite(await getSite())} />;
}
