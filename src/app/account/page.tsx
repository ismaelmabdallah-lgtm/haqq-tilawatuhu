import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui";
import { getSite, lightSite } from "@/lib/content/site";
import { AccountClient } from "./AccountClient";

export const metadata = { title: "حسابي", robots: { index: false } };

export default async function AccountPage() {
  const site = lightSite(await getSite());
  return (
    <>
      <Breadcrumbs items={[{ label: "حسابي" }]} />
      <Suspense fallback={<p>جارٍ التحميل…</p>}>
        <AccountClient initial={site} />
      </Suspense>
    </>
  );
}
