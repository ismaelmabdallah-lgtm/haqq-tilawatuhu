"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext } from "react";
import { can, ROLE_LABELS, useRoles, useSession, type PlatformRole } from "@/lib/auth";

type AdminCtx = { userId: string; email: string | undefined; roles: PlatformRole[] };
const Ctx = createContext<AdminCtx | null>(null);
export function useAdmin(): AdminCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin outside AdminShell");
  return v;
}

const NAV: { href: string; label: string; show: (r: PlatformRole[]) => boolean }[] = [
  { href: "/admin/", label: "الرئيسية", show: can.team },
  { href: "/admin/content/?entity=lessons", label: "الدروس", show: can.contentStaff },
  { href: "/admin/content/?entity=resources", label: "الملفات", show: can.contentStaff },
  { href: "/admin/content/?entity=quranic_examples", label: "الأمثلة القرآنية", show: can.contentStaff },
  { href: "/admin/content/?entity=tajweed_topics", label: "الموسوعة", show: can.contentStaff },
  { href: "/admin/academy/", label: "الأكاديمية", show: can.contentStaff },
  { href: "/admin/questions/", label: "بنك الأسئلة", show: can.contentStaff },
  { href: "/admin/exams/", label: "الاختبارات", show: can.exams },
  { href: "/admin/review/", label: "المراجعة العلمية", show: can.review },
  { href: "/admin/grading/", label: "التصحيح", show: can.grade },
  { href: "/admin/content/?entity=announcements", label: "الإعلانات", show: can.announcements },
  { href: "/admin/team/", label: "الفريق", show: can.superAdmin },
];

/**
 * Client-side gate for the team dashboard. This only hides UI: every read and
 * write is authorized by Postgres (RLS + checked functions) with the session.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const userId = loading ? undefined : session?.user.id ?? null;
  const { roles, loading: rolesLoading } = useRoles(userId);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  if (loading || (session && rolesLoading)) return <p>جارٍ التحقق من الصلاحيات…</p>;
  if (!session) {
    return (
      <div className="py-10 text-center" data-admin-gate="signin">
        <h1 className="text-xl font-bold">لوحة فريق المنصة</h1>
        <p className="mt-2 text-muted">سجّل الدخول بحساب الفريق للمتابعة.</p>
        <a href={`/account/?next=${encodeURIComponent("/admin/")}`} className="tap mt-4 inline-flex items-center rounded-lg bg-brand-700 px-5 text-white">تسجيل الدخول</a>
      </div>
    );
  }
  if (!can.team(roles)) {
    return (
      <div className="py-10 text-center" data-admin-gate="forbidden">
        <h1 className="text-xl font-bold">لا تملك صلاحية الوصول</h1>
        <p className="mt-2 text-muted">هذه اللوحة لأعضاء فريق المنصة فقط.</p>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ userId: session.user.id, email: session.user.email, roles }}>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]" data-admin>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-1 text-xs text-muted">{session.user.email}</p>
          <p className="mb-3 flex flex-wrap gap-1">{roles.map((r) => <span key={r} className="rounded bg-gold-100 px-2 text-xs text-gold-700">{ROLE_LABELS[r]}</span>)}</p>
          <nav aria-label="لوحة الفريق" className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {NAV.filter((n) => n.show(roles)).map((n) => {
              const active = n.href === "/admin/" ? pathname === "/admin/" : pathname.startsWith(n.href.split("?")[0]!) && (n.href.includes("?") ? search.includes(n.href.split("?")[1]!) : true);
              return (
                <Link key={n.href} href={n.href} className={`tap flex shrink-0 items-center rounded-md px-3 text-sm ${active ? "bg-brand-700 text-white" : "hover:bg-brand-50"}`}>{n.label}</Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Ctx.Provider>
  );
}
