#!/usr/bin/env node
/**
 * Generates tests/fixtures/site.fixture.json — TEST DATA ONLY, used to build
 * and verify the static site without touching the live database:
 *   node tests/fixtures/make-site-fixture.mjs
 *   HAQQ_CONTENT_FIXTURE=tests/fixtures/site.fixture.json npm run build
 * Texts are placeholders marked «[بيانات تجريبية]»; Quranic examples are stored
 * by reference only, exactly like the real schema.
 */
import { writeFileSync } from "node:fs";

const T = "[بيانات تجريبية] ";
const now = "2026-11-26T00:00:00.000Z";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const review = (status = "published") => ({ status, scientifically_verified: status === "published", created_by: null, created_at: now, updated_at: now });

const riwayah = { id: id(1), code: "hafs-asim-shatibiyyah", name_ar: "حفص عن عاصم", name_en: "Hafs an Asim", tariq: "الشاطبية" };
const curriculum = { id: id(2), slug: "test-curriculum", title: `${T}منهج تجريبي`, description: null, language: "ar", country_code: "JO", is_published: true, affiliation_note: "منهج تجريبي لأغراض الاختبار فقط.", created_by: null, created_at: now, updated_at: now };
const editionRow = { id: id(3), curriculum_id: curriculum.id, slug: "test-edition", label: "الطبعة التجريبية", year_ce: 2026, year_ah: 1448, riwayah_id: riwayah.id, publisher: null, authors: ["مؤلف تجريبي"], source_document: {}, is_published: true, is_current: true, created_at: now };

const levels = [
  { id: id(10), edition_id: editionRow.id, code: "l1", sort_order: 1, title: "المستوى الأول", subtitle: "التأسيسي", description: `${T}وصف المستوى الأول`, source_page_start: 9, source_page_end: 76 },
  { id: id(11), edition_id: editionRow.id, code: "l2", sort_order: 2, title: "المستوى الثاني", subtitle: "التكميلي", description: null, source_page_start: 77, source_page_end: 164 },
];
const chapters = [
  { id: id(20), level_id: id(10), code: "l1-c2", sort_order: 2, label: "الباب الثاني", title: "أحكام النون الساكنة والتنوين", source_page_start: 47, source_page_end: 65, review_note: null },
  { id: id(21), level_id: id(11), code: "l2-c1", sort_order: 1, label: "الباب الأول", title: "المد أحكامه وأنواعه", source_page_start: 79, source_page_end: 104, review_note: null },
];
const lesson = (n, chapter, code, sort, title, extra = {}, status = "published") => ({
  id: id(n), chapter_id: chapter, parent_lesson_id: null, code, sort_order: sort, title, description: null, objectives: [], body_md: null,
  definitions: [], rules: [], tables: [], youtube_ids: [], origin: "curriculum_quoted", source_edition_id: editionRow.id,
  source_page_start: 49, source_page_end: 65, search_norm: "", ...review(status), ...extra,
});
const lessons = [
  lesson(30, id(20), "l1-c2-01", 1, "أحكام النون الساكنة والتنوين", {
    description: `${T}مقدمة في أحكام النون الساكنة والتنوين.`,
    objectives: ["أن يعرّف الطالب النون الساكنة والتنوين", "أن يميّز الأحكام الأربعة"],
    body_md: `${T}للنون الساكنة والتنوين أربعة أحكام: **الإظهار**، والإدغام، والإقلاب، والإخفاء.\n\nمثال من القرآن:\n\n[[quran:2:121:1-6]]\n\n- الإظهار الحلقي\n- الإدغام`,
    definitions: [{ term: "النون الساكنة", definition: `${T}نون خالية من الحركة.`, source_page: 49 }],
    rules: [{ title: "الإظهار الحلقي", body: `${T}إذا وقع بعدها حرف من حروف الحلق.`, source_page: 51 }],
    tables: [{ caption: "حروف الإظهار", columns: ["الحرف", "المخرج"], rows: [["ء", "أقصى الحلق"], ["هـ", "أقصى الحلق"]], source_page: 52 }],
    youtube_ids: ["dQw4w9WgXcQ"],
  }),
  { ...lesson(31, id(20), "l1-c2-02", 2, "الإظهار الحلقي", { source_page_start: 51, source_page_end: 53 }), parent_lesson_id: id(30) },
  lesson(32, id(20), "l1-c2-03", 3, "درس مسودة لا يجوز أن يظهر", {}, "draft"),
  lesson(33, id(21), "l2-c1-01", 1, "المد الأصلي", { source_page_start: 81, source_page_end: 86 }),
];
const examples = [
  { id: id(40), riwayah_id: riwayah.id, surah: 1, ayah_start: 2, ayah_end: 4, word_start: null, word_end: null, display_text: null, text_source: null, note: "مثال تجريبي", origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 52, source_page_end: null, ...review() },
  { id: id(41), riwayah_id: riwayah.id, surah: 112, ayah_start: 1, ayah_end: 1, word_start: null, word_end: null, display_text: null, text_source: null, note: null, origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 53, source_page_end: null, ...review("draft") },
];
const resources = [
  { id: id(50), kind: "pdf", title: `${T}ملخص أحكام النون`, description: "ملف PDF تجريبي", provider: "r2", object_key: "resources/2026/11/test.pdf", youtube_id: null, external_url: null, mime_type: "application/pdf", size_bytes: 524288, duration_seconds: null, reciter_name: null, is_downloadable: true, origin: "independent_material", source_edition_id: null, source_page_start: null, ...review() },
  { id: id(51), kind: "link", title: `${T}رابط خارجي`, description: null, provider: "external", object_key: null, youtube_id: null, external_url: "https://tanzil.net", mime_type: null, size_bytes: null, duration_seconds: null, reciter_name: null, is_downloadable: false, origin: "independent_material", source_edition_id: null, source_page_start: null, ...review() },
  { id: id(52), kind: "video", title: `${T}مقطع مرئي`, description: null, provider: "youtube", object_key: null, youtube_id: "dQw4w9WgXcQ", external_url: null, mime_type: null, size_bytes: null, duration_seconds: 120, reciter_name: null, is_downloadable: false, origin: "independent_material", source_edition_id: null, source_page_start: null, ...review() },
  { id: id(53), kind: "pdf", title: "مورد مسودة لا يجوز أن يظهر", description: null, provider: "external", object_key: null, youtube_id: null, external_url: "https://example.org/x.pdf", mime_type: null, size_bytes: null, duration_seconds: null, reciter_name: null, is_downloadable: true, origin: "independent_material", source_edition_id: null, source_page_start: null, ...review("draft") },
];
const topics = [
  { id: id(60), slug: "izhar-halqi", title: "الإظهار الحلقي", definition: `${T}إخراج الحرف من مخرجه من غير غنة.`, explanation_md: `${T}شرح موجز.\n\n[[quran:1:1]]`, rules: [], riwayah_id: riwayah.id, origin: "supplementary_explanation", source_edition_id: editionRow.id, source_page_start: 51, source_page_end: 53, search_norm: "", ...review() },
];
const points = [
  { id: id(70), code: "halq-aqsa", general_area: "الحلق", name: "أقصى الحلق", sort_order: 1, description_md: `${T}أبعد الحلق مما يلي الصدر.`, diagram_resource_id: null, origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 115, ...review() },
];
const characteristics = [
  { id: id(80), code: "jahr", name: "الجهر", has_opposite: true, opposite_id: id(81), description_md: `${T}انحباس جريان النفس.`, origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 131, ...review() },
  { id: id(81), code: "hams", name: "الهمس", has_opposite: true, opposite_id: id(80), description_md: null, origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 131, ...review() },
  { id: id(82), code: "safeer", name: "الصفير", has_opposite: false, opposite_id: null, description_md: null, origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 140, ...review() },
];
const letters = [
  { id: id(90), letter: "ء", sort_order: 1, articulation_point_id: id(70), description_md: `${T}الهمزة.`, common_mistakes_md: `${T}تسهيلها في غير موضعه.`, audio_resource_id: null, origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 115, ...review() },
  { id: id(91), letter: "هـ", sort_order: 2, articulation_point_id: id(70), description_md: null, common_mistakes_md: null, audio_resource_id: null, origin: "curriculum_quoted", source_edition_id: editionRow.id, source_page_start: 115, ...review() },
];

const site = {
  edition: { ...editionRow, curriculum, riwayah },
  riwayat: [riwayah], levels, chapters, lessons, examples,
  lessonExamples: [{ lesson_id: id(30), example_id: id(40), sort_order: 1, rule_note: "إظهار" }, { lesson_id: id(30), example_id: id(41), sort_order: 2, rule_note: null }],
  resources,
  lessonResources: [{ lesson_id: id(30), resource_id: id(50), sort_order: 1 }, { lesson_id: id(30), resource_id: id(53), sort_order: 2 }],
  lessonRelations: [{ lesson_id: id(30), related_lesson_id: id(33) }],
  topics, topicLessons: [{ topic_id: id(60), lesson_id: id(30) }],
  points, characteristics, letters,
  letterCharacteristics: [{ letter_id: id(90), characteristic_id: id(80) }, { letter_id: id(91), characteristic_id: id(81) }],
  letterExamples: [{ letter_id: id(90), example_id: id(40) }],
  announcements: [
    { id: id(100), kind: "text", title: `${T}إعلان مثبّت`, body: "نص الإعلان التجريبي.", attachment_resource_id: id(51), link_url: "https://tanzil.net", target_level_id: null, publish_at: "2026-11-01T00:00:00Z", expires_at: null, pinned: true, created_by: null, created_at: now },
    { id: id(101), kind: "text", title: "إعلان منتهي لا يجوز أن يظهر", body: null, attachment_resource_id: null, link_url: null, target_level_id: null, publish_at: "2026-01-01T00:00:00Z", expires_at: "2026-02-01T00:00:00Z", pinned: false, created_by: null, created_at: now },
  ],
  exams: [
    { id: id(110), slug: "test-practice", title: `${T}تدريب على أحكام النون`, description: null, kind: "practice", level_id: id(10), chapter_id: id(20), lesson_id: id(30), is_level_final: false, requires_account: false, time_limit_minutes: 10, total_marks: 4, pass_percent: 60, opens_at: null, closes_at: null, has_manual_parts: false },
  ],
};

writeFileSync(new URL("./site.fixture.json", import.meta.url), JSON.stringify(site, null, 1));
console.log("wrote tests/fixtures/site.fixture.json");
