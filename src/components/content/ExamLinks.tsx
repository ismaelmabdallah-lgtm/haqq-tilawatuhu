import type { Exam } from "@/lib/content/site";
import { Badge } from "@/components/ui";
import { shellHref } from "@/lib/shell-route";
import { arDigits } from "@/lib/quran/ref";

/** Exams published at build time. Plain <a>: the exam page is a client-only route. */
export function ExamLinks({ exams }: { exams: Exam[] }) {
  if (!exams.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {exams.map((e) => (
        <li key={e.id}>
          <a href={shellHref("exams", e.id)} className="tap block rounded-xl border border-line bg-white p-3 hover:border-brand-500">
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={e.kind === "practice" ? "brand" : "gold"}>{e.kind === "practice" ? "تدريب" : "اختبار"}</Badge>
              {e.requires_account && <Badge tone="warn">يتطلب حسابًا</Badge>}
              {e.time_limit_minutes && <span className="text-xs text-muted">{arDigits(e.time_limit_minutes)} دقيقة</span>}
            </span>
            <span className="mt-1 block font-bold">{e.title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
