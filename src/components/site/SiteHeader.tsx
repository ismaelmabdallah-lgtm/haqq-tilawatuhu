"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandMark";
import { useSession } from "@/lib/auth";

type Tab = { href: string; label: string; icon: React.ReactNode };

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);

/** The four core sections (main nav on desktop, bottom bar on phones) + account. */
export const CORE_NAV: Tab[] = [
  { href: "/levels/", label: "المستويات", icon: <I d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0A2 2 0 0 0 6 22h13M8 7h7M8 11h5" /> },
  { href: "/academy/", label: "الأكاديمية", icon: <I d="M12 3 2 8l10 5 10-5-10-5zm-6 7.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" /> },
  { href: "/exams/", label: "الاختبارات", icon: <I d="M9 4h6l1 2h3v15H5V6h3l1-2zm0 9 2 2 4-4" /> },
  { href: "/announcements/", label: "الإعلانات", icon: <I d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1zm12-1.5a4 4 0 0 1 0 7" /> },
];
const ACCOUNT_ICON = <I d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href);

export function SiteHeader() {
  const pathname = usePathname();
  const { session } = useSession();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="tap flex items-center" aria-label="حق تلاوته — الرئيسية">
            <BrandLogo size={40} />
          </Link>
          <nav aria-label="القائمة الرئيسية" className="ms-auto hidden items-center gap-1 md:flex">
            {CORE_NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined}
                className={`tap inline-flex items-center rounded-lg px-3 font-medium ${isActive(pathname, n.href) ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-brand-50"}`}>
                {n.label}
              </Link>
            ))}
            <Link href="/account/" className={`tap ms-2 inline-flex items-center gap-2 rounded-lg border px-3 font-medium ${session ? "border-brand-700 bg-brand-700 text-white" : "border-line hover:border-brand-500"}`}>
              {ACCOUNT_ICON}<span>{session ? "حسابي" : "دخول"}</span>
            </Link>
          </nav>
        </div>
      </header>
      <BottomNav pathname={pathname} signedIn={Boolean(session)} />
    </>
  );
}

/** Fixed bottom navigation for phones (< 768px): 4 core tabs + account. */
function BottomNav({ pathname, signedIn }: { pathname: string; signedIn: boolean }) {
  const tabs: Tab[] = [...CORE_NAV, { href: "/account/", label: signedIn ? "حسابي" : "دخول", icon: ACCOUNT_ICON }];
  return (
    <nav aria-label="التنقل السفلي" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" data-bottom-nav>
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-brand-700" : "text-muted"}`}>
                <span className={`grid h-8 w-12 place-items-center rounded-full ${active ? "bg-brand-50" : ""}`}>{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
