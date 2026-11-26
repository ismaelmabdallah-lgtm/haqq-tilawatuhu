"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { RebuildButton } from "@/components/admin/RebuildButton";
import { can } from "@/lib/auth";
import { table } from "@/lib/admin/db";
import { arDigits } from "@/lib/quran/ref";

type Count = { draft: number; published: number };
const SECTIONS = [
  { key: "resources", href: "/admin/content/?entity=resources", newHref: "/admin/content/edit/?entity=resources", title: "الملفات والملخصات", hint: "ارفع ملخص PDF أو تسجيلًا صوتيًا وأرفقه بمستوى" },
  { key: "lessons", href: "/admin/content/?entity=lessons", newHref: "/admin/content/edit/?entity=lessons", title: "الدروس", hint: "أضف الدروس تدريجيًا: شرح قصير وصور ومقاطع صوتية" },
  { key: "question_versions", href: "/admin/questions/", newHref: "/admin/questions/edit/", title: "بنك الأسئلة والاختبارات", hint: "أسئلة تُصحَّح آليًا ثم اجمعها في اختبار" },
  { key: "announcements", href: "/admin/content/?entity=announcements", newHref: "/admin/content/edit/?entity=announcements", title: "الإعلانات", hint: "تظهر فورًا في الصفحة الرئيسية" },
] as const;

export default function AdminHome() {
  const { roles } = useAdmin();
  const [counts, setCounts] = useState<Record<string, Count>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, Count> = {};
      for (const s of SECTIONS) {
        if (s.key === "announcements") {
          const { data } = await table(s.key).select("id");
          out[s.key] = { draft: 0, published: (data ?? []).length };
        } else {
          const { data } = await table(s.key).select("status");
          const rows = data ?? [];
          out[s.key] = { draft: rows.filter((r) => r.status !== "published" && r.status !== "archived").length, published: rows.filter((r) => r.status === "published").length };
        }
      }
      if (alive) setCounts(out);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div data-admin-home>
      <h1 className="mb-1 text-2xl font-bold text-brand-900">لوحة الإدارة</h1>
      <p className="mb-5 text-muted">{can.superAdmin(roles) ? "تنشر بضغطة واحدة، ويظهر المحتوى للزوار فورًا دون إعادة بناء الموقع." : "أنشئ المحتوى وأرسله للمراجعة."}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const c = counts[s.key];
          return (
            <div key={s.key} className="flex flex-col rounded-2xl border border-line bg-white p-4">
              <Link href={s.href} className="text-lg font-bold text-brand-900 hover:underline">{s.title}</Link>
              <p className="text-sm text-muted">{s.hint}</p>
              <p className="mt-2 text-sm">
                {c ? <>{arDigits(c.published)} منشور{s.key !== "announcements" && <> · {arDigits(c.draft)} مسودة</>}</> : <span className="skeleton inline-block h-4 w-24 align-middle" />}
              </p>
              <Link href={s.newHref} className="tap mt-3 inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 font-bold text-white sm:w-fit">+ إضافة</Link>
            </div>
          );
        })}
      </div>
      {can.publish(roles) && (
        <details className="mt-6 rounded-2xl border border-line bg-white p-4 text-sm">
          <summary className="cursor-pointer font-bold">تحديث الصفحات المسبقة (اختياري)</summary>
          <p className="my-2 text-muted">المحتوى المنشور يظهر للزوار فورًا. إعادة البناء تحدّث فقط النسخ المُعدّة مسبقًا لمحركات البحث.</p>
          <RebuildButton />
        </details>
      )}
    </div>
  );
}
