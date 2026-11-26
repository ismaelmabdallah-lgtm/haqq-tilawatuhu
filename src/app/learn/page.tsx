import { Suspense } from "react";
import { ListSkeleton } from "@/components/learn/LearnViews";
import { LearnRoute } from "./LearnRoute";

export const metadata = { title: "تعلّم", robots: { index: false } };

/**
 * Live-only route for content published after the last site build:
 * /learn/?level=l1[&chapter=…[&lesson=…]]. Links switch to the pre-rendered
 * URL automatically once a rebuild includes the item.
 */
export default function LearnPage() {
  return <Suspense fallback={<ListSkeleton />}><LearnRoute /></Suspense>;
}
