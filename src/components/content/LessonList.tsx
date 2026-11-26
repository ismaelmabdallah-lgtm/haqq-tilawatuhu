import Link from "next/link";
import type { Lesson } from "@/lib/content/site";
import { pagesLabel } from "@/components/ui";
import { LessonProgressDot } from "@/components/content/LessonProgress";

/** Lessons of a chapter, sub-lessons nested under their published parent. */
export function LessonList({ lessons, hrefOf }: { lessons: Lesson[]; hrefOf: (l: Lesson) => string }) {
  const ids = new Set(lessons.map((l) => l.id));
  const top = lessons.filter((l) => !l.parent_lesson_id || !ids.has(l.parent_lesson_id));
  const children = (id: string) => lessons.filter((l) => l.parent_lesson_id === id);

  const item = (l: Lesson, depth: number) => (
    <li key={l.id}>
      <Link href={hrefOf(l)} className={`tap flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 hover:border-brand-500 ${depth ? "ms-5" : ""}`}>
        <span className="flex items-center gap-2"><LessonProgressDot lessonId={l.id} />{l.title}</span>
        <span className="shrink-0 text-xs text-muted">{pagesLabel(l.source_page_start, l.source_page_end)}</span>
      </Link>
      {children(l.id).length > 0 && <ul className="mt-2 space-y-2">{children(l.id).map((c) => item(c, depth + 1))}</ul>}
    </li>
  );
  return <ul className="space-y-2">{top.map((l) => item(l, 0))}</ul>;
}
