"use client";
/** Thin typed wrappers over the exam RPCs. Grading and answer keys stay in Postgres. */
import type { Json } from "@/lib/database.types";
import type { AttemptResult, AttemptStatus, Paper, QuestionResponse, StartResult } from "@/domain/exams/types";
import { getBrowserClient } from "@/lib/supabase/client";

type R<T> = { data: T; error: null } | { data: null; error: { code?: string; message: string } };

function wrap<T>(res: { data: unknown; error: { code?: string; message: string } | null }): R<T> {
  return res.error ? { data: null, error: res.error } : { data: res.data as T, error: null };
}

export const examApi = {
  async start(examId: string, guestToken?: string, guestName?: string) {
    return wrap<StartResult>(await getBrowserClient().rpc("start_attempt", {
      p_exam: examId, p_guest_token: guestToken, p_guest_name: guestName || undefined,
    }));
  },
  async paper(attemptId: string, token?: string) {
    return wrap<Paper>(await getBrowserClient().rpc("get_attempt_paper", { p_attempt: attemptId, p_token: token }));
  },
  async save(attemptId: string, examQuestionId: string, response: QuestionResponse, token?: string) {
    return wrap<string>(await getBrowserClient().rpc("save_answer", {
      p_attempt: attemptId, p_exam_question: examQuestionId, p_response: response as unknown as Json, p_token: token,
    }));
  },
  async submit(attemptId: string, answers: Record<string, QuestionResponse>, token?: string) {
    return wrap<AttemptStatus>(await getBrowserClient().rpc("submit_attempt", {
      p_attempt: attemptId, p_answers: answers as unknown as Json, p_token: token,
    }));
  },
  async result(attemptId: string, token?: string) {
    return wrap<AttemptResult>(await getBrowserClient().rpc("get_attempt_result", { p_attempt: attemptId, p_token: token }));
  },
};
