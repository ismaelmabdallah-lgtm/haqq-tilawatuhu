"use client";
import { useEffect, useState } from "react";
import { Badge, EmptyState } from "@/components/ui";
import type { Exam } from "@/lib/content/site";
import { arDigits } from "@/lib/quran/ref";
import { shellHref } from "@/lib/shell-route";
import { getBrowserClient } from "@/lib/supabase/client";

const COLS = "id,slug,title,description,kind,level_id,chapter_id,lesson_id,is_level_final,requires_account,time_limit_minutes,total_marks,pass_percent,opens_at,closes_at,has_manual_parts";

/** Build-time list, refreshed live so newly published exams appear without a rebuild. */
export function ExamsList({ initial, levels }: { initial: Exam[]; levels: { id: string; title: string; sort: number }[] }) {
  const [exams, setExams] = useState<Exam[]>(initial);
  const [kind, setKind] = useState<"all" | "practice" | "formal">("all");
  useEffect(() => {
    void getBrowserClient().from("exams").select(COLS).eq("status", "published").order("created_at")
      .then(({ data, error }) => { if (!error && data) setExams(data as Exam[]); });
  }, []);

  const shown = exams.filter((e) => kind === "all" || e.kind === kind);
  const groups = [...levels.sort((a, b) => a.sort - b.sort).map((l) => ({ key: l.id, title: l.title, items: shown.filter((e) => e.level_id === l.id) })),
    { key: "other", title: "اختبارات عامة", items: shown.filter((e) => !e.level_id || !levels.some((l) => l.id === e.level_id)) }].filter((g) => g.items.length);

  return (
    <div>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="نوع الاختبار">
        {([["all", "الكل"], ["practice", "تدريبات"], ["formal", "اختبارات"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={`tap rounded-full px-4 text-sm ${kind === k ? "bg-brand-700 text-white" : "border border-line bg-white"}`}>{label}</button>
        ))}
      </div>
      {groups.length === 0 ? <EmptyState title="لا توجد اختبارات منشورة حاليًا">تُنشر الاختبارات بعد مراجعة أسئلتها ومفاتيح إجاباتها علميًا.</EmptyState> : groups.map((g) => (
        <section key={g.key} className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-brand-900">{g.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.items.map((e) => (
              <li key={e.id}>
                <a href={shellHref("exams", e.id)} className="block rounded-xl border border-line bg-white p-4 hover:border-brand-500" data-exam-link>
                  <span className="flex flex-wrap gap-2">
                    <Badge tone={e.kind === "practice" ? "brand" : "gold"}>{e.kind === "practice" ? "تدريب" : "اختبار"}</Badge>
                    {e.requires_account && <Badge tone="warn">يتطلب حسابًا</Badge>}
                    {e.is_level_final && <Badge tone="gold">نهائي المستوى</Badge>}
                  </span>
                  <span className="mt-1 block font-bold">{e.title}</span>
                  <span className="text-xs text-muted">{arDigits(Number(e.total_marks))} درجة{e.time_limit_minutes ? ` · ${arDigits(e.time_limit_minutes)} دقيقة` : ""}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
