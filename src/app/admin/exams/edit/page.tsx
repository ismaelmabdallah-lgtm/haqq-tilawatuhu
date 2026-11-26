"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { FieldInput, fromFormValue, toFormValue, type FormValue } from "@/components/admin/FieldInput";
import type { Field } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";
import { errorMessage } from "@/lib/errors";
import { arDigits } from "@/lib/quran/ref";
import { isUuid, shellHref } from "@/lib/shell-route";
import { getBrowserClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type EQ = { id: string; question_version_id: string; sort_order: number; is_required: boolean; section: string | null };
type V = { id: string; version_no: number; total_marks: number; prompt: { stem?: string } };

const STATUS: Record<string, string> = { draft: "مسودة", published: "منشور", closed: "مغلق", archived: "مؤرشف" };

const FIELDS: Field[] = [
  { name: "title", label: "العنوان", type: "text", required: true },
  { name: "slug", label: "رابط مختصر (اختياري، حروف لاتينية)", type: "text", dir: "ltr" },
  { name: "description", label: "الوصف", type: "textarea" },
  { name: "kind", label: "النوع", type: "select", required: true, options: [["practice", "تدريب (النتيجة فورية دائمًا)"], ["formal", "اختبار رسمي"]] },
  { name: "edition_id", label: "طبعة المنهج", type: "ref", lookup: "editions" },
  { name: "level_id", label: "المستوى", type: "ref", lookup: "levels" },
  { name: "chapter_id", label: "الباب", type: "ref", lookup: "chapters" },
  { name: "lesson_id", label: "الدرس", type: "ref", lookup: "lessons" },
  { name: "requires_account", label: "يتطلب حسابًا (لتقييد المحاولات)", type: "bool" },
  { name: "is_level_final", label: "اختبار نهائي للمستوى (يُحتسب للشهادة، يتطلب حسابًا)", type: "bool" },
  { name: "pass_percent", label: "نسبة النجاح ٪", type: "int", min: 0, max: 100, required: true },
  { name: "time_limit_minutes", label: "المدة بالدقائق (فارغ = بلا حد)", type: "int", min: 1, max: 600 },
  { name: "max_attempts", label: "أقصى عدد محاولات (للحسابات فقط)", type: "int", min: 1, max: 100 },
  { name: "opens_at", label: "يُفتح في", type: "datetime" },
  { name: "closes_at", label: "يُغلق في", type: "datetime" },
  { name: "shuffle_questions", label: "ترتيب عشوائي للأسئلة", type: "bool" },
  { name: "shuffle_options", label: "ترتيب عشوائي للخيارات", type: "bool" },
  { name: "result_release", label: "إعلان النتيجة", type: "select", required: true, options: [["immediate", "فور التسليم"], ["on_date", "في موعد محدد"], ["manual", "يدويًا"]] },
  { name: "results_release_at", label: "موعد إعلان النتيجة", type: "datetime" },
  { name: "model_answer_visibility", label: "عرض الإجابات النموذجية", type: "select", required: true, options: [["after_submission", "بعد التسليم"], ["after_release", "بعد إعلان النتيجة"], ["after_exam_end", "بعد إغلاق الاختبار"], ["never", "لا تُعرض"]] },
];
const DEFAULTS: Row = { kind: "practice", pass_percent: 60, shuffle_options: true, shuffle_questions: false, result_release: "immediate", model_answer_visibility: "after_submission", requires_account: false, is_level_final: false };

export default function ExamEditPage() {
  const id = useSearchParams().get("id");
  if (id && !isUuid(id)) return <p>معرّف غير صالح.</p>;
  return <ExamEditor key={id ?? "new"} examId={id} />;
}

function ExamEditor({ examId }: { examId: string | null }) {
  const { userId } = useAdmin();
  const [exam, setExam] = useState<Row | null | undefined>(examId ? undefined : null);
  const [values, setValues] = useState<Record<string, FormValue>>(() => Object.fromEntries(FIELDS.map((f) => [f.name, toFormValue(f, DEFAULTS[f.name] ?? null)])));
  const [paper, setPaper] = useState<EQ[]>([]);
  const [versions, setVersions] = useState<V[]>([]);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const pub = await table<V>("question_versions").select("id,version_no,total_marks,prompt").eq("status", "published").eq("scientifically_verified", true).limit(2000);
    setVersions(pub.data ?? []);
    if (!examId) return;
    const [e, eq] = await Promise.all([
      table("exams").select("*").eq("id", examId).maybeSingle(),
      table<EQ>("exam_questions").select("id,question_version_id,sort_order,is_required,section").eq("exam_id", examId).order("sort_order"),
    ]);
    setExam(e.data ?? null);
    if (e.data) setValues(Object.fromEntries(FIELDS.map((f) => [f.name, toFormValue(f, e.data![f.name])])));
    setPaper(eq.data ?? []);
  }, [examId]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  if (examId && exam === undefined) return <p>جارٍ التحميل…</p>;
  if (examId && exam === null) return <p className="text-danger">الاختبار غير موجود.</p>;
  const status = String(exam?.status ?? "draft");
  const draft = status === "draft";
  const vById = new Map(versions.map((v) => [v.id, v]));
  const total = paper.reduce((n, p) => n + Number(vById.get(p.question_version_id)?.total_marks ?? 0), 0);

  async function save() {
    const payload: Row = {};
    for (const f of FIELDS) { const [v, err] = fromFormValue(f, values[f.name] ?? ""); if (err) { setMsg({ ok: false, text: `${f.label}: ${err}` }); return; } payload[f.name] = v; }
    if (payload.is_level_final) payload.requires_account = true;
    if (!examId) {
      const { data, error } = await table("exams").insert({ ...payload, created_by: userId }).select("id").single();
      if (error || !data) { setMsg({ ok: false, text: errorMessage(error) }); return; }
      window.location.replace(`/admin/exams/edit/?id=${String(data.id)}`);
      return;
    }
    // Published exams are frozen except these columns (tg_exam_guard).
    const body = draft ? payload : { closes_at: payload.closes_at, results_release_at: payload.results_release_at, model_answer_visibility: payload.model_answer_visibility };
    const { error } = await table("exams").update(body).eq("id", examId);
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "تم الحفظ." });
  }
  async function act(fn: () => PromiseLike<{ error: { message: string; code?: string } | null }>, ok: string) {
    const { error } = await fn();
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: ok });
    if (!error) void load();
  }
  const sb = getBrowserClient();

  return (
    <div className="space-y-4" data-exam-editor>
      <Link href="/admin/exams/" className="tap inline-flex items-center text-sm text-brand-700">→ الاختبارات</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-900">{examId ? String(exam?.title) : "اختبار جديد"}</h1>
        {examId && <span className="rounded bg-gold-100 px-2 text-sm text-gold-700" data-exam-status={status}>{STATUS[status]}</span>}
        {examId && status !== "draft" && <a href={shellHref("exams", examId)} className="text-sm text-brand-700 underline">صفحة الاختبار العامة</a>}
      </div>

      {examId && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-white p-3">
          {draft && <button type="button" data-publish-exam className="tap rounded-lg bg-brand-700 px-4 text-white" onClick={() => void act(() => sb.rpc("publish_exam", { p_exam: examId }), "نُشر الاختبار.")}>نشر الاختبار</button>}
          {status === "published" && <button type="button" className="tap rounded-lg border border-line px-4" onClick={() => void act(() => sb.rpc("set_exam_status", { p_exam: examId, p_status: "closed" }), "أُغلق الاختبار.")}>إغلاق</button>}
          {status === "closed" && <button type="button" className="tap rounded-lg border border-line px-4" onClick={() => void act(() => sb.rpc("set_exam_status", { p_exam: examId, p_status: "published" }), "أُعيد فتح الاختبار.")}>إعادة فتح</button>}
          {status !== "archived" && <button type="button" className="tap rounded-lg border border-danger px-4 text-danger" onClick={() => void act(() => sb.rpc("set_exam_status", { p_exam: examId, p_status: "archived" }), "أُرشف الاختبار.")}>أرشفة</button>}
          {exam?.result_release === "manual" && !exam?.results_released && status !== "draft" && (
            <button type="button" className="tap rounded-lg border border-brand-500 px-4 text-brand-700" onClick={() => void act(() => sb.rpc("release_results", { p_exam: examId }), "أُعلنت النتائج.")}>إعلان النتائج</button>
          )}
          {!draft && <p className="w-full text-xs text-muted">إعدادات الاختبار المنشور وورقته مجمّدة؛ يمكن فقط تغيير موعد الإغلاق وإعلان النتائج وعرض الإجابات.</p>}
        </div>
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}

      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.name} className={["title", "description"].includes(f.name) ? "sm:col-span-2" : ""}>
            <FieldInput field={f} value={values[f.name] ?? ""} disabled={!draft && !["closes_at", "results_release_at", "model_answer_visibility"].includes(f.name)}
              onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
          </div>
        ))}
        <button type="submit" className="tap rounded-lg bg-brand-700 px-6 font-bold text-white sm:col-span-2 sm:w-fit" data-save-exam>{examId ? "حفظ الإعدادات" : "إنشاء الاختبار"}</button>
      </form>

      {examId && (
        <section className="rounded-xl border border-line bg-white p-4" data-exam-paper>
          <h2 className="mb-2 font-bold">ورقة الاختبار — {arDigits(paper.length)} سؤال، {arDigits(total)} درجة</h2>
          <ol className="space-y-2">
            {paper.map((p, i) => {
              const v = vById.get(p.question_version_id);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 rounded bg-paper p-2 text-sm">
                  <span className="font-bold">{arDigits(i + 1)}.</span>
                  <span className="flex-1">{v?.prompt.stem ?? p.question_version_id} <span className="text-xs text-muted">({arDigits(Number(v?.total_marks ?? 0))} درجة)</span></span>
                  {draft && (
                    <>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.is_required} onChange={(e) => void act(() => table("exam_questions").update({ is_required: e.target.checked }).eq("id", p.id), "تم.")} /> إلزامي</label>
                      <button type="button" className="tap" aria-label="لأعلى" disabled={i === 0} onClick={() => void reorder(i, -1)}>▲</button>
                      <button type="button" className="tap" aria-label="لأسفل" disabled={i === paper.length - 1} onClick={() => void reorder(i, 1)}>▼</button>
                      <button type="button" className="tap text-danger" aria-label="إزالة" onClick={() => void act(() => table("exam_questions").delete().eq("id", p.id), "أُزيل السؤال.")}>✕</button>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          {draft && (
            <div className="mt-3 flex flex-wrap gap-2">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="tap min-w-60 flex-1 rounded-lg border border-line px-2 text-sm" aria-label="إضافة سؤال منشور">
                <option value="">— أضف سؤالًا منشورًا ومراجَعًا —</option>
                {versions.filter((v) => !paper.some((p) => p.question_version_id === v.id)).map((v) => <option key={v.id} value={v.id}>{(v.prompt.stem ?? "").slice(0, 90)} (إ{v.version_no})</option>)}
              </select>
              <button type="button" className="tap rounded-lg border border-brand-500 px-3 text-sm text-brand-700" data-add-question
                onClick={() => pick && void act(() => table("exam_questions").insert({ exam_id: examId, question_version_id: pick, sort_order: paper.length + 1 }), "أُضيف السؤال.").then(() => setPick(""))}>إضافة</button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">لا يمكن إضافة إلا إصدارات أسئلة منشورة ومراجَعة علميًا (تتحقق قاعدة البيانات من ذلك).</p>
        </section>
      )}
    </div>
  );

  async function reorder(i: number, d: -1 | 1) {
    const a = paper[i]!, b = paper[i + d]!;
    await table("exam_questions").update({ sort_order: b.sort_order }).eq("id", a.id);
    await table("exam_questions").update({ sort_order: a.sort_order }).eq("id", b.id);
    void load();
  }
}
