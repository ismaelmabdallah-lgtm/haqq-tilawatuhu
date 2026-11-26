import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "لوحة الفريق", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p>جارٍ التحميل…</p>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
