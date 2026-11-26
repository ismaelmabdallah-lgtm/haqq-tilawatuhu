"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/WorkflowPanel";
import { QUESTION_TABS, SubTabs } from "@/components/admin/SubTabs";
import type { ContentStatus } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";
import { useLookup } from "@/lib/admin/lookups";

type Q = { id: string; lesson_id: string | null; difficulty: number; tags: string[]; is_archived: boolean; current_version_id: string | null; created_at: string };
type V = { id: string; question_id: string; version_no: number; status: ContentStatus; prompt: { stem?: string; parts?: { type: string }[] } };

export default function QuestionsPage() {
  const lessons = useLookup("lessons");
  const [rows, setRows] = useState<{ q: Q; latest: V | undefined }[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [qs, vs] = await Promise.all([
        table<Q>("questions").select("*").order("created_at", { ascending: false }).limit(1000),
        table<V>("question_versions").select("id,question_id,version_no,status,prompt").order("version_no", { ascending: false }).limit(5000),
      ]);
      const latest = new Map<string, V>();
      for (const v of vs.data ?? []) if (!latest.has(v.question_id)) latest.set(v.question_id, v);
      if (alive) setRows((qs.data ?? []).map((q) => ({ q, latest: latest.get(q.id) })));
    })();
    return () => { alive = false; };
  }, []);

  const shown = (rows ?? []).filter(({ q, latest }) => !filter || q.lesson_id === filter || (filter === "none" && !q.lesson_id) || (latest?.prompt.stem ?? "").includes(filter));
  return (
    <div data-question-bank>
      <SubTabs tabs={QUESTION_TABS} active="questions" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-900">بنك الأسئلة</h1>
        <Link href="/admin/questions/edit/" className="tap inline-flex items-center rounded-lg bg-brand-700 px-4 text-white">+ سؤال جديد</Link>
      </div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="tap mb-3 w-full rounded-lg border border-line px-2" aria-label="تصفية حسب الدرس">
        <option value="">كل الأسئلة</option><option value="none">غير مرتبطة بدرس</option>
        {lessons.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
      {!rows ? <p>جارٍ التحميل…</p> : (
        <ul className="space-y-2">
          {shown.map(({ q, latest }) => (
            <li key={q.id}>
              <Link href={`/admin/questions/edit/?id=${q.id}`} className="block rounded-xl border border-line bg-white p-3 hover:border-brand-500">
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  {latest && <StatusBadge status={latest.status} />}
                  {latest && <span className="text-muted">الإصدار {latest.version_no}</span>}
                  {q.current_version_id && <span className="text-ok">له إصدار منشور</span>}
                  {latest?.prompt.parts && <span className="text-muted">{latest.prompt.parts.map((p) => p.type).join("، ")}</span>}
                </span>
                <span className="mt-1 block">{latest?.prompt.stem ?? "(بلا إصدار)"}</span>
                <span className="text-xs text-muted">{lessons.find((l) => l.id === q.lesson_id)?.label ?? ""}</span>
              </Link>
            </li>
          ))}
          {shown.length === 0 && <li className="text-muted">لا توجد أسئلة.</li>}
        </ul>
      )}
    </div>
  );
}
