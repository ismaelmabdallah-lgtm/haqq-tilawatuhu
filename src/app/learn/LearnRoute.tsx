"use client";
import { useSearchParams } from "next/navigation";
import { ChapterView, LessonView, LevelHub, LevelsOverview } from "@/components/learn/LearnViews";

const CODE = /^[a-z0-9-]{1,80}$/;

export function LearnRoute() {
  const sp = useSearchParams();
  const level = sp.get("level") ?? "";
  const chapter = sp.get("chapter") ?? "";
  const lesson = sp.get("lesson") ?? "";
  if (!CODE.test(level)) return <LevelsOverview initial={null} />;
  if (!CODE.test(chapter)) return <LevelHub key={level} initial={null} code={level} />;
  if (!CODE.test(lesson)) return <ChapterView key={level + chapter} initial={null} levelCode={level} chapterCode={chapter} />;
  return <LessonView key={level + chapter + lesson} initial={null} levelCode={level} chapterCode={chapter} lessonCode={lesson} prerendered={null} />;
}
