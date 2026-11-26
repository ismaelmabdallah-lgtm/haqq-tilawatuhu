"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { FieldInput, fromFormValue, toFormValue, type FormValue } from "@/components/admin/FieldInput";
import { StatusBadge, WorkflowPanel } from "@/components/admin/WorkflowPanel";
import { PartInput } from "@/components/exam/PartInput";
import { QuranVerseClient } from "@/components/quran/QuranVerseClient";
import type { PartResponse } from "@/domain/exams/types";
import { promptSchema, validateKey, type Prompt } from "@/domain/questions/schema";
import { maqtuMawsulQuestion, raaQuestion, taAnitheQuestion, tablePart } from "@/domain/questions/templates";
import { isEditable, type ContentStatus, type Field } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";
import { errorMessage } from "@/lib/errors";
import { fromPromptRef } from "@/lib/quran/ref";
import { isUuid } from "@/lib/shell-route";
import { getBrowserClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type Version = { id: string; version_no: number; status: ContentStatus; prompt: Prompt; created_by: string | null; origin: string; source_edition_id: string | null; source_page_start: number | null; source_page_end: number | null };

const SCOPE: Field[] = [
  { name: "lesson_id", label: "الدرس", type: "ref", lookup: "lessons" },
  { name: "chapter_id", label: "الباب", type: "ref", lookup: "chapters" },
  { name: "level_id", label: "المستوى", type: "ref", lookup: "levels" },
  { name: "edition_id", label: "طبعة المنهج", type: "ref", lookup: "editions" },
  { name: "difficulty", label: "الصعوبة (1–5)", type: "int", min: 1, max: 5, required: true },
  { name: "tags", label: "وسوم (وسم في كل سطر)", type: "lines" },
];
/** Hidden in v1 (they need manual grading); still supported by the database and the exam player. */
const V1_DISABLED_TYPES: string[] = ["long_text", "audio_response"];

const PROVENANCE: Field[] = [
  { name: "origin", label: "مصدر السؤال", type: "select", required: true, options: [["independent_material", "مادة مستقلة"], ["curriculum_quoted", "منقول من المنهج"], ["supplementary_explanation", "شرح مساند"]] },
  { name: "source_edition_id", label: "طبعة المنهج", type: "ref", lookup: "editions" },
  { name: "source_page_start", label: "من صفحة", type: "int", min: 1 },
  { name: "source_page_end", label: "إلى صفحة", type: "int", min: 1 },
];

const TEMPLATES: { label: string; make: () => { prompt: Prompt; key: Row } }[] = [
  { label: "اختيار من متعدد", make: () => ({ prompt: { stem: "نص السؤال", parts: [{ id: "p1", type: "single_choice", marks: 1, options: [{ id: "a", text: "الخيار الأول" }, { id: "b", text: "الخيار الثاني" }] }] }, key: { p1: { correct: "a" } } }) },
  { label: "صواب/خطأ", make: () => ({ prompt: { stem: "عبارة للحكم عليها", parts: [{ id: "p1", type: "true_false", marks: 1 }] }, key: { p1: { correct: true } } }) },
  { label: "أحكام الراء (وصل/وقف/سبب)", make: () => ({ prompt: raaQuestion("الكلمة", { surah: 1, ayah: 1 }), key: { wasl: { correct: "tafkheem" }, waqf: { correct: "tafkheem" }, reason: { accepted: ["السبب"], manual_if_unmatched: true } } }) },
  { label: "المقطوع والموصول", make: () => ({ prompt: maqtuMawsulQuestion("الكلمات", { surah: 1, ayah: 1 }), key: { rasm: { correct: "maqtu" } } }) },
  { label: "هاء/تاء التأنيث", make: () => ({ prompt: taAnitheQuestion("الكلمة", { surah: 1, ayah: 1 }), key: { rasm: { correct: "haa" } } }) },
  { label: "إكمال جدول", make: () => ({ prompt: { stem: "أكمل الجدول", parts: [tablePart("t1", ["الحكم"], ["الحالة الأولى", "الحالة الثانية"], 2)] }, key: { t1: { slots: { "r1:c1": "", "r2:c1": "" }, scoring: "partial" } } }) },
  { label: "اختيار متعدد (درجات جزئية)", make: () => ({ prompt: { stem: "اختر كل ما ينطبق", parts: [{ id: "p1", type: "multiple_choice", marks: 2, options: [{ id: "a", text: "الأول" }, { id: "b", text: "الثاني" }, { id: "c", text: "الثالث" }] }] }, key: { p1: { correct: ["a", "b"], scoring: "partial" } } }) },
  { label: "إكمال الفراغ", make: () => ({ prompt: { stem: "أكمل", parts: [{ id: "p1", type: "fill_blank", marks: 2, text: "أحكام النون الساكنة: الإظهار و{b1} والإقلاب و{b2}" }] }, key: { p1: { slots: { b1: "الإدغام", b2: "الإخفاء" }, scoring: "partial" } } }) },
  { label: "سحب الكلمات وإفلاتها", make: () => ({ prompt: { stem: "ضع الكلمة المناسبة", parts: [{ id: "p1", type: "drag_drop", marks: 1, text: "يُقلب التنوين ميمًا عند {s1}", options: [{ id: "o1", text: "الباء" }, { id: "o2", text: "الميم" }] }] }, key: { p1: { slots: { s1: "o1" } } } }) },
  { label: "توصيل", make: () => ({ prompt: { stem: "صِل كل حكم بحروفه", parts: [{ id: "p1", type: "matching", marks: 2, left: [{ id: "l1", text: "الإظهار" }, { id: "l2", text: "الإقلاب" }], right: [{ id: "r1", text: "حروف الحلق" }, { id: "r2", text: "الباء" }] }] }, key: { p1: { slots: { l1: "r1", l2: "r2" }, scoring: "partial" } } }) },
  { label: "ترتيب", make: () => ({ prompt: { stem: "رتّب", parts: [{ id: "p1", type: "ordering", marks: 2, items: [{ id: "a", text: "الأول" }, { id: "b", text: "الثاني" }, { id: "c", text: "الثالث" }] }] }, key: { p1: { order: ["a", "b", "c"], scoring: "partial" } } }) },
];

export default function QuestionEditPage() {
  const id = useSearchParams().get("id");
  if (id && !isUuid(id)) return <p>معرّف غير صالح.</p>;
  return <QuestionEditor key={id ?? "new"} questionId={id} />;
}

function QuestionEditor({ questionId }: { questionId: string | null }) {
  const { userId } = useAdmin();
  const [question, setQuestion] = useState<Row | null | undefined>(questionId ? undefined : null);
  const [scope, setScope] = useState<Record<string, FormValue>>(() => Object.fromEntries(SCOPE.map((f) => [f.name, toFormValue(f, f.name === "difficulty" ? 2 : null)])));
  const [versions, setVersions] = useState<Version[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!questionId) return;
    const [q, vs] = await Promise.all([
      table("questions").select("*").eq("id", questionId).maybeSingle(),
      table<Version>("question_versions").select("id,version_no,status,prompt,created_by,origin,source_edition_id,source_page_start,source_page_end").eq("question_id", questionId).order("version_no", { ascending: false }),
    ]);
    setQuestion(q.data ?? null);
    if (q.data) setScope(Object.fromEntries(SCOPE.map((f) => [f.name, toFormValue(f, q.data![f.name])])));
    setVersions(vs.data ?? []);
  }, [questionId]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  async function saveScope() {
    const payload: Row = {};
    for (const f of SCOPE) { const [v, err] = fromFormValue(f, scope[f.name] ?? ""); if (err) { setMsg({ ok: false, text: `${f.label}: ${err}` }); return; } payload[f.name] = v; }
    if (!questionId) {
      const { data, error } = await table("questions").insert({ ...payload, created_by: userId }).select("id").single();
      if (error || !data) { setMsg({ ok: false, text: errorMessage(error) }); return; }
      const t = TEMPLATES[0]!.make();
      const v = await table("question_versions").insert({ question_id: data.id, version_no: 1, prompt: t.prompt, created_by: userId }).select("id").single();
      if (v.data) await table("question_keys").insert({ question_version_id: v.data.id, key: t.key });
      window.location.replace(`/admin/questions/edit/?id=${String(data.id)}`);
      return;
    }
    const { error } = await table("questions").update(payload).eq("id", questionId);
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "تم حفظ نطاق السؤال." });
  }

  async function newVersion() {
    const { error } = await getBrowserClient().rpc("new_question_version", { p_question: questionId! });
    if (error) setMsg({ ok: false, text: errorMessage(error) }); else void load();
  }

  if (questionId && question === undefined) return <p>جارٍ التحميل…</p>;
  if (questionId && question === null) return <p className="text-danger">السؤال غير موجود.</p>;
  const latest = versions[0];

  return (
    <div className="space-y-4" data-question-editor>
      <Link href="/admin/questions/" className="tap inline-flex items-center text-sm text-brand-700">→ بنك الأسئلة</Link>
      <h1 className="text-2xl font-bold text-brand-900">{questionId ? "تحرير سؤال" : "سؤال جديد"}</h1>
      <section className="space-y-3 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">النطاق</h2>
        {SCOPE.map((f) => <FieldInput key={f.name} field={f} value={scope[f.name] ?? ""} onChange={(v) => setScope((s) => ({ ...s, [f.name]: v }))} />)}
        <button type="button" onClick={() => void saveScope()} className="tap rounded-lg bg-brand-700 px-5 text-white" data-save-scope>{questionId ? "حفظ النطاق" : "إنشاء السؤال"}</button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      </section>

      {questionId && latest && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>الإصدارات:</span>
            {versions.map((v) => <span key={v.id} className="flex items-center gap-1 rounded bg-white px-2 py-1">رقم {v.version_no} <StatusBadge status={v.status} /></span>)}
            {latest.status === "published" && <button type="button" onClick={() => void newVersion()} className="tap rounded-lg border border-brand-500 px-3 text-brand-700">إنشاء إصدار جديد للتصحيح</button>}
          </div>
          <VersionEditor key={latest.id + latest.status} version={latest} onChanged={() => void load()} />
        </>
      )}
    </div>
  );
}

function VersionEditor({ version, onChanged }: { version: Version; onChanged: () => void }) {
  const editable = isEditable(version.status);
  const [promptText, setPromptText] = useState(JSON.stringify(version.prompt, null, 2));
  const [keyText, setKeyText] = useState("{}");
  const [modelText, setModelText] = useState("{}");
  const [explanation, setExplanation] = useState("");
  const [prov, setProv] = useState<Record<string, FormValue>>(() => Object.fromEntries(PROVENANCE.map((f) => [f.name, toFormValue(f, version[f.name as keyof Version])])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<Record<string, PartResponse | undefined>>({});

  useEffect(() => {
    let alive = true;
    void table("question_keys").select("*").eq("question_version_id", version.id).maybeSingle().then(({ data }) => {
      if (!alive || !data) return;
      setKeyText(JSON.stringify(data.key ?? {}, null, 2)); setModelText(JSON.stringify(data.model_answer ?? {}, null, 2)); setExplanation(String(data.explanation ?? ""));
    });
    return () => { alive = false; };
  }, [version.id]);

  const parsed = useMemo(() => {
    let raw: unknown; let key: Record<string, unknown> = {};
    try { raw = JSON.parse(promptText); } catch { return { errors: ["نص السؤال: JSON غير صالح"] }; }
    const p = promptSchema.safeParse(raw);
    if (!p.success) return { errors: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
    // v1: every question must be auto-graded (no manual grading queue).
    const manual = p.data.parts.filter((part) => V1_DISABLED_TYPES.includes(part.type));
    if (manual.length) return { prompt: p.data, errors: manual.map((part) => `${part.id}: الأسئلة المقالية والصوتية غير مفعّلة في هذا الإصدار (تتطلب تصحيحًا يدويًا)`) };
    try { key = JSON.parse(keyText) as Record<string, unknown>; } catch { return { prompt: p.data, errors: ["المفتاح: JSON غير صالح"] }; }
    return { prompt: p.data, errors: validateKey(p.data, key) };
  }, [promptText, keyText]);

  async function save() {
    if (!parsed.prompt || parsed.errors.length) { setMsg({ ok: false, text: "صحّح الأخطاء أولًا." }); return; }
    let model: unknown;
    try { model = JSON.parse(modelText || "{}"); } catch { setMsg({ ok: false, text: "الإجابة النموذجية: JSON غير صالح" }); return; }
    const provPayload: Row = {};
    for (const f of PROVENANCE) { const [v, err] = fromFormValue(f, prov[f.name] ?? ""); if (err) { setMsg({ ok: false, text: `${f.label}: ${err}` }); return; } provPayload[f.name] = v; }
    const up = await table("question_versions").update({ prompt: parsed.prompt, ...provPayload }).eq("id", version.id);
    if (up.error) { setMsg({ ok: false, text: errorMessage(up.error) }); return; }
    const keyRow = { key: JSON.parse(keyText), model_answer: model, explanation: explanation || null };
    const existing = await table("question_keys").select("question_version_id").eq("question_version_id", version.id).maybeSingle();
    const k = existing.data
      ? await table("question_keys").update(keyRow).eq("question_version_id", version.id)
      : await table("question_keys").insert({ question_version_id: version.id, ...keyRow });
    setMsg(k.error ? { ok: false, text: errorMessage(k.error) } : { ok: true, text: "تم الحفظ." });
    if (!k.error) onChanged();
  }

  return (
    <div className="space-y-4" data-version-editor>
      <WorkflowPanel entity="question_versions" id={version.id} status={version.status} authorId={version.created_by} onChanged={onChanged} />
      {!editable && <p className="rounded-lg bg-gold-100 p-3 text-sm text-gold-700">هذا الإصدار مجمّد. للتصحيح أنشئ إصدارًا جديدًا (الإصدارات المنشورة لا تتغير حتى لا تتأثر المحاولات السابقة).</p>}
      {editable && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm">قوالب:</span>
          {TEMPLATES.map((t) => (
            <button key={t.label} type="button" className="tap rounded-full border border-line bg-white px-3 text-xs"
              onClick={() => { const m = t.make(); setPromptText(JSON.stringify(m.prompt, null, 2)); setKeyText(JSON.stringify(m.key, null, 2)); }}>{t.label}</button>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-medium">نص السؤال (بلا أي بيانات إجابة)
            <textarea dir="ltr" rows={16} value={promptText} disabled={!editable} onChange={(e) => setPromptText(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-2 font-mono text-xs" data-prompt-json />
          </label>
          <p className="text-xs text-muted">الآيات تُضاف عبر <code dir="ltr">{`"quran_ref": {"surah": 2, "ayah": 121}`}</code> — لا تكتب النص القرآني داخل السؤال.</p>
          <label className="block text-sm font-medium">مفتاح الإجابة (يبقى في قاعدة البيانات)
            <textarea dir="ltr" rows={8} value={keyText} disabled={!editable} onChange={(e) => setKeyText(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-2 font-mono text-xs" data-key-json />
          </label>
          <label className="block text-sm font-medium">إجابة نموذجية (اختيارية، لكل جزء: {"{"}&quot;p1&quot;: {"{"}&quot;text&quot;: &quot;…&quot;{"}}"})
            <textarea dir="ltr" rows={3} value={modelText} disabled={!editable} onChange={(e) => setModelText(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-2 font-mono text-xs" />
          </label>
          <label className="block text-sm font-medium">الشرح بعد التصحيح
            <textarea rows={2} value={explanation} disabled={!editable} onChange={(e) => setExplanation(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-2 text-sm" />
          </label>
          {PROVENANCE.map((f) => <FieldInput key={f.name} field={f} value={prov[f.name] ?? ""} disabled={!editable} onChange={(v) => setProv((s) => ({ ...s, [f.name]: v }))} />)}
          {parsed.errors.length > 0 && <ul className="rounded bg-red-50 p-2 text-xs text-danger" role="alert" data-validation-errors>{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
          {editable && <button type="button" onClick={() => void save()} className="tap rounded-lg bg-brand-700 px-6 font-bold text-white" data-save-version>حفظ الإصدار</button>}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">معاينة كما يراها المتعلم</p>
          {parsed.prompt ? (
            <article className="rounded-xl border border-line bg-white p-4" data-question-preview>
              <h3 className="mb-2 font-bold">{parsed.prompt.stem}</h3>
              {parsed.prompt.quran_ref && <QuranVerseClient quranRef={fromPromptRef(parsed.prompt.quran_ref)} />}
              <div className="space-y-4">
                {parsed.prompt.parts.map((p) => (
                  <div key={p.id}>
                    {p.prompt && <p className="mb-1 text-sm">{p.prompt}</p>}
                    <PartInput part={p} name={`pv-${p.id}`} value={preview[p.id]} onChange={(v) => setPreview((s) => ({ ...s, [p.id]: v }))} />
                  </div>
                ))}
              </div>
            </article>
          ) : <p className="text-sm text-muted">صحّح نص السؤال لعرض المعاينة.</p>}
        </div>
      </div>
    </div>
  );
}
