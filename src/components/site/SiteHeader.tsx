"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountLink } from "@/components/site/AccountLink";

export const NAV = [
  { href: "/levels/", label: "المستويات" },
  { href: "/encyclopedia/", label: "الموسوعة" },
  { href: "/academy/", label: "أكاديمية المخارج والصفات" },
  { href: "/exams/", label: "الاختبارات" },
  { href: "/resources/", label: "المواد" },
  { href: "/announcements/", label: "الإعلانات" },
  { href: "/about/", label: "عن المنصة" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <Link href="/" className="tap flex items-center gap-2 font-bold text-brand-900" onClick={() => setOpen(false)}>
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-lg text-white">ح</span>
          <span className="text-lg">حَقَّ تِلَاوَتِهِ</span>
        </Link>
        <nav aria-label="القائمة الرئيسية" className="ms-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`rounded-md px-2.5 py-2 text-sm ${isActive(n.href) ? "bg-brand-50 font-bold text-brand-700" : "text-ink hover:bg-brand-50"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/search/" className="tap ms-auto grid place-items-center rounded-md text-brand-700 hover:bg-brand-50 lg:ms-0" aria-label="البحث">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </Link>
        <AccountLink />
        <button type="button" className="tap grid place-items-center rounded-md text-brand-700 hover:bg-brand-50 lg:hidden"
          aria-expanded={open} aria-controls="mobile-nav" aria-label="القائمة" onClick={() => setOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="القائمة الرئيسية" className="border-t border-line bg-paper lg:hidden">
          <ul className="mx-auto max-w-5xl px-4 py-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setOpen(false)}
                  className={`tap flex items-center rounded-md px-3 ${isActive(n.href) ? "bg-brand-50 font-bold text-brand-700" : ""}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
