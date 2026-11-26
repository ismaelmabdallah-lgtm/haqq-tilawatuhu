"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PartInput } from "@/components/exam/PartInput";
import { ResourceItem, type ResourceView } from "@/components/content/ResourceItem";
import { QuranVerseClient } from "@/components/quran/QuranVerseClient";
import { isAnswered, MANUAL_TYPES, type Paper, type PartResponse, type QuestionResponse } from "@/domain/exams/types";
import { draftStore } from "@/lib/exams/attempt-store";
import { examApi } from "@/lib/exams/api";
import { errorMessage } from "@/lib/errors";
import { fromPromptRef, arDigits } from "@/lib/quran/ref";
import { getBrowserClient } from "@/lib/supabase/client";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function initialAnswers(paper: Paper): Record<string, QuestionResponse> {
  const drafts = draftStore.get(paper.attempt_id);
  const out: Record<string, QuestionResponse> = {};
  for (const q of paper.questions) {
    const d = drafts[q.exam_question_id] as QuestionResponse | undefined;
    const r = d ?? q.response;
    if (r && typeof r === "object" && r.parts) out[q.exam_question_id] = r;
  }
  return out;
}

function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${arDigits(m)}:${arDigits(String(s % 60).padStart(2, "0"))}`;
}

export function ExamPlayer({ paper, token, onFinished }: { paper: Paper; token?: string; onFinished: () => void }) {
  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>(() => initialAnswers(paper));
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const answersRef = useRef(answers);   // source of truth for saves/submit; `answers` drives rendering

  // ---- media referenced by questions (published resources only, via RLS)
  const [media, setMedia] = useState<ResourceView[]>([]);
  const mediaIds = useMemo(() => [...new Set(paper.questions.flatMap((q) => (q.media ?? []).map((m) => m.resource_id)))], [paper]);
  useEffect(() => {
    if (!mediaIds.length) return;
    void getBrowserClient().from("resources").select("*").in("id", mediaIds).then(({ data }) => setMedia(data ?? []));
  }, [mediaIds]);

  // ---- autosave (debounced per question; drafts survive refresh until saved)
  const save = useCallback(async (eqId: string, resp: QuestionResponse) => {
    setSaveState((s) => ({ ...s, [eqId]: "saving" }));
    const { error: err } = await examApi.save(paper.attempt_id, eqId, resp, token);
    if (err) {
      setSaveState((s) => ({ ...s, [eqId]: "error" }));
      if (/already submitted|time is over/.test(err.message)) onFinished();
      return;
    }
    draftStore.clearOne(paper.attempt_id, eqId, resp);
    setSaveState((s) => ({ ...s, [eqId]: "saved" }));
  }, [paper.attempt_id, token, onFinished]);

  function setPart(eqId: string, partId: string, v: PartResponse | undefined) {
    const prev = answersRef.current;
    const parts = { ...(prev[eqId]?.parts ?? {}) };
    if (v === undefined) delete parts[partId]; else parts[partId] = v;
    const resp: QuestionResponse = { parts };
    const next = { ...prev, [eqId]: resp };
    answersRef.current = next;
    setAnswers(next);
    draftStore.set(paper.attempt_id, eqId, resp);
    clearTimeout(timers.current[eqId]);
    timers.current[eqId] = setTimeout(() => void save(eqId, resp), 700);
    setSaveState((s) => ({ ...s, [eqId]: "pending" }));
  }

  // ---- timer from server time (deadline enforced server-side; 30 s grace there)
  const [offset] = useState(() => Date.parse(paper.server_now) - Date.now());
  const deadline = paper.deadline_at ? Date.parse(paper.deadline_at) : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  const remaining = deadline ? deadline - (now + offset) : null;

  const submit = useCallback(async () => {
    setSubmitting(true); setError(null); setConfirming(false);
    Object.values(timers.current).forEach(clearTimeout);
    const { error: err } = await examApi.submit(paper.attempt_id, answersRef.current, token);
    setSubmitting(false);
    if (err) { setError(errorMessage(err)); return; }
    draftStore.clear(paper.attempt_id);
    onFinished();
  }, [paper.attempt_id, token, onFinished]);

  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [remaining, submit]);

  // ---- progress
  const answerable = (q: Paper["questions"][number]) => q.parts.filter((p) => p.type !== "audio_response");
  const done = (q: Paper["questions"][number]) => {
    const parts = answers[q.exam_question_id]?.parts ?? {};
    const ps = answerable(q);
    return ps.length > 0 && ps.some((p) => isAnswered(p, parts[p.id]));
  };
  const answeredCount = paper.questions.filter(done).length;
  const missingRequired = paper.questions.filter((q) => q.required && answerable(q).length > 0 && !done(q));
  const states = Object.values(saveState);
  const saveLabel = states.includes("error") ? "تعذر حفظ بعض الإجابات — ستُرسل عند التسليم"
    : states.some((s) => s === "saving" || s === "pending") ? "جارٍ الحفظ…" : states.includes("saved") ? "تم حفظ إجاباتك" : "";
  const sectionStarts = paper.questions.map((q, i) => Boolean(q.section) && q.section !== paper.questions[i - 1]?.section);

  return (
    <div data-exam-player>
      <div className="sticky top-14 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur">
        <span className="text-sm">أجبت عن <b>{arDigits(answeredCount)}</b> من {arDigits(paper.questions.length)}</span>
        <span className="text-xs text-muted" aria-live="polite" data-save-state>{saveLabel}</span>
        {remaining !== null && (
          <span className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${remaining < 60_000 ? "bg-red-50 text-danger" : "bg-brand-50 text-brand-700"}`}
            role="timer" aria-label="الوقت المتبقي">⏱ {formatClock(remaining)}</span>
        )}
      </div>

      <ol className="space-y-5">
        {paper.questions.map((q, qi) => {
          const showSection = sectionStarts[qi];
          const qMedia = (q.media ?? []).map((m) => media.find((r) => r.id === m.resource_id)).filter((r) => r !== undefined);
          return (
            <li key={q.exam_question_id} id={`q-${qi + 1}`} data-question={q.exam_question_id}>
              {showSection && <h2 className="mb-2 mt-4 text-lg font-bold text-gold-700">{q.section}</h2>}
              <article className="rounded-xl border border-line bg-white p-4">
                <header className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="font-bold leading-relaxed">
                    <span className="text-brand-700">{arDigits(qi + 1)}. </span>{q.stem}
                    {q.required && <span className="ms-1 text-danger" aria-label="إلزامي">*</span>}
                  </h3>
                  <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-700">{arDigits(q.marks)} درجة</span>
                </header>
                {q.quran_ref && <QuranVerseClient quranRef={fromPromptRef(q.quran_ref)} />}
                {qMedia.length > 0 && <ul className="mb-3 space-y-2">{qMedia.map((r) => <ResourceItem key={r.id} r={r} />)}</ul>}
                <div className="space-y-4">
                  {q.parts.map((p) => (
                    <div key={p.id} data-part={p.type}>
                      {(p.prompt || q.parts.length > 1) && (
                        <p className="mb-2 text-sm font-medium">
                          {p.prompt}
                          {q.parts.length > 1 && <span className="ms-2 text-xs text-muted">({arDigits(p.marks)} درجة{MANUAL_TYPES.includes(p.type) ? "، تصحيح يدوي" : ""})</span>}
                        </p>
                      )}
                      <PartInput part={p} name={`${q.exam_question_id}-${p.id}`} disabled={submitting}
                        value={answers[q.exam_question_id]?.parts[p.id]} onChange={(v) => setPart(q.exam_question_id, p.id, v)} />
                    </div>
                  ))}
                </div>
              </article>
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-danger">{error}</p>}

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        {confirming ? (
          <div>
            {missingRequired.length > 0 ? (
              <p className="text-danger">
                لم تُجب عن {arDigits(missingRequired.length)} سؤال إلزامي:{" "}
                {missingRequired.map((q) => { const n = paper.questions.indexOf(q) + 1; return <a key={q.exam_question_id} href={`#q-${n}`} className="mx-1 underline">{arDigits(n)}</a>; })}
              </p>
            ) : <p>هل أنت متأكد من تسليم الاختبار؟ لا يمكن تعديل الإجابات بعد التسليم.</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void submit()} disabled={submitting || missingRequired.length > 0}
                className="tap rounded-lg bg-brand-700 px-5 font-bold text-white disabled:opacity-50">{submitting ? "جارٍ التسليم…" : "تأكيد التسليم"}</button>
              <button type="button" onClick={() => setConfirming(false)} className="tap rounded-lg border border-line px-4">رجوع</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} disabled={submitting}
            className="tap w-full rounded-lg bg-brand-700 px-5 font-bold text-white sm:w-auto">تسليم الاختبار</button>
        )}
      </div>
    </div>
  );
}
