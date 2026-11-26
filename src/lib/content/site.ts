/**
 * BUILD-TIME content snapshot for the static site.
 *
 * Read through the ANONYMOUS client, so Row Level Security guarantees that only
 * published content (status = 'published') and published curricula ever reach
 * the exported HTML — drafts cannot leak even if a query here were wrong.
 * Any database error fails the build instead of silently deploying an empty site.
 */
import "server-only";
import { getBuildClient } from "@/lib/supabase/client";
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
  lessons: Lesson[];
  examples: QuranicExample[];
  lessonExamples: T["lesson_examples"]["Row"][];
  resources: Resource[];
  lessonResources: T["lesson_resources"]["Row"][];
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

async function rows<R>(label: string, q: PromiseLike<{ data: R[] | null; error: { message: string } | null }>): Promise<R[]> {
  const { data, error } = await q;
  if (error) throw new Error(`[build] could not load ${label}: ${error.message}`);
  return data ?? [];
}

const published = "published" as const;

/**
 * TEST-ONLY: HAQQ_CONTENT_FIXTURE=<json> builds the site from a fixture instead
 * of Supabase, so content pages can be verified without writing to the live
 * database. Refused on Cloudflare Pages builds (CF_PAGES) so it can never ship.
 */
function loadFixture(path: string): Site {
  if (process.env.CF_PAGES) throw new Error("[build] HAQQ_CONTENT_FIXTURE must never be used for a Cloudflare Pages build");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Omit<Site, "builtAt">;
  const isPub = <R extends { status: string }>(r: R) => r.status === published;
  return {
    ...raw,
    lessons: raw.lessons.filter(isPub), examples: raw.examples.filter(isPub), resources: raw.resources.filter(isPub),
    topics: raw.topics.filter(isPub), points: raw.points.filter(isPub), characteristics: raw.characteristics.filter(isPub),
    letters: raw.letters.filter(isPub), builtAt: new Date().toISOString(),
  };
}

async function load(): Promise<Site> {
  if (process.env.HAQQ_CONTENT_FIXTURE) return loadFixture(process.env.HAQQ_CONTENT_FIXTURE);
  const sb = getBuildClient();

  const [curricula, editions, riwayat] = await Promise.all([
    rows("curricula", sb.from("curricula").select("*").eq("is_published", true)),
    rows("curriculum_editions", sb.from("curriculum_editions").select("*").eq("is_published", true)),
    rows("riwayat", sb.from("riwayat").select("*")),
  ]);
  // One public, unified platform: the current edition of the published curriculum.
  const pick = editions.find((e) => e.is_current) ?? editions[0] ?? null;
  const curriculum = pick ? curricula.find((c) => c.id === pick.curriculum_id) : undefined;
  const edition: Edition | null = pick && curriculum
    ? { ...pick, curriculum, riwayah: riwayat.find((r) => r.id === pick.riwayah_id) ?? null }
    : null;

  const levels = edition
    ? await rows("levels", sb.from("levels").select("*").eq("edition_id", edition.id).order("sort_order"))
    : [];
  const levelIds = levels.map((l) => l.id);
  const chapters = levelIds.length
    ? await rows("chapters", sb.from("chapters").select("*").in("level_id", levelIds).order("sort_order"))
    : [];
  const chapterIds = new Set(chapters.map((c) => c.id));

  const [lessonsAll, examples, lessonExamples, resources, lessonResources, lessonRelations, topics, topicLessons,
    points, characteristics, letters, letterCharacteristics, letterExamples, announcements, exams] = await Promise.all([
    rows("lessons", sb.from("lessons").select("*").eq("status", published).order("sort_order")),
    rows("quranic_examples", sb.from("quranic_examples").select("*").eq("status", published)),
    rows("lesson_examples", sb.from("lesson_examples").select("*").order("sort_order")),
    rows("resources", sb.from("resources").select("*").eq("status", published).order("created_at", { ascending: false })),
    rows("lesson_resources", sb.from("lesson_resources").select("*").order("sort_order")),
    rows("lesson_relations", sb.from("lesson_relations").select("*")),
    rows("tajweed_topics", sb.from("tajweed_topics").select("*").eq("status", published).order("title")),
    rows("topic_lessons", sb.from("topic_lessons").select("*")),
    rows("articulation_points", sb.from("articulation_points").select("*").eq("status", published).order("sort_order")),
    rows("letter_characteristics", sb.from("letter_characteristics").select("*").eq("status", published).order("name")),
    rows("academy_letters", sb.from("academy_letters").select("*").eq("status", published).order("sort_order")),
    rows("academy_letter_characteristics", sb.from("academy_letter_characteristics").select("*")),
    rows("academy_letter_examples", sb.from("academy_letter_examples").select("*")),
    rows("announcements", sb.from("announcements").select("*").order("pinned", { ascending: false }).order("publish_at", { ascending: false }).limit(100)),
    rows("exams", sb.from("exams").select("id,slug,title,description,kind,level_id,chapter_id,lesson_id,is_level_final,requires_account,time_limit_minutes,total_marks,pass_percent,opens_at,closes_at,has_manual_parts").eq("status", published).order("created_at")),
  ]);

  // Defence in depth: RLS already hides unpublished rows from anon.
  const isPub = <R extends { status: string }>(r: R) => r.status === published;
  const lessons = lessonsAll.filter((l) => isPub(l) && chapterIds.has(l.chapter_id));

  return {
    edition, riwayat, levels, chapters, lessons,
    examples: examples.filter(isPub), lessonExamples, resources: resources.filter(isPub), lessonResources, lessonRelations,
    topics: topics.filter(isPub), topicLessons, points: points.filter(isPub), characteristics: characteristics.filter(isPub),
    letters: letters.filter(isPub), letterCharacteristics, letterExamples, announcements, exams,
    builtAt: new Date().toISOString(),
  };
}

let cached: Promise<Site> | null = null;
/** Loaded once per build worker. */
export function getSite(): Promise<Site> {
  cached ??= load();
  return cached;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export const PLACEHOLDER = "_";

/**
 * `output: 'export'` rejects a dynamic route whose generateStaticParams() is
 * empty. Until content is published we export a single placeholder page,
 * which renders as "not found".
 */
export function orPlaceholder<P extends Record<string, string>>(params: P[], keys: (keyof P)[]): P[] {
  if (params.length) return params;
  return [Object.fromEntries(keys.map((k) => [k, PLACEHOLDER])) as P];
}

export function levelByCode(site: Site, code: string) {
  return site.levels.find((l) => l.code === code) ?? null;
}
export function chaptersOf(site: Site, levelId: string) {
  return site.chapters.filter((c) => c.level_id === levelId);
}
export function lessonsOf(site: Site, chapterId: string) {
  return site.lessons.filter((l) => l.chapter_id === chapterId).sort((a, b) => a.sort_order - b.sort_order);
}
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

export const lessonHref = (p: LessonPath) => `/levels/${p.level.code}/${p.chapter.code}/${p.lesson.code}/`;
export const chapterHref = (level: Level, chapter: Chapter) => `/levels/${level.code}/${chapter.code}/`;
export const levelHref = (level: Level) => `/levels/${level.code}/`;

export function resourcesOfLesson(site: Site, lessonId: string) {
  return site.lessonResources.filter((lr) => lr.lesson_id === lessonId)
    .map((lr) => site.resources.find((r) => r.id === lr.resource_id))
    .filter((r): r is Resource => Boolean(r));
}
export function examplesOfLesson(site: Site, lessonId: string) {
  return site.lessonExamples.filter((le) => le.lesson_id === lessonId)
    .map((le) => ({ link: le, example: site.examples.find((e) => e.id === le.example_id) }))
    .filter((x): x is { link: typeof x.link; example: QuranicExample } => Boolean(x.example));
}

/** Announcements visible at build time; the page re-filters expiry in the browser. */
export function liveAnnouncements(site: Site, now = Date.now()) {
  return site.announcements.filter((a) => Date.parse(a.publish_at) <= now && (!a.expires_at || Date.parse(a.expires_at) > now));
}
