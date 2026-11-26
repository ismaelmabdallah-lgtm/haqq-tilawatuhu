"use client";
import Link from "next/link";
import { useSession } from "@/lib/auth";

export function AccountLink() {
  const { session, loading } = useSession();
  return (
    <Link href="/account/" aria-label={session ? "حسابي" : "تسجيل الدخول (اختياري)"}
      className="tap grid place-items-center rounded-md text-brand-700 hover:bg-brand-50">
      <svg viewBox="0 0 24 24" width="22" height="22" fill={!loading && session ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    </Link>
  );
}
