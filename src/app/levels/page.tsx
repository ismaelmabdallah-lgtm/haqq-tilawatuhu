import { LevelsOverview } from "@/components/learn/LearnViews";
import { getSite, lightSite } from "@/lib/content/site";

export const metadata = { title: "المستويات" };

/** Pre-rendered from the build snapshot, refreshed live in the browser. */
export default async function LevelsPage() {
  return <LevelsOverview initial={lightSite(await getSite())} />;
}
