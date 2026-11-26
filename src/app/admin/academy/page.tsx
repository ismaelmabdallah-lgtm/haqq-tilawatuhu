"use client";
import Link from "next/link";
import { useAdmin } from "@/components/admin/AdminShell";
import { can } from "@/lib/auth";

/** Section 5: academy content, encyclopedia and the team (super admin). */
export default function AdminAcademy() {
  const { roles } = useAdmin();
  const cards: [string, string, string, boolean][] = [
    ["/admin/content/?entity=academy_letters", "الحروف", "مخرج كل حرف وصفاته وتسجيله الصوتي وأمثلته", can.contentStaff(roles)],
    ["/admin/content/?entity=articulation_points", "المخارج", "المخارج العامة والخاصة ورسومها", can.contentStaff(roles)],
    ["/admin/content/?entity=letter_characteristics", "الصفات", "الصفات وأضدادها", can.contentStaff(roles)],
    ["/admin/content/?entity=tajweed_topics", "موسوعة التجويد", "تعريفات الأحكام وشرحها", can.contentStaff(roles)],
    ["/admin/team/", "الفريق والصلاحيات", "إضافة أعضاء للفريق مستقبلًا", can.superAdmin(roles)],
    ["/admin/review/", "المراجعة بفريق", "طابور المراجعة العلمية الثنائية (اختياري)", can.review(roles)],
  ];
  return (
    <div data-admin-academy>
      <h1 className="mb-4 text-2xl font-bold text-brand-900">الأكاديمية والفريق</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.filter((c) => c[3]).map(([href, t, d]) => (
          <Link key={href} href={href} className="block rounded-2xl border border-line bg-white p-4 hover:border-brand-500">
            <p className="font-bold text-brand-900">{t}</p><p className="text-sm text-muted">{d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
