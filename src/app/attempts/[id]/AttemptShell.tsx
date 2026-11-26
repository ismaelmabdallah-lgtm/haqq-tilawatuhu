"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExamPlayer } from "@/components/exam/ExamPlayer";
import { ResultView } from "@/components/exam/ResultView";
import type { AttemptResult, Paper } from "@/domain/exams/types";
import { useSession } from "@/lib/auth";
import { attemptStore } from "@/lib/exams/attempt-store";
import { examApi } from "@/lib/exams/api";
import { errorMessage } from "@/lib/errors";
import { shellHref } from "@/lib/shell-route";
import { useShellId } from "@/lib/use-shell-id";

type View =
  | { kind: "loading" }
  | { kind: "player"; paper: Paper; token?: string }
  | { kind: "result"; result: AttemptResult; examId?: string }
  | { kind: "missing" }
  | { kind: "error"; message: string };

/**
 * One route for the whole attempt lifecycle: in progress → exam player;
 * submitted/graded → result (with "pending" until manual grading is done).
 * Ownership is proven by the session (accounts) or the guest token stored in
 * this browser; graders can open any attempt's result.
 */
export function AttemptShell({ lessonHrefs }: { lessonHrefs: Record<string, string> }) {
  const id = useShellId("attempts");
  const { session, loading: sessionLoading } = useSession();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id || sessionLoading) return;
    let alive = true;
    const token = attemptStore.get(id)?.token;
    (async () => {
      const paper = await examApi.paper(id, token);
      if (!alive) return;
      if (paper.data && paper.data.status === "in_progress") { setView({ kind: "player", paper: paper.data, token }); return; }
      if (paper.error && paper.error.code !== "P0002") { setView({ kind: "error", message: errorMessage(paper.error) }); return; }
      // submitted / graded (owner), or a grader opening someone else's attempt
      const res = await examApi.result(id, token);
      if (!alive) return;
      if (res.data) {
        if (token && res.data.status !== "in_progress") attemptStore.markFinished(id);
        setView({ kind: "result", result: res.data, examId: paper.data?.exam_id ?? attemptStore.get(id)?.exam_id });
      } else if (res.error?.code === "P0002") setView({ kind: "missing" });
      else setView({ kind: "error", message: errorMessage(res.error) });
    })();
    return () => { alive = false; };
  }, [id, sessionLoading, session?.user.id, reloadKey]);

  const onFinished = useCallback(() => {
    if (id) attemptStore.markFinished(id);
    setView({ kind: "loading" });
    setReloadKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  }, [id]);

  if (id === undefined) return <p>جارٍ التحميل…</p>;
  if (id === null) return <p data-shell-invalid>رابط المحاولة غير صالح.</p>;

  switch (view.kind) {
    case "loading": return <p>جارٍ التحميل…</p>;
    case "error": return <p role="alert" className="rounded-lg bg-red-50 p-3 text-danger">{view.message}</p>;
    case "missing":
      return (
        <div className="py-8 text-center" data-attempt-missing>
          <h1 className="text-xl font-bold">لا يمكن فتح هذه المحاولة</h1>
          <p className="mt-2 text-muted">
            محاولات الضيوف تُفتح من المتصفح نفسه الذي بدأت منه{session ? "" : "، أو سجّل الدخول إن كانت المحاولة مرتبطة بحسابك"}.
            وتُحذف محاولات الضيوف تلقائيًا بعد مدة.
          </p>
          <Link href="/exams/" className="tap mt-4 inline-flex items-center rounded-lg bg-brand-700 px-4 text-white">الاختبارات</Link>
        </div>
      );
    case "player":
      return (
        <>
          <h1 className="mb-1 text-2xl font-bold text-brand-900">{view.paper.title}</h1>
          <p className="mb-4 text-sm text-muted">تُحفظ إجاباتك تلقائيًا. إن انقطع الاتصال افتح هذا الرابط مجددًا من المتصفح نفسه للمتابعة.</p>
          <ExamPlayer paper={view.paper} token={view.token} onFinished={onFinished} />
        </>
      );
    case "result":
      return (
        <>
          <h1 className="mb-4 text-2xl font-bold text-brand-900">نتيجة الاختبار</h1>
          <ResultView result={view.result} lessonHrefs={lessonHrefs} />
          <div className="mt-6 flex flex-wrap gap-2">
            {view.examId && <a href={shellHref("exams", view.examId)} className="tap inline-flex items-center rounded-lg border border-line bg-white px-4">إعادة المحاولة</a>}
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="tap rounded-lg border border-line bg-white px-4">تحديث النتيجة</button>
            {!session && <a href="/account/" className="tap inline-flex items-center rounded-lg px-4 text-brand-700 underline">احفظ نتائجك في حساب (اختياري)</a>}
          </div>
        </>
      );
  }
}
