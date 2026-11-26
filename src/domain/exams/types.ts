/**
 * Shapes returned by the exam RPCs (migration 0003). The paper NEVER contains
 * answer data (tg_question_version_prepare rejects it); keys/model answers
 * appear only in results, and only when the exam's settings allow it.
 */
import type { Part, PartType } from "@/domain/questions/schema";

export type AttemptStatus = "in_progress" | "submitted" | "graded";

export type PromptQuranRef = { surah: number; ayah: number; ayah_end?: number; word_start?: number; word_end?: number };

/** get_attempt_paper() → questions[] */
export type PaperQuestion = {
  exam_question_id: string;
  required: boolean;
  section: string | null;
  marks: number;
  stem: string;
  media: { resource_id: string }[] | null;
  quran_ref: PromptQuranRef | null;
  parts: Part[];
  response: QuestionResponse | null;
};

export type Paper = {
  attempt_id: string;
  exam_id: string;
  title: string;
  kind: "practice" | "formal";
  status: AttemptStatus;
  deadline_at: string | null;
  server_now: string;
  questions: PaperQuestion[];
};

/** Response formats graded by grade_part() (see responseSchema). */
export type PartResponse =
  | { choice: string }
  | { choices: string[] }
  | { value: boolean }
  | { text: string }
  | { order: string[] }
  | { slots: Record<string, string> };

export type QuestionResponse = { parts: Record<string, PartResponse> };

/** start_attempt() */
export type StartResult = { attempt_id: string; resumed: boolean; guest_token?: string };

/** get_attempt_result() */
export type ResultItem = {
  exam_question_id: string;
  stem: string;
  parts: Part[];
  response: QuestionResponse | null;
  part_scores: Record<string, number | null>;
  score: number | null;
  max: number;
  needs_manual: boolean;
  feedback: string | null;
  lesson_id: string | null;
  model_answer: Record<string, unknown> | null;
  key: Record<string, unknown> | null;
  explanation: string | null;
};

export type AttemptResult =
  | { attempt_id: string; status: "in_progress" }
  | { attempt_id: string; status: AttemptStatus; submitted_at: string; released: false }
  | {
      attempt_id: string; exam_title: string; status: AttemptStatus; released: true; guest_name: string | null;
      total_score: number | null; max_score: number; passed: boolean | null; pending_manual: boolean;
      model_answers_visible: boolean; items: ResultItem[];
    };

export const MANUAL_TYPES: PartType[] = ["long_text", "audio_response"];

/** True when a part has a usable answer (mirrors submit_attempt's "required" check, per part). */
export function isAnswered(part: Part, r: PartResponse | undefined): boolean {
  if (!r) return false;
  if ("choice" in r) return Boolean(r.choice);
  if ("choices" in r) return r.choices.length > 0;
  if ("value" in r) return typeof r.value === "boolean";
  if ("text" in r) return r.text.trim().length > 0;
  if ("order" in r) return r.order.length > 0;
  if ("slots" in r) return Object.values(r.slots).some((v) => v.trim() !== "");
  return false;
}

/** {slotId} placeholders in fill_blank / drag_drop text. */
export function splitSlots(text: string): ({ kind: "text"; value: string } | { kind: "slot"; id: string })[] {
  const out: ({ kind: "text"; value: string } | { kind: "slot"; id: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(/\{([A-Za-z0-9_-]+)\}/g)) {
    if (m.index! > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind: "slot", id: m[1]! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}
