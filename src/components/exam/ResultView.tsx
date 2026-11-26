"use client";
import { Badge } from "@/components/ui";
import type { AttemptResult } from "@/domain/exams/types";
import { MANUAL_TYPES } from "@/domain/exams/types";
import { arDigits } from "@/lib/quran/ref";
import { keyText, modelAnswerText, responseText } from "./answer-text";

const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : arDigits(Number(n).toLocaleString("en", { maximumFractionDigits: 2 })));
const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "long", timeStyle: "short" });

/** Renders get_attempt_result() exactly as released by the server (keys only when allowed). */
export function ResultView({ result, lessonHrefs }: { result: AttemptResult; lessonHrefs: Record<string, string> }) {
  if (result.status === "in_progress") return null;
  if (!result.released) {
    return (
      <div className="rounded-xl border border-gold-500 bg-gold-100 p-5" data-result="unreleased">
        <p className="text-lg font-bold text-gold-700">تم تسليم الاختبار ✓</p>
        <p className="mt-1">ستُعلن النتيجة وفق إعدادات الاختبار. احتفظ برابط هذه الصفحة للعودة إليها.</p>
        {result.submitted_at && <p className="mt-1 text-sm text-muted">وقت التسليم: {fmt.format(new Date(result.submitted_at))}</p>}
      </div>
    );
  }

  const pct = result.total_score !== null && result.max_score > 0 ? Math.round((Number(result.total_score) / Number(result.max_score)) * 100) : null;
  return (
    <div data-result={result.pending_manual ? "pending" : "graded"}>
      <section className={`rounded-xl p-5 ${result.pending_manual ? "border border-gold-500 bg-gold-100" : result.passed ? "bg-brand-700 text-white" : "border border-line bg-white"}`}>
        <p className="text-sm opacity-80">{result.exam_title}{result.guest_name ? ` — ${result.guest_name}` : ""}</p>
        <p className="mt-1 text-3xl font-bold" data-score>
          {num(result.total_score)} <span className="text-lg font-normal">من {num(result.max_score)}</span>
          {pct !== null && <span className="ms-2 text-lg">({arDigits(pct)}٪)</span>}
        </p>
        <p className="mt-1 font-bold" data-outcome>
          {result.pending_manual ? "بانتظار التصحيح اليدوي لبعض الإجابات — الدرجة الحالية جزئية" : result.passed ? "ناجح ✓" : "لم تجتز الاختبار هذه المرة"}
        </p>
        {result.pending_manual && <p className="mt-1 text-sm">ستظهر الدرجة النهائية على هذا الرابط نفسه بعد التصحيح.</p>}
      </section>

      {!result.model_answers_visible && (
        <p className="mt-3 rounded-lg bg-white p-3 text-sm text-muted">لا تُعرض الإجابات النموذجية لهذا الاختبار في الوقت الحالي وفق إعداداته.</p>
      )}

      <ol className="mt-5 space-y-4">
        {result.items.map((item, i) => (
          <li key={item.exam_question_id} className="rounded-xl border border-line bg-white p-4" data-result-item>
            <header className="flex items-start justify-between gap-3">
              <h3 className="font-bold leading-relaxed"><span className="text-brand-700">{arDigits(i + 1)}. </span>{item.stem}</h3>
              <span className="shrink-0">
                {item.needs_manual ? <Badge tone="gold">قيد التصحيح</Badge> : <Badge tone={Number(item.score) >= Number(item.max) ? "brand" : "neutral"}>{num(item.score)} / {num(item.max)}</Badge>}
              </span>
            </header>
            <div className="mt-3 space-y-3">
              {item.parts.map((p) => {
                const resp = responseText(p, item.response?.parts?.[p.id]);
                const score = item.part_scores?.[p.id];
                const correct = item.key ? keyText(p, item.key[p.id]) : [];
                const model = modelAnswerText(item.model_answer, p.id);
                const pending = score === null && MANUAL_TYPES.includes(p.type);
                return (
                  <div key={p.id} className="rounded-lg bg-paper p-3 text-sm">
                    {(p.prompt || item.parts.length > 1) && <p className="mb-1 font-medium">{p.prompt}</p>}
                    <p><span className="text-muted">إجابتك: </span>{resp.length ? resp.join("، ") : <em className="text-muted">لم تُجب</em>}</p>
                    <p className="text-xs text-muted">الدرجة: {pending ? "بانتظار المصحح" : `${num(score)} من ${num(p.marks)}`}</p>
                    {correct.length > 0 && <p className="mt-1 text-brand-700" data-correct><span className="font-bold">الإجابة الصحيحة: </span>{correct.join("، ")}</p>}
                    {model && <p className="mt-1 text-brand-700"><span className="font-bold">إجابة نموذجية: </span>{model}</p>}
                  </div>
                );
              })}
            </div>
            {item.feedback && <p className="mt-2 rounded bg-brand-50 p-2 text-sm"><span className="font-bold">ملاحظة المصحح: </span>{item.feedback}</p>}
            {item.explanation && <p className="mt-2 text-sm" data-explanation><span className="font-bold">الشرح: </span>{item.explanation}</p>}
            {item.lesson_id && lessonHrefs[item.lesson_id] && (
              <a href={lessonHrefs[item.lesson_id]} className="tap mt-2 inline-flex items-center text-sm text-brand-700 underline">راجع الدرس</a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
