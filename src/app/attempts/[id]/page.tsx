import { getSite, lessonHref, lessonPath } from "@/lib/content/site";
import { SHELL_PLACEHOLDER } from "@/lib/shell-route";
import { ShellIdMarker } from "@/components/ShellIdMarker";
import { AttemptShell } from "./AttemptShell";

/** Exported once as /attempts/_/; public/_redirects serves it for every /attempts/:id. */
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ id: SHELL_PLACEHOLDER }];
}

export const metadata = { title: "المحاولة", robots: { index: false } };

export default async function AttemptPage() {
  const site = await getSite();
  // Static map so results can link "review the lesson" without a database call.
  const lessonHrefs = Object.fromEntries(site.lessons.flatMap((l) => {
    const p = lessonPath(site, l.id);
    return p ? [[l.id, lessonHref(p)]] : [];
  }));
  return <ShellIdMarker route="attempts"><AttemptShell lessonHrefs={lessonHrefs} /></ShellIdMarker>;
}
