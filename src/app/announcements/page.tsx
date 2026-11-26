import { AnnouncementList } from "@/components/content/AnnouncementList";
import { Breadcrumbs, PageTitle } from "@/components/ui";
import { getSite } from "@/lib/content/site";

export const metadata = { title: "الإعلانات" };

export default async function AnnouncementsPage() {
  const site = await getSite();
  return (
    <>
      <Breadcrumbs items={[{ label: "الإعلانات" }]} />
      <PageTitle title="الإعلانات" />
      <AnnouncementList items={site.announcements} resources={site.resources} />
    </>
  );
}
