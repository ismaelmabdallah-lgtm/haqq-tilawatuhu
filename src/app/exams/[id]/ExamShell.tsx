"use client";
import { useEffect, useState } from "react";
import { Badge, NotFoundNotice } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { attemptStore, type LocalAttempt } from "@/lib/exams/attempt-store";
import { examApi } from "@/lib/exams/api";
import { errorMessage } from "@/lib/errors";
import { arDigits } from "@/lib/quran/ref";
import { isUuid, shellHref } from "@/lib/shell-route";
import { getBrowserClient } from "@/lib/supabase/client";
import { useShellId } from "@/lib/use-shell-id";
import type { Database } from "@/lib/database.types";

type Exam = Database["public"]["Tables"]["exams"]["Row"];
type MyAttempt = { attempt_id: string; status: string; started_at: string; total_score: number | null; max_score: number };

const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "medium", timeStyle: "short" });
const RELEASE: Record<Exam["result_release"], string> = { immediate: "فور التسليم", on_date: "في موعد محدد", manual: "بعد إعلانها من المنصة" };

export function ExamShell() {
  const id = useShellId("exams");
  const { session, loading: sessionLoading } = useSession();
  const [exam, setExam] = useState<Exam | null | undefined>(undefined);
  const [local, setLocal] = useState<LocalAttempt[]>([]);
  const [mine, setMine] = useState<MyAttempt[]>([]);
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const q = getBrowserClient().from("exams").select("*").eq("status", "published");
    void (isUuid(id) ? q.eq("id", id) : q.eq("slug", id)).maybeSingle().then(({ data }) => {
      if (!alive) return;
      setExam((data as Exam | null) ?? null);
      setLoadedAt(Date.now());
      if (data) setLocal(attemptStore.forExam(data.id));
    });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!exam || !session) return;
    void getBrowserClient().rpc("list_my_attempts", { p_exam: exam.id }).then(({ data }) => setMine((data ?? []) as MyAttempt[]));
  }, [exam, session]);

  if (id === undefined || (id && exam === undefined)) return <p>جارٍ التحميل…</p>;
  if (id === null) return <p data-shell-invalid>رابط الاختبار غير صالح.</p>;
  if (!exam) return <NotFoundNotice what="الاختبار" />;

  const now = loadedAt;
  const notOpen = exam.opens_at && now < Date.parse(exam.opens_at);
  const closed = exam.closes_at && now > Date.parse(exam.closes_at);
  const needsAccount = exam.requires_account && !session;
  const openLocal = session ? undefined : local.find((a) => !a.finished);

  async function start() {
    if (!exam) return;
    setBusy(true); setError(null);
    const resumeToken = session ? undefined : attemptStore.openFor(exam.id)?.token;
    const { data, error: err } = await examApi.start(exam.id, resumeToken, session ? undefined : guestName.trim());
    if (err || !data) { setBusy(false); setError(errorMessage(err)); return; }
    if (data.guest_token) {
      // A new guest attempt. If we tried to resume, the old one had expired and
      // the server auto-submitted it.
      const old = attemptStore.openFor(exam.id);
      if (old && old.attempt_id !== data.attempt_id) attemptStore.markFinished(old.attempt_id);
      attemptStore.add({ attempt_id: data.attempt_id, exam_id: exam.id, exam_title: exam.title, token: data.guest_token, started_at: new Date().toISOString() });
    }
    window.location.assign(shellHref("attempts", data.attempt_id));
  }

  return (
    <div data-exam-intro={exam.id}>
      <div className="flex flex-wrap gap-2">
        <Badge tone={exam.kind === "practice" ? "brand" : "gold"}>{exam.kind === "practice" ? "تدريب" : "اختبار"}</Badge>
        {exam.requires_account && <Badge tone="warn">يتطلب حسابًا</Badge>}
        {exam.has_manual_parts && <Badge>يتضمن أسئلة تُصحَّح يدويًا</Badge>}
      </div>
      <h1 className="mt-2 text-2xl font-bold text-brand-900 sm:text-3xl">{exam.title}</h1>
      {exam.description && <p className="mt-2 whitespace-pre-line text-muted">{exam.description}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["الدرجة الكلية", arDigits(Number(exam.total_marks))],
          ["درجة النجاح", `${arDigits(Number(exam.pass_percent))}٪`],
          ["المدة", exam.time_limit_minutes ? `${arDigits(exam.time_limit_minutes)} دقيقة` : "غير محددة"],
          ["النتيجة", exam.kind === "practice" ? "فور التسليم" : RELEASE[exam.result_release]],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-white p-3"><dt className="text-xs text-muted">{k}</dt><dd className="font-bold">{v}</dd></div>
        ))}
      </dl>
      {(exam.opens_at || exam.closes_at) && (
        <p className="mt-2 text-sm text-muted">
          {exam.opens_at && <>يُفتح: {fmt.format(new Date(exam.opens_at))} </>}{exam.closes_at && <>· يُغلق: {fmt.format(new Date(exam.closes_at))}</>}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        {notOpen ? <p className="text-warn">لم يُفتح الاختبار بعد.</p>
          : closed ? <p className="text-warn">أُغلق هذا الاختبار.</p>
          : needsAccount ? (
            <div>
              <p>هذا الاختبار يتطلب تسجيل الدخول {exam.is_level_final ? "لأنه يُحتسب لشهادة إتمام المستوى." : "لأنه يحدد عدد المحاولات."}</p>
              <a href={`/account/?next=${encodeURIComponent(shellHref("exams", exam.id))}`} className="tap mt-3 inline-flex items-center rounded-lg bg-brand-700 px-5 font-bold text-white">تسجيل الدخول / إنشاء حساب</a>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void start(); }}>
              {!session && !openLocal && (
                <label className="mb-3 block">
                  <span className="text-sm">اسمك (اختياري — يظهر على صفحة النتيجة فقط)</span>
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={100} autoComplete="name"
                    className="tap mt-1 w-full rounded-lg border border-line px-3" />
                </label>
              )}
              <button type="submit" disabled={busy || sessionLoading} className="tap rounded-lg bg-brand-700 px-6 font-bold text-white disabled:opacity-60" data-start>
                {busy ? "جارٍ التحضير…" : openLocal ? "متابعة المحاولة" : "ابدأ الاختبار"}
              </button>
              {!session && <p className="mt-2 text-xs text-muted">لا يلزم تسجيل. تُحفظ محاولتك في هذا المتصفح، ويمكنك متابعتها إن انقطع الاتصال.</p>}
            </form>
          )}
        {error && <p role="alert" className="mt-3 rounded bg-red-50 p-2 text-danger">{error}</p>}
      </div>

      {(local.length > 0 || mine.length > 0) && (
        <section className="mt-6">
          <h2 className="mb-2 font-bold">محاولاتك السابقة</h2>
          <ul className="space-y-2">
            {(session ? mine.map((m) => ({ id: m.attempt_id, at: m.started_at, label: m.status === "in_progress" ? "قيد الإجابة" : m.total_score !== null ? `${arDigits(m.total_score)} / ${arDigits(m.max_score)}` : "تم التسليم" }))
              : local.map((a) => ({ id: a.attempt_id, at: a.started_at, label: a.finished ? "عرض النتيجة" : "قيد الإجابة" }))).map((a) => (
              <li key={a.id}>
                <a href={shellHref("attempts", a.id)} className="tap flex items-center justify-between rounded-lg border border-line bg-white px-3 hover:border-brand-500">
                  <span className="text-sm">{fmt.format(new Date(a.at))}</span><span className="text-sm text-brand-700">{a.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
