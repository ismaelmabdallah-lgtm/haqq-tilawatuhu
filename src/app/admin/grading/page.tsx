"use client";
import { useCallback, useEffect, useState } from "react";
import { responseText, modelAnswerText } from "@/components/exam/answer-text";
import type { Part } from "@/domain/questions/schema";
import type { QuestionResponse } from "@/domain/exams/types";
import { MANUAL_TYPES } from "@/domain/exams/types";
import { errorMessage } from "@/lib/errors";
import { arDigits } from "@/lib/quran/ref";
import { shellHref } from "@/lib/shell-route";
import { getBrowserClient } from "@/lib/supabase/client";

type Item = { attempt_id: string; exam_question_id: string; exam_title: string; submitted_at: string; stem: string; parts: Part[]; response: QuestionResponse | null; part_scores: Record<string, number | null>; model_answer: Record<string, unknown> | null };
const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "medium", timeStyle: "short" });

/** Manual grading queue (list_grading_queue / grade_answer). Scores are range-checked in SQL. */
export default function GradingPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await getBrowserClient().rpc("list_grading_queue", { p_limit: 100 });
    setItems((data ?? []) as unknown as Item[]);
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  return (
    <div data-grading>
      <h1 className="mb-4 text-2xl font-bold text-brand-900">التصحيح اليدوي</h1>
      {!items ? <p>جارٍ التحميل…</p> : items.length === 0 ? <p className="text-muted" data-grading-empty>لا توجد إجابات بانتظار التصحيح.</p> : (
        <ul className="space-y-4">{items.map((it) => <GradeItem key={it.attempt_id + it.exam_question_id} item={it} onDone={() => void load()} />)}</ul>
      )}
    </div>
  );
}

function GradeItem({ item, onDone }: { item: Item; onDone: () => void }) {
  const manual = item.parts.filter((p) => MANUAL_TYPES.includes(p.type) || item.part_scores?.[p.id] === null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const p: Record<string, number> = {};
    for (const part of manual) {
      const v = Number(scores[part.id]);
      if (scores[part.id] === undefined || scores[part.id] === "" || Number.isNaN(v) || v < 0 || v > part.marks) { setMsg(`درجة «${part.prompt ?? part.id}» بين ٠ و${arDigits(part.marks)}`); return; }
      p[part.id] = v;
    }
    const { error } = await getBrowserClient().rpc("grade_answer", { p_attempt: item.attempt_id, p_exam_question: item.exam_question_id, p_part_scores: p, p_feedback: feedback || undefined });
    if (error) setMsg(errorMessage(error)); else onDone();
  }

  return (
    <li className="rounded-xl border border-line bg-white p-4" data-grade-item>
      <p className="text-xs text-muted">{item.exam_title} · {fmt.format(new Date(item.submitted_at))} · <a className="underline" href={shellHref("attempts", item.attempt_id)}>المحاولة كاملة</a></p>
      <h2 className="mt-1 font-bold">{item.stem}</h2>
      {manual.map((part) => (
        <div key={part.id} className="mt-3 rounded-lg bg-paper p-3 text-sm">
          {part.prompt && <p className="font-medium">{part.prompt}</p>}
          <p className="mt-1 whitespace-pre-wrap"><span className="text-muted">إجابة المتعلم: </span>{responseText(part, item.response?.parts?.[part.id]).join("، ") || "—"}</p>
          {modelAnswerText(item.model_answer, part.id) && <p className="mt-1 text-brand-700"><b>الإجابة النموذجية: </b>{modelAnswerText(item.model_answer, part.id)}</p>}
          <label className="mt-2 flex items-center gap-2">الدرجة (من {arDigits(part.marks)}):
            <input type="number" min={0} max={part.marks} step="0.25" value={scores[part.id] ?? ""} onChange={(e) => setScores({ ...scores, [part.id]: e.target.value })}
              className="tap w-24 rounded border border-line px-2" aria-label={`درجة ${part.id}`} />
          </label>
        </div>
      ))}
      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder="ملاحظة للمتعلم (اختيارية)" className="mt-3 w-full rounded-lg border border-line p-2 text-sm" aria-label="ملاحظة للمتعلم" />
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
      <button type="button" onClick={() => void submit()} className="tap mt-2 rounded-lg bg-brand-700 px-5 text-white" data-grade-submit>اعتماد الدرجة</button>
    </li>
  );
}
