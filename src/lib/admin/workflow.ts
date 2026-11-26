/**
 * Review workflow transitions offered in the UI — a mirror of
 * transition_content() (migration 0002). Postgres re-checks every call,
 * including "no self-approval" and reviewer assignments.
 */
import { can, type PlatformRole } from "@/lib/auth";
import type { ContentStatus } from "./entities";

export type Transition = { to: ContentStatus; label: string; needsComment?: boolean; tone: "primary" | "neutral" | "danger" };

export function allowedTransitions(from: ContentStatus, roles: PlatformRole[], isAuthor: boolean): Transition[] {
  const out: Transition[] = [];
  if ((from === "draft" || from === "changes_requested") && can.contentStaff(roles)) out.push({ to: "submitted", label: "إرسال للمراجعة العلمية", tone: "primary" });
  if (from === "submitted" && can.review(roles)) out.push({ to: "under_review", label: "بدء المراجعة", tone: "primary" });
  if (from === "under_review" && can.review(roles)) {
    if (!isAuthor) out.push({ to: "approved", label: "اعتماد علمي", tone: "primary" });
    out.push({ to: "changes_requested", label: "طلب تعديلات", needsComment: true, tone: "danger" });
  }
  if (from === "approved" && can.publish(roles)) out.push({ to: "published", label: "نشر", tone: "primary" });
  if (from === "published" && can.publish(roles)) out.push({ to: "archived", label: "أرشفة", tone: "danger" }, { to: "draft", label: "إعادة إلى مسودة للتعديل", tone: "neutral" });
  if ((from === "submitted" || from === "approved" || from === "archived") && can.contentStaff(roles)) out.push({ to: "draft", label: "إعادة إلى مسودة", tone: "neutral" });
  return out;
}
