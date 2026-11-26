import { Suspense } from "react";
import { ListSkeleton } from "@/components/learn/LearnViews";
import { AcademyItemRoute } from "./AcademyItemRoute";

export const metadata = { title: "الأكاديمية", robots: { index: false } };

/** Live-only route for academy items published after the last build: /academy/item/?type=letter&key=3 */
export default function AcademyItemPage() {
  return <Suspense fallback={<ListSkeleton rows={2} />}><AcademyItemRoute /></Suspense>;
}
