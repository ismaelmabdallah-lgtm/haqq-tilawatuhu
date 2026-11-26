"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { table } from "@/lib/admin/db";
import { QUESTION_TABS, SubTabs } from "@/components/admin/SubTabs";
import { arDigits } from "@/lib/quran/ref";

type Exam = { id: string; title: string; kind: string; status: string; total_marks: number; requires_account: boolean; created_at: string };
const EXAM_STATUS: Record<string, string> = { draft: "مسودة", published: "منشور", closed: "مغلق", archived: "مؤرشف" };

export default function AdminExamsPage() {
  const [rows, setRows] = useState<Exam[] | null>(null);
  useEffect(() => {
    let alive = true;
    void table<Exam>("exams").select("id,title,kind,status,total_marks,requires_account,created_at").order("created_at", { ascending: false }).then(({ data }) => { if (alive) setRows(data ?? []); });
    return () => { alive = false; };
  }, []);
  return (
    <div data-admin-exams>
      <SubTabs tabs={QUESTION_TABS} active="exams" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-900">الاختبارات</h1>
        <Link href="/admin/exams/edit/" className="tap inline-flex items-center rounded-lg bg-brand-700 px-4 text-white">+ اختبار جديد</Link>
      </div>
      {!rows ? <p>جارٍ التحميل…</p> : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/exams/edit/?id=${e.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 hover:border-brand-500">
                <span><span className="font-bold">{e.title}</span> <span className="text-xs text-muted">({e.kind === "practice" ? "تدريب" : "رسمي"}{e.requires_account ? "، يتطلب حسابًا" : ""})</span></span>
                <span className="text-sm"><span className="rounded bg-gold-100 px-2 text-gold-700">{EXAM_STATUS[e.status]}</span> · {arDigits(Number(e.total_marks))} درجة</span>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted">لا توجد اختبارات.</li>}
        </ul>
      )}
    </div>
  );
}
