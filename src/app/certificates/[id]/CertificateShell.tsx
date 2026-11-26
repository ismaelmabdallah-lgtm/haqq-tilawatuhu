"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import { getBrowserClient } from "@/lib/supabase/client";
import { useShellId } from "@/lib/use-shell-id";

type Cert = { id: string; title: string; student_name: string; issuer_name: string; completion_date: string; verification_code: string; revoked_at: string | null; revoke_reason: string | null };
const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "long" });

/** Owner view of a certificate (RLS: own certificates only). Public check: /verify/?code=… */
export function CertificateShell() {
  const id = useShellId("certificates");
  const { session, loading } = useSession();
  const [cert, setCert] = useState<Cert | null | undefined>(undefined);

  useEffect(() => {
    if (!id || loading || !session) return;
    let alive = true;
    void getBrowserClient().from("certificates").select("id,title,student_name,issuer_name,completion_date,verification_code,revoked_at,revoke_reason").eq("id", id).maybeSingle()
      .then(({ data }) => { if (alive) setCert((data as Cert | null) ?? null); });
    return () => { alive = false; };
  }, [id, loading, session]);

  if (id === undefined || loading) return <p>جارٍ التحميل…</p>;
  if (id === null) return <p data-shell-invalid>رابط الشهادة غير صالح.</p>;
  if (!session) return <p>سجّل الدخول لعرض شهادتك، أو <a className="underline" href="/verify/">تحقق من شهادة برمزها</a>.</p>;
  if (cert === undefined) return <p>جارٍ التحميل…</p>;
  if (!cert) return <p>الشهادة غير موجودة.</p>;

  const verifyUrl = `${window.location.origin}/verify/?code=${cert.verification_code}`;
  return (
    <div>
      <article className="mx-auto max-w-2xl rounded-2xl border-4 border-double border-gold-500 bg-white p-8 text-center print:border-gold-500" data-certificate>
        <p className="text-sm text-gold-700">{cert.issuer_name}</p>
        <h1 className="mt-4 text-3xl font-bold text-brand-900">{cert.title}</h1>
        <p className="mt-6">تشهد المنصة بأن</p>
        <p className="mt-2 text-2xl font-bold">{cert.student_name}</p>
        <p className="mt-2">أتمّ دراسة المستوى واجتاز اختباره النهائي بتاريخ {fmt.format(new Date(cert.completion_date))}</p>
        <p className="mt-6 rounded bg-gold-100 px-3 py-1 text-sm font-bold text-gold-700">هذه شهادة تعليمية وليست إجازة قرآنية.</p>
        <p className="mt-4 text-xs text-muted">رمز التحقق: <span dir="ltr" className="font-mono">{cert.verification_code}</span></p>
        <p className="text-xs text-muted" dir="ltr">{verifyUrl}</p>
        {cert.revoked_at && <p className="mt-3 font-bold text-danger">ملغاة{cert.revoke_reason ? `: ${cert.revoke_reason}` : ""}</p>}
      </article>
      <div className="mt-4 text-center print:hidden">
        <button type="button" onClick={() => window.print()} className="tap rounded-lg bg-brand-700 px-5 text-white">طباعة / حفظ PDF</button>
      </div>
    </div>
  );
}
