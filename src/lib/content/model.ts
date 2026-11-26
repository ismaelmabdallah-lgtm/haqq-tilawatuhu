/**
 * Published-content model shared by the build (static pages) and the browser
 * (live refresh). Always read through the ANONYMOUS role, so Row Level Security
 * guarantees only published content and published curricula are returned; a
 * second status filter here is defence in depth.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type T = Database["public"]["Tables"];
export type Edition = T["curriculum_editions"]["Row"] & { curriculum: T["curricula"]["Row"]; riwayah: T["riwayat"]["Row"] | null };
export type Level = T["levels"]["Row"];
export type Chapter = T["chapters"]["Row"];
export type Lesson = T["lessons"]["Row"];
export type QuranicExample = T["quranic_examples"]["Row"];
export type Resource = T["resources"]["Row"];
export type Topic = T["tajweed_topics"]["Row"];
export type ArticulationPoint = T["articulation_points"]["Row"];
export type Characteristic = T["letter_characteristics"]["Row"];
export type AcademyLetter = T["academy_letters"]["Row"];
export type Announcement = T["announcements"]["Row"];
export type Exam = Pick<T["exams"]["Row"], "id" | "slug" | "title" | "description" | "kind" | "level_id" | "chapter_id" | "lesson_id"
  | "is_level_final" | "requires_account" | "time_limit_minutes" | "total_marks" | "pass_percent" | "opens_at" | "closes_at" | "has_manual_parts">;

export type Site = {
  edition: Edition | null;
  riwayat: T["riwayat"]["Row"][];
  levels: Level[];
  chapters: Chapter[];
  /** In a "light" snapshot (live refresh) the heavy lesson columns are empty; lesson pages load their own full row. */
  lessons: Lesson[];
  light: boolean;
  examples: QuranicExample[];
  lessonExamples: T["lesson_examples"]["Row"][];
  resources: Resource[];
  lessonResources: T["lesson_resources"]["Row"][];
  levelResources: T["level_resources"]["Row"][];
  lessonRelations: T["lesson_relations"]["Row"][];
  topics: Topic[];
  topicLessons: T["topic_lessons"]["Row"][];
  points: ArticulationPoint[];
  characteristics: Characteristic[];
  letters: AcademyLetter[];
  letterCharacteristics: T["academy_letter_characteristics"]["Row"][];
  letterExamples: T["academy_letter_examples"]["Row"][];
  announcements: Announcement[];
  exams: Exam[];
  builtAt: string;
};

export type DB = SupabaseClient<Database>;

const EXAM_COLS = "id,slug,title,description,kind,level_id,chapter_id,lesson_id,is_level_final,requires_account,time_limit_minutes,total_marks,pass_percent,opens_at,closes_at,has_manual_parts";
const LESSON_LIGHT_COLS = "id,chapter_id,parent_lesson_id,code,sort_order,title,description,origin,source_edition_id,source_page_start,source_page_end,status,scientifically_verified,created_by,created_at,updated_at";
const published = "published" as const;

async function rows<R>(label: string, q: PromiseLike<{ data: R[] | null; error: { message: string } | null }>): Promise<R[]> {
  const { data, error } = await q;
  if (error) throw new Error(`could not load ${label}: ${error.message}`);
  return data ?? [];
}

/** Loads every published item. `light` skips lesson bodies (used by the browser refresh). */
export async function loadSnapshot(sb: DB, { light = false } = {}): Promise<Site> {
  const [curricula, editions, riwayat] = await Promise.all([
    rows("curricula", sb.from("curricula").select("*").eq("is_published", true)),
    rows("curriculum_editions", sb.from("curriculum_editions").select("*").eq("is_published", true)),
    rows("riwayat", sb.from("riwayat").select("*")),
  ]);
  const pick = editions.find((e) => e.is_current) ?? editions[0] ?? null;
  const curriculum = pick ? curricula.find((c) => c.id === pick.curriculum_id) : undefined;
  const edition: Edition | null = pick && curriculum ? { ...pick, curriculum, riwayah: riwayat.find((r) => r.id === pick.riwayah_id) ?? null } : null;

  const levels = edition ? await rows("levels", sb.from("levels").select("*").eq("edition_id", edition.id).order("sort_order")) : [];
  const levelIds = levels.map((l) => l.id);
  const chapters = levelIds.length ? await rows("chapters", sb.from("chapters").select("*").in("level_id", levelIds).order("sort_order")) : [];
  const chapterIds = new Set(chapters.map((c) => c.id));

  const [lessonsAll, examples, lessonExamples, resources, lessonResources, levelResources, lessonRelations, topics, topicLessons,
    points, characteristics, letters, letterCharacteristics, letterExamples, announcements, exams] = await Promise.all([
    rows<Lesson>("lessons", light
      ? (sb.from("lessons").select(LESSON_LIGHT_COLS).eq("status", published).order("sort_order") as unknown as PromiseLike<{ data: Lesson[] | null; error: { message: string } | null }>)
      : sb.from("lessons").select("*").eq("status", published).order("sort_order")),
    rows("quranic_examples", sb.from("quranic_examples").select("*").eq("status", published)),
    rows("lesson_examples", sb.from("lesson_examples").select("*").order("sort_order")),
    rows("resources", sb.from("resources").select("*").eq("status", published).order("created_at", { ascending: false })),
    rows("lesson_resources", sb.from("lesson_resources").select("*").order("sort_order")),
    // Tolerate a project that has not applied migration 0006 yet (table missing ⇒ no level files).
    rows("level_resources", sb.from("level_resources").select("*").order("sort_order").then((r) =>
      r.error && /level_resources|PGRST205|42P01/.test(`${r.error.message} ${(r.error as { code?: string }).code ?? ""}`) ? { data: [], error: null } : r)),
    rows("lesson_relations", sb.from("lesson_relations").select("*")),
    rows("tajweed_topics", sb.from("tajweed_topics").select("*").eq("status", published).order("title")),
    rows("topic_lessons", sb.from("topic_lessons").select("*")),
    rows("articulation_points", sb.from("articulation_points").select("*").eq("status", published).order("sort_order")),
    rows("letter_characteristics", sb.from("letter_characteristics").select("*").eq("status", published).order("name")),
    rows("academy_letters", sb.from("academy_letters").select("*").eq("status", published).order("sort_order")),
    rows("academy_letter_characteristics", sb.from("academy_letter_characteristics").select("*")),
    rows("academy_letter_examples", sb.from("academy_letter_examples").select("*")),
    rows("announcements", sb.from("announcements").select("*").order("pinned", { ascending: false }).order("publish_at", { ascending: false }).limit(100)),
    rows<Exam>("exams", sb.from("exams").select(EXAM_COLS).eq("status", published).order("created_at") as unknown as PromiseLike<{ data: Exam[] | null; error: { message: string } | null }>),
  ]);

  const isPub = <R extends { status: string }>(r: R) => r.status === published;
  const lessons = lessonsAll.filter((l) => isPub(l) && chapterIds.has(l.chapter_id))
    .map((l) => (light ? { ...l, objectives: [], body_md: null, definitions: [], rules: [], tables: [], youtube_ids: [], search_norm: "" } : l));
  return {
    edition, riwayat, levels, chapters, lessons, light,
    examples: examples.filter(isPub), lessonExamples, resources: resources.filter(isPub), lessonResources, levelResources, lessonRelations,
    topics: topics.filter(isPub), topicLessons, points: points.filter(isPub), characteristics: characteristics.filter(isPub),
    letters: letters.filter(isPub), letterCharacteristics, letterExamples, announcements, exams,
    builtAt: new Date().toISOString(),
  };
}

/** Full row of one published lesson (live lesson pages). */
export async function loadLesson(sb: DB, id: string): Promise<Lesson | null> {
  const { data } = await sb.from("lessons").select("*").eq("id", id).eq("status", published).maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export const PLACEHOLDER = "_";

/** `output: 'export'` rejects an empty generateStaticParams(); export one placeholder page instead. */
export function orPlaceholder<P extends Record<string, string>>(params: P[], keys: (keyof P)[]): P[] {
  if (params.length) return params;
  return [Object.fromEntries(keys.map((k) => [k, PLACEHOLDER])) as P];
}

export const levelByCode = (site: Site, code: string) => site.levels.find((l) => l.code === code) ?? null;
export const chaptersOf = (site: Site, levelId: string) => site.chapters.filter((c) => c.level_id === levelId);
export const lessonsOf = (site: Site, chapterId: string) =>
  site.lessons.filter((l) => l.chapter_id === chapterId).sort((a, b) => a.sort_order - b.sort_order);
export function lessonsOfLevel(site: Site, levelId: string) {
  const ids = new Set(chaptersOf(site, levelId).map((c) => c.id));
  return site.lessons.filter((l) => ids.has(l.chapter_id));
}

export type LessonPath = { level: Level; chapter: Chapter; lesson: Lesson };
export function lessonPath(site: Site, lessonId: string): LessonPath | null {
  const lesson = site.lessons.find((l) => l.id === lessonId);
  const chapter = lesson && site.chapters.find((c) => c.id === lesson.chapter_id);
  const level = chapter && site.levels.find((l) => l.id === chapter.level_id);
  return lesson && chapter && level ? { level, chapter, lesson } : null;
}
export function findLesson(site: Site, levelCode: string, chapterCode: string, lessonCode: string): LessonPath | null {
  const level = levelByCode(site, levelCode);
  const chapter = level ? chaptersOf(site, level.id).find((c) => c.code === chapterCode) : undefined;
  const lesson = chapter ? lessonsOf(site, chapter.id).find((l) => l.code === lessonCode) : undefined;
  return level && chapter && lesson ? { level, chapter, lesson } : null;
}

export const lessonHref = (p: LessonPath) => `/levels/${p.level.code}/${p.chapter.code}/${p.lesson.code}/`;
export const chapterHref = (level: Level, chapter: Chapter) => `/levels/${level.code}/${chapter.code}/`;
export const levelHref = (level: Level) => `/levels/${level.code}/`;

export function resourcesOfLesson(site: Site, lessonId: string) {
  return site.lessonResources.filter((lr) => lr.lesson_id === lessonId)
    .map((lr) => site.resources.find((r) => r.id === lr.resource_id)).filter((r): r is Resource => Boolean(r));
}
export function resourcesOfLevel(site: Site, levelId: string) {
  return site.levelResources.filter((lr) => lr.level_id === levelId)
    .map((lr) => site.resources.find((r) => r.id === lr.resource_id)).filter((r): r is Resource => Boolean(r));
}
export function examplesOfLesson(site: Site, lessonId: string) {
  return site.lessonExamples.filter((le) => le.lesson_id === lessonId)
    .map((le) => ({ link: le, example: site.examples.find((e) => e.id === le.example_id) }))
    .filter((x): x is { link: typeof x.link; example: QuranicExample } => Boolean(x.example));
}
export const examsOfLevel = (site: Site, levelId: string) => site.exams.filter((e) => e.level_id === levelId);

/** Announcements visible now (the static page re-checks expiry in the browser). */
export function liveAnnouncements(site: Site, now = Date.now()) {
  return site.announcements.filter((a) => Date.parse(a.publish_at) <= now && (!a.expires_at || Date.parse(a.expires_at) > now));
}

/** Same snapshot without lesson bodies — what server pages hand to browser components. */
export function lightSite(site: Site): Site {
  return {
    ...site, light: true,
    lessons: site.lessons.map((l) => ({ ...l, objectives: [], body_md: null, definitions: [], rules: [], tables: [], youtube_ids: [], search_norm: "" })),
  };
}

// ---------------------------------------------------------------------------
// Links: pre-rendered pages when they exist in this build, otherwise the live
// client route (/learn/), so content published after the last build is reachable.
// ---------------------------------------------------------------------------
export type Built = { levels: Set<string>; chapters: Set<string>; lessons: Set<string> };
export const builtFrom = (site: Site | null): Built => ({
  levels: new Set(site?.levels.map((l) => l.id) ?? []),
  chapters: new Set(site?.chapters.map((c) => c.id) ?? []),
  lessons: new Set(site?.lessons.map((l) => l.id) ?? []),
});
const learn = (q: Record<string, string>) => `/learn/?${new URLSearchParams(q).toString()}`;
export const levelLink = (b: Built, level: Level) => (b.levels.has(level.id) ? levelHref(level) : learn({ level: level.code }));
export const chapterLink = (b: Built, level: Level, chapter: Chapter) =>
  b.chapters.has(chapter.id) ? chapterHref(level, chapter) : learn({ level: level.code, chapter: chapter.code });
export const lessonLink = (b: Built, p: LessonPath) =>
  b.lessons.has(p.lesson.id) ? lessonHref(p) : learn({ level: p.level.code, chapter: p.chapter.code, lesson: p.lesson.code });

export const quranKey = (r: { surah: number; ayah: number; ayahEnd?: number; wordStart?: number; wordEnd?: number }) =>
  `${r.surah}:${r.ayah}-${r.ayahEnd ?? r.ayah}:${r.wordStart ?? ""}-${r.wordEnd ?? ""}`;
