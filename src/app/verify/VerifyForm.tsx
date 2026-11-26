"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { getBrowserClient } from "@/lib/supabase/client";

type Result = {
  valid: boolean; revoked: boolean; kind_label: string; disclaimer: string; title: string; student_name: string;
  issuer_name: string; level: string; curriculum: string | null; edition: string | null; completion_date: string; issued_at: string;
};

type State = { status: "idle" | "loading" | "notfound" | "error"; msg?: string } | { status: "done"; r: Result };
const valid = (c: string) => /^[0-9A-F]{6,32}$/.test(c.trim().toUpperCase());

async function lookup(c: string): Promise<State> {
  const { data, error } = await getBrowserClient().rpc("verify_certificate", { p_code: c.trim().toUpperCase() });
  if (error) return { status: "error", msg: errorMessage(error) };
  return data ? { status: "done", r: data as unknown as Result } : { status: "notfound" };
}

const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "long" });

/** Public certificate verification via verify_certificate(code). ?code=XXXX pre-fills (QR links). */
export function VerifyForm() {
  const initial = useSearchParams().get("code") ?? "";
  const [code, setCode] = useState(initial);
  const [state, setState] = useState<State>(() =>
    !initial ? { status: "idle" } : valid(initial) ? { status: "loading" } : { status: "error", msg: "رمز التحقق غير صالح." });

  async function verify(c: string) {
    if (!valid(c)) { setState({ status: "error", msg: "رمز التحقق غير صالح." }); return; }
    setState({ status: "loading" });
    setState(await lookup(c));
  }

  useEffect(() => {
    if (!initial || !valid(initial)) return;
    let alive = true;
    void lookup(initial).then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [initial]);

  return (
    <div className="max-w-xl">
      <form onSubmit={(e) => { e.preventDefault(); void verify(code); }} className="flex gap-2">
        <label htmlFor="code" className="sr-only">رمز التحقق</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" autoComplete="off" placeholder="A1B2C3D4E5F6"
          className="tap flex-1 rounded-lg border border-line bg-white px-3 font-mono uppercase tracking-widest" />
        <button className="tap rounded-lg bg-brand-700 px-5 font-bold text-white" disabled={state.status === "loading"}>تحقق</button>
      </form>
      <div className="mt-4" aria-live="polite">
        {state.status === "loading" && <p>جارٍ التحقق…</p>}
        {state.status === "notfound" && <p className="rounded-lg bg-red-50 p-3 text-danger">لا توجد شهادة بهذا الرمز.</p>}
        {state.status === "error" && <p className="rounded-lg bg-red-50 p-3 text-danger">{state.msg}</p>}
        {state.status === "done" && (
          <div className={`rounded-xl border p-4 ${state.r.valid ? "border-brand-500 bg-brand-50" : "border-danger bg-red-50"}`} data-cert-valid={state.r.valid}>
            <p className="font-bold">{state.r.valid ? "✓ شهادة صحيحة" : "✖ هذه الشهادة ملغاة"}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">النوع</dt><dd>{state.r.kind_label}</dd>
              <dt className="text-muted">العنوان</dt><dd>{state.r.title}</dd>
              <dt className="text-muted">الاسم</dt><dd>{state.r.student_name}</dd>
              <dt className="text-muted">المستوى</dt><dd>{state.r.level}{state.r.curriculum ? ` — ${state.r.curriculum}` : ""}{state.r.edition ? ` (${state.r.edition})` : ""}</dd>
              <dt className="text-muted">تاريخ الإتمام</dt><dd>{fmt.format(new Date(state.r.completion_date))}</dd>
              <dt className="text-muted">الجهة</dt><dd>{state.r.issuer_name}</dd>
            </dl>
            <p className="mt-3 rounded bg-gold-100 px-2 py-1 text-sm font-bold text-gold-700">{state.r.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
