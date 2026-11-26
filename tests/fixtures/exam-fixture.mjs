/**
 * Single source of truth for TEST exam data, used by:
 *   - tests/fixtures/make-test-seed.mjs → scripts/test_seed.sql (+ cleanup) for the live DB (run by a human)
 *   - tests/e2e/fake-supabase.mjs        → in-memory stand-in for the exam RPCs in Playwright
 * Every title is marked «[تجريبي]». Quranic text is never typed: questions use quran_ref.
 */
import { createHash } from "node:crypto";

/** Same as Postgres md5('…')::uuid */
export const testId = (name) => {
  const h = createHash("md5").update(`haqq:test:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
export const seedId = (name) => {
  const h = createHash("md5").update(name).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// Rows from supabase/seed/0001_minhaj_al_darisin.sql (must be applied first).
export const SEED = {
  edition: seedId("haqq:edition:minhaj-al-darisin-ed2-2026"),
  riwayah: seedId("haqq:riwayah:hafs-asim-shatibiyyah"),
  level1: seedId("haqq:level:minhaj-al-darisin-ed2-2026:l1"),
  chapterL1C2: seedId("haqq:chapter:minhaj-al-darisin-ed2-2026:l1-c2"),
};

const T = "[تجريبي] ";
const opt = (id, text) => ({ id, text });

export const QUESTIONS = {
  q1: { prompt: { stem: `${T}كم عدد أحكام النون الساكنة والتنوين؟`, parts: [{ id: "p1", type: "single_choice", marks: 1, options: [opt("a", "ثلاثة"), opt("b", "أربعة"), opt("c", "خمسة")] }] },
    key: { p1: { correct: "b" } }, explanation: "الإظهار والإدغام والإقلاب والإخفاء." },
  q2: { prompt: { stem: `${T}اختر حروف الحلق من بين ما يلي:`, parts: [{ id: "p1", type: "multiple_choice", marks: 2, options: [opt("hamza", "الهمزة"), opt("haa", "الهاء"), opt("baa", "الباء"), opt("meem", "الميم")] }] },
    key: { p1: { correct: ["hamza", "haa"], scoring: "partial" } } },
  q3: { prompt: { stem: `${T}الإقلاب يكون عند حرف الباء.`, parts: [{ id: "p1", type: "true_false", marks: 1 }] }, key: { p1: { correct: true } } },
  q4: { prompt: { stem: `${T}ما اسم الحكم إذا وقع بعد النون الساكنة حرف من حروف الحلق؟`, parts: [{ id: "p1", type: "short_text", marks: 1 }] },
    key: { p1: { accepted: ["الإظهار", "الإظهار الحلقي"] } } },
  q5: { prompt: { stem: `${T}أكمل الفراغات:`, parts: [{ id: "p1", type: "fill_blank", marks: 2, text: "أحكام النون الساكنة: الإظهار و{b1} والإقلاب و{b2}." }] },
    key: { p1: { slots: { b1: "الإدغام", b2: "الإخفاء" }, scoring: "partial" } } },
  q6: { prompt: { stem: `${T}رتّب الأحكام كما وردت في المنهج:`, parts: [{ id: "p1", type: "ordering", marks: 2, items: [opt("izhar", "الإظهار"), opt("idgham", "الإدغام"), opt("iqlab", "الإقلاب"), opt("ikhfa", "الإخفاء")] }] },
    key: { p1: { order: ["izhar", "idgham", "iqlab", "ikhfa"], scoring: "partial" } } },
  q7: { prompt: { stem: `${T}صِل كل حكم بما يناسبه:`, parts: [{ id: "p1", type: "matching", marks: 2, left: [opt("l1", "الإظهار"), opt("l2", "الإقلاب")], right: [opt("r1", "حروف الحلق"), opt("r2", "الباء")] }] },
    key: { p1: { slots: { l1: "r1", l2: "r2" }, scoring: "partial" } } },
  q8: { prompt: { stem: `${T}أكمل الجدول:`, parts: [{ id: "p1", type: "table", marks: 2, columns: [{ id: "c1", label: "الحكم" }], rows: [{ id: "r1", label: "النون الساكنة قبل الباء" }, { id: "r2", label: "النون الساكنة قبل الهمزة" }] }] },
    key: { p1: { slots: { "r1:c1": "الإقلاب", "r2:c1": "الإظهار" }, scoring: "partial" } } },
  q9: { prompt: { stem: `${T}اختر الكلمة المناسبة للفراغ:`, parts: [{ id: "p1", type: "drag_drop", marks: 1, text: "يُقلب التنوين ميمًا عند {s1}.", options: [opt("o1", "الباء"), opt("o2", "الميم")] }] },
    key: { p1: { slots: { s1: "o1" } } } },
  q10: { prompt: { stem: `${T}من أي سورة هذه الآيات؟`, quran_ref: { surah: 1, ayah: 2, ayah_end: 4 }, parts: [{ id: "p1", type: "single_choice", marks: 1, options: [opt("fatiha", "الفاتحة"), opt("baqara", "البقرة")] }] },
    key: { p1: { correct: "fatiha" } } },
  q11: { prompt: { stem: `${T}اشرح بإيجاز حكم الإخفاء.`, parts: [{ id: "p1", type: "long_text", marks: 3 }] },
    key: { p1: {} }, model_answer: { p1: { text: "إجابة نموذجية تجريبية." } } },
};

const base = { description: `${T}اختبار لأغراض التحقق فقط.`, edition_id: SEED.edition, level_id: SEED.level1, pass_percent: 60, model_answer_visibility: "after_submission" };

export const EXAMS = [
  { key: "practice", slug: "zz-test-practice", title: `${T}تدريب على أحكام النون (كل أنواع الأسئلة)`, kind: "practice", requires_account: false, is_level_final: false,
    time_limit_minutes: null, result_release: "immediate", chapter_id: SEED.chapterL1C2, lesson: true, ...base,
    questions: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"] },
  { key: "formal", slug: "zz-test-formal", title: `${T}اختبار رسمي مع سؤال مقالي`, kind: "formal", requires_account: false, is_level_final: false,
    time_limit_minutes: 5, result_release: "immediate", chapter_id: null, lesson: false, ...base, questions: ["q1", "q11"] },
  { key: "account", slug: "zz-test-account", title: `${T}اختبار يتطلب حسابًا (نتيجة تُعلن يدويًا)`, kind: "formal", requires_account: true, is_level_final: false,
    time_limit_minutes: null, result_release: "manual", chapter_id: null, lesson: false, ...base, model_answer_visibility: "after_release", questions: ["q3"] },
].map((e) => ({ ...e, id: testId(`exam:${e.key}`) }));

export const LESSON_ID = testId("lesson");
export const examQuestionId = (examKey, q) => testId(`eq:${examKey}:${q}`);
export const questionId = (q) => testId(`question:${q}`);
export const versionId = (q) => testId(`version:${q}`);
export const totalMarks = (e) => e.questions.reduce((n, q) => n + QUESTIONS[q].prompt.parts.reduce((m, p) => m + p.marks, 0), 0);
export const hasManual = (e) => e.questions.some((q) => QUESTIONS[q].prompt.parts.some((p) => ["long_text", "audio_response"].includes(p.type)));
