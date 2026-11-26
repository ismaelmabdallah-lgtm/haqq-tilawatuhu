"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { RebuildButton } from "@/components/admin/RebuildButton";
import { can } from "@/lib/auth";
import { REVIEWABLE } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";
import { getBrowserClient } from "@/lib/supabase/client";
import { arDigits } from "@/lib/quran/ref";

type Counts = { review: number; changes: number; grading: number | null };

export default function AdminHome() {
  const { roles, userId } = useAdmin();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let review = 0, changes = 0;
      if (can.contentStaff(roles)) {
        const lists = await Promise.all(REVIEWABLE.map((r) => table(r.entity).select("status,created_by").in("status", ["submitted", "under_review", "changes_requested"])));
        for (const l of lists) for (const row of l.data ?? []) {
          if (row.status === "changes_requested") { if (row.created_by === userId) changes++; } else review++;
        }
      }
      const grading = can.grade(roles) ? ((await getBrowserClient().rpc("list_grading_queue", { p_limit: 200 })).data ?? []).length : null;
      if (alive) setCounts({ review, changes, grading });
    })();
    return () => { alive = false; };
  }, [roles, userId]);

  const card = (href: string, title: string, value: string | null, note: string) => (
    <Link href={href} className="block rounded-xl border border-line bg-white p-4 hover:border-brand-500">
      <p className="text-sm text-muted">{title}</p>
      <p className="text-3xl font-bold text-brand-900">{value ?? "…"}</p>
      <p className="text-xs text-muted">{note}</p>
    </Link>
  );

  return (
    <div data-admin-home>
      <h1 className="mb-4 text-2xl font-bold text-brand-900">لوحة فريق المنصة</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {can.review(roles) && card("/admin/review/", "بانتظار المراجعة العلمية", counts ? arDigits(counts.review) : null, "مرسل أو قيد المراجعة")}
        {can.contentStaff(roles) && card("/admin/review/?mine=1", "مطلوب منك تعديله", counts ? arDigits(counts.changes) : null, "محتوى كتبته وطُلبت عليه تعديلات")}
        {can.grade(roles) && card("/admin/grading/", "إجابات بانتظار التصحيح", counts?.grading != null ? arDigits(counts.grading) : null, "مقالية وصوتية")}
      </div>
      <section className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="mb-2 font-bold">مبادئ العمل</h2>
        <ul className="list-disc space-y-1 ps-5 text-muted">
          <li>لا يُنشر أي محتوى إلا بعد اعتماده من مراجع علمي غير كاتبه، ثم نشره من مدير المراجعة.</li>
          <li>النص القرآني لا يُكتب يدويًا: الأمثلة تُحفظ بالإحالة (السورة:الآية) وتُعرض من نص تنزيل الموثق.</li>
          <li>المحتوى المنقول من المنهج يجب أن يحمل رقم الصفحة.</li>
          <li>مفاتيح الإجابات لا تصل إلى المتعلمين؛ تبقى في قاعدة البيانات.</li>
        </ul>
      </section>
      {can.publish(roles) && <section className="mt-4"><RebuildButton /></section>}
    </div>
  );
}
