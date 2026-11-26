/**
 * Admin content model: one config per editable table (exact column names from
 * the migrations). Drives the generic list/edit pages. Postgres (RLS +
 * tg_content_guard + transition_content) remains the authority; this only
 * shapes the forms.
 */
import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
export type ContentStatus = Database["public"]["Enums"]["content_status"];

export type Lookup = "chapters" | "lessons" | "editions" | "riwayat" | "resources" | "points" | "characteristics" | "levels" | "examples" | "topics" | "letters";

export type Field =
  | { name: string; label: string; type: "text" | "textarea" | "markdown" | "url"; required?: boolean; hint?: string; dir?: "ltr" }
  | { name: string; label: string; type: "int"; required?: boolean; min?: number; max?: number; hint?: string }
  | { name: string; label: string; type: "bool"; hint?: string }
  | { name: string; label: string; type: "select"; options: [string, string][]; required?: boolean; hint?: string }
  | { name: string; label: string; type: "lines"; hint?: string; dir?: "ltr" }
  | { name: string; label: string; type: "json"; hint?: string; example?: unknown }
  | { name: string; label: string; type: "ref"; lookup: Lookup; required?: boolean; hint?: string }
  | { name: string; label: string; type: "datetime"; required?: boolean; hint?: string };

export type LinkDef = { table: keyof Tables; self: string; other: string; lookup: Lookup; label: string; extra?: { name: string; label: string }[] };

export type EntityKey = "lessons" | "quranic_examples" | "resources" | "tajweed_topics" | "articulation_points" | "letter_characteristics" | "academy_letters" | "announcements";

export type EntityConfig = {
  key: EntityKey;
  label: string;
  singular: string;
  reviewable: boolean;
  title: (row: Record<string, unknown>) => string;
  listColumns: { name: string; label: string }[];
  order: string;
  fields: Field[];
  defaults?: Record<string, unknown>;
  links?: LinkDef[];
};

const ORIGIN: [string, string][] = [
  ["curriculum_quoted", "منقول من المنهج (يتطلب الطبعة ورقم الصفحة)"],
  ["supplementary_explanation", "شرح مساند"],
  ["independent_material", "مادة مستقلة"],
];
const provenance: Field[] = [
  { name: "origin", label: "مصدر المحتوى", type: "select", options: ORIGIN, required: true },
  { name: "source_edition_id", label: "طبعة المنهج", type: "ref", lookup: "editions" },
  { name: "source_page_start", label: "من صفحة", type: "int", min: 1 },
];
const pageEnd: Field = { name: "source_page_end", label: "إلى صفحة", type: "int", min: 1 };
const MD_HINT = "Markdown. لإدراج آية استخدم [[quran:السورة:الآية]] مثل [[quran:2:121]] أو [[quran:2:121:1-6]] للكلمات — لا تكتب النص القرآني يدويًا.";

export const ENTITIES: Record<EntityKey, EntityConfig> = {
  lessons: {
    key: "lessons", label: "الدروس", singular: "درس", reviewable: true, order: "sort_order",
    title: (r) => String(r.title ?? ""),
    listColumns: [{ name: "code", label: "الرمز" }, { name: "title", label: "العنوان" }],
    fields: [
      { name: "chapter_id", label: "الباب", type: "ref", lookup: "chapters", required: true },
      { name: "parent_lesson_id", label: "درس رئيسي (اختياري)", type: "ref", lookup: "lessons" },
      { name: "code", label: "الرمز (حروف لاتينية صغيرة وأرقام و-)", type: "text", required: true, dir: "ltr" },
      { name: "sort_order", label: "الترتيب", type: "int", required: true },
      { name: "title", label: "العنوان", type: "text", required: true },
      { name: "description", label: "وصف مختصر", type: "textarea" },
      { name: "objectives", label: "الأهداف (هدف في كل سطر)", type: "lines" },
      { name: "body_md", label: "الشرح", type: "markdown", hint: MD_HINT },
      { name: "definitions", label: "التعريفات", type: "json", example: [{ term: "", definition: "", source_page: 1 }] },
      { name: "rules", label: "الأحكام والقواعد", type: "json", example: [{ title: "", body: "", source_page: 1 }] },
      { name: "tables", label: "الجداول", type: "json", example: [{ caption: "", columns: ["", ""], rows: [["", ""]], source_page: 1 }] },
      { name: "youtube_ids", label: "معرّفات YouTube (معرّف في كل سطر، 11 حرفًا)", type: "lines", dir: "ltr" },
      ...provenance, pageEnd,
    ],
    defaults: { origin: "curriculum_quoted", sort_order: 1, objectives: [], definitions: [], rules: [], tables: [], youtube_ids: [] },
    links: [
      { table: "lesson_examples", self: "lesson_id", other: "example_id", lookup: "examples", label: "أمثلة قرآنية", extra: [{ name: "rule_note", label: "ملاحظة الحكم" }] },
      { table: "lesson_resources", self: "lesson_id", other: "resource_id", lookup: "resources", label: "الملفات والمواد" },
      { table: "lesson_relations", self: "lesson_id", other: "related_lesson_id", lookup: "lessons", label: "دروس ذات صلة" },
    ],
  },
  quranic_examples: {
    key: "quranic_examples", label: "الأمثلة القرآنية", singular: "مثال", reviewable: true, order: "surah",
    title: (r) => `${r.surah}:${r.ayah_start}${r.ayah_end !== r.ayah_start ? `–${r.ayah_end}` : ""}${r.word_start ? ` (ك ${r.word_start}${r.word_end ? `–${r.word_end}` : ""})` : ""}`,
    listColumns: [{ name: "surah", label: "السورة" }, { name: "ayah_start", label: "الآية" }, { name: "note", label: "ملاحظة" }],
    fields: [
      { name: "riwayah_id", label: "الرواية", type: "ref", lookup: "riwayat", required: true },
      { name: "surah", label: "رقم السورة", type: "int", required: true, min: 1, max: 114 },
      { name: "ayah_start", label: "من آية", type: "int", required: true, min: 1, max: 286 },
      { name: "ayah_end", label: "إلى آية", type: "int", required: true, min: 1, max: 286 },
      { name: "word_start", label: "من كلمة (اختياري)", type: "int", min: 1 },
      { name: "word_end", label: "إلى كلمة (اختياري)", type: "int", min: 1 },
      { name: "note", label: "ملاحظة", type: "textarea" },
      ...provenance, pageEnd,
    ],
    defaults: { origin: "curriculum_quoted", surah: 1, ayah_start: 1, ayah_end: 1 },
  },
  resources: {
    key: "resources", label: "الملفات والمواد", singular: "مادة", reviewable: true, order: "created_at",
    title: (r) => String(r.title ?? ""),
    listColumns: [{ name: "title", label: "العنوان" }, { name: "kind", label: "النوع" }, { name: "provider", label: "التخزين" }],
    fields: [
      { name: "kind", label: "النوع", type: "select", required: true, options: [["pdf", "PDF"], ["audio", "صوت"], ["video", "فيديو"], ["image", "صورة"], ["document", "مستند"], ["diagram", "رسم توضيحي"], ["link", "رابط"]] },
      { name: "title", label: "العنوان", type: "text", required: true },
      { name: "description", label: "الوصف", type: "textarea" },
      { name: "provider", label: "مكان التخزين", type: "select", required: true, options: [["youtube", "YouTube"], ["external", "رابط خارجي (https)"], ["r2", "Cloudflare R2 (رفع ملف)"], ["supabase", "Supabase (صور صغيرة)"]] },
      { name: "youtube_id", label: "معرّف YouTube", type: "text", dir: "ltr" },
      { name: "external_url", label: "الرابط الخارجي", type: "url", dir: "ltr" },
      { name: "object_key", label: "مسار الملف (R2/Supabase)", type: "text", dir: "ltr", hint: "يُملأ تلقائيًا بعد رفع الملف." },
      { name: "mime_type", label: "نوع الملف (MIME)", type: "text", dir: "ltr" },
      { name: "size_bytes", label: "الحجم بالبايت", type: "int", min: 0, max: 26214400 },
      { name: "duration_seconds", label: "المدة بالثواني", type: "int", min: 0 },
      { name: "reciter_name", label: "اسم القارئ/المعلم", type: "text" },
      { name: "is_downloadable", label: "قابل للتحميل", type: "bool" },
      ...provenance,
    ],
    defaults: { kind: "pdf", provider: "external", origin: "independent_material", is_downloadable: true },
  },
  tajweed_topics: {
    key: "tajweed_topics", label: "الموسوعة", singular: "مدخل", reviewable: true, order: "title",
    title: (r) => String(r.title ?? ""),
    listColumns: [{ name: "slug", label: "الرابط" }, { name: "title", label: "العنوان" }],
    fields: [
      { name: "slug", label: "الرابط (حروف لاتينية)", type: "text", required: true, dir: "ltr" },
      { name: "title", label: "العنوان", type: "text", required: true },
      { name: "definition", label: "التعريف", type: "textarea" },
      { name: "explanation_md", label: "الشرح", type: "markdown", hint: MD_HINT },
      { name: "rules", label: "الأحكام", type: "json", example: [{ title: "", body: "", source_page: 1 }] },
      { name: "riwayah_id", label: "الرواية", type: "ref", lookup: "riwayat" },
      ...provenance, pageEnd,
    ],
    defaults: { origin: "supplementary_explanation", rules: [] },
    links: [{ table: "topic_lessons", self: "topic_id", other: "lesson_id", lookup: "lessons", label: "دروس مرتبطة" }],
  },
  articulation_points: {
    key: "articulation_points", label: "المخارج", singular: "مخرج", reviewable: true, order: "sort_order",
    title: (r) => String(r.name ?? ""),
    listColumns: [{ name: "general_area", label: "المخرج العام" }, { name: "name", label: "الاسم" }],
    fields: [
      { name: "code", label: "الرمز", type: "text", required: true, dir: "ltr" },
      { name: "general_area", label: "المخرج العام (الجوف، الحلق، اللسان، الشفتان، الخيشوم)", type: "text", required: true },
      { name: "name", label: "الاسم", type: "text", required: true },
      { name: "sort_order", label: "الترتيب", type: "int", required: true },
      { name: "description_md", label: "الوصف", type: "markdown", hint: MD_HINT },
      { name: "diagram_resource_id", label: "رسم توضيحي", type: "ref", lookup: "resources" },
      ...provenance,
    ],
    defaults: { origin: "curriculum_quoted", sort_order: 1 },
  },
  letter_characteristics: {
    key: "letter_characteristics", label: "الصفات", singular: "صفة", reviewable: true, order: "name",
    title: (r) => String(r.name ?? ""),
    listColumns: [{ name: "code", label: "الرمز" }, { name: "name", label: "الاسم" }],
    fields: [
      { name: "code", label: "الرمز", type: "text", required: true, dir: "ltr" },
      { name: "name", label: "الاسم", type: "text", required: true },
      { name: "has_opposite", label: "لها ضد", type: "bool" },
      { name: "opposite_id", label: "ضدها", type: "ref", lookup: "characteristics" },
      { name: "description_md", label: "الوصف", type: "markdown", hint: MD_HINT },
      ...provenance,
    ],
    defaults: { origin: "curriculum_quoted", has_opposite: false },
  },
  academy_letters: {
    key: "academy_letters", label: "الحروف", singular: "حرف", reviewable: true, order: "sort_order",
    title: (r) => String(r.letter ?? ""),
    listColumns: [{ name: "letter", label: "الحرف" }, { name: "sort_order", label: "الترتيب" }],
    fields: [
      { name: "letter", label: "الحرف", type: "text", required: true },
      { name: "sort_order", label: "الترتيب", type: "int", required: true },
      { name: "articulation_point_id", label: "المخرج", type: "ref", lookup: "points" },
      { name: "description_md", label: "الوصف", type: "markdown", hint: MD_HINT },
      { name: "common_mistakes_md", label: "أخطاء شائعة", type: "markdown", hint: MD_HINT },
      { name: "audio_resource_id", label: "تسجيل صوتي (معلم مؤهل)", type: "ref", lookup: "resources" },
      ...provenance,
    ],
    defaults: { origin: "curriculum_quoted", sort_order: 1 },
    links: [
      { table: "academy_letter_characteristics", self: "letter_id", other: "characteristic_id", lookup: "characteristics", label: "صفات الحرف" },
      { table: "academy_letter_examples", self: "letter_id", other: "example_id", lookup: "examples", label: "أمثلة قرآنية" },
    ],
  },
  announcements: {
    key: "announcements", label: "الإعلانات", singular: "إعلان", reviewable: false, order: "publish_at",
    title: (r) => String(r.title ?? ""),
    listColumns: [{ name: "title", label: "العنوان" }, { name: "publish_at", label: "النشر" }, { name: "pinned", label: "مثبّت" }],
    fields: [
      { name: "kind", label: "النوع", type: "select", required: true, options: [["text", "نص"], ["image", "صورة"], ["pdf", "PDF"], ["link", "رابط"], ["mixed", "متنوع"]] },
      { name: "title", label: "العنوان", type: "text", required: true },
      { name: "body", label: "النص", type: "textarea" },
      { name: "attachment_resource_id", label: "مرفق", type: "ref", lookup: "resources" },
      { name: "link_url", label: "رابط (https)", type: "url", dir: "ltr" },
      { name: "target_level_id", label: "لمستوى محدد (اختياري)", type: "ref", lookup: "levels" },
      { name: "publish_at", label: "وقت النشر", type: "datetime", required: true },
      { name: "expires_at", label: "ينتهي في (اختياري)", type: "datetime" },
      { name: "pinned", label: "مثبّت", type: "bool" },
    ],
    defaults: { kind: "text", pinned: false },
  },
};

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "مسودة", submitted: "مرسل للمراجعة", under_review: "قيد المراجعة", changes_requested: "مطلوب تعديلات",
  approved: "معتمد", published: "منشور", archived: "مؤرشف",
};

export const REVIEWABLE: { entity: string; label: string }[] = [
  ...Object.values(ENTITIES).filter((e) => e.reviewable).map((e) => ({ entity: e.key, label: e.label })),
  { entity: "question_versions", label: "الأسئلة" },
];

export const isEditable = (status: ContentStatus | undefined) => !status || status === "draft" || status === "changes_requested";
