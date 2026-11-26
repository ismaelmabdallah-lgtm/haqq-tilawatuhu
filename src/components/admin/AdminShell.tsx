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

/**
 * Five sections for a solo admin. Hidden for v1 but still reachable by URL:
 * /admin/review/ (team peer review) and /admin/grading/ (manual grading).
 */
const NAV: { href: string; label: string; match: (path: string, search: string) => boolean; show: (r: PlatformRole[]) => boolean }[] = [
  { href: "/admin/content/?entity=resources", label: "الملفات والملخصات", show: can.contentStaff,
    match: (p, q) => p.startsWith("/admin/content") && q.includes("entity=resources") },
  { href: "/admin/content/?entity=lessons", label: "الدروس", show: can.contentStaff,
    match: (p, q) => p.startsWith("/admin/content") && /entity=(lessons|quranic_examples)/.test(q) },
  { href: "/admin/questions/", label: "بنك الأسئلة والاختبارات", show: can.contentStaff,
    match: (p) => p.startsWith("/admin/questions") || p.startsWith("/admin/exams") },
  { href: "/admin/content/?entity=announcements", label: "الإعلانات", show: can.announcements,
    match: (p, q) => p.startsWith("/admin/content") && q.includes("entity=announcements") },
  { href: "/admin/academy/", label: "الأكاديمية والفريق", show: can.team,
    match: (p, q) => p.startsWith("/admin/academy") || p.startsWith("/admin/team") || p.startsWith("/admin/review")
      || (p.startsWith("/admin/content") && /entity=(tajweed_topics|articulation_points|letter_characteristics|academy_letters)/.test(q)) },
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
            <Link href="/admin/" className={`tap flex shrink-0 items-center rounded-xl px-3 text-sm ${pathname === "/admin/" ? "bg-brand-700 text-white" : "hover:bg-brand-50"}`}>الرئيسية</Link>
            {NAV.filter((n) => n.show(roles)).map((n) => (
              <Link key={n.href} href={n.href} aria-current={n.match(pathname, search) ? "page" : undefined}
                className={`tap flex shrink-0 items-center rounded-xl px-3 text-sm font-medium ${n.match(pathname, search) ? "bg-brand-700 text-white" : "hover:bg-brand-50"}`}>{n.label}</Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Ctx.Provider>
  );
}
