"use client";
/**
 * Guest attempts kept in this browser. The one-time token returned by
 * start_attempt() is the ONLY proof of ownership (the database stores just its
 * SHA-256 hash), so it lives in localStorage to resume, submit, reopen the
 * result, and later claim the attempt into an optional account.
 */
const KEY = "haqq:attempts:v1";

export type LocalAttempt = {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  token: string;
  started_at: string;
  finished?: boolean;
};

function read(): LocalAttempt[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as LocalAttempt[]) : [];
  } catch { return []; }
}
function write(list: LocalAttempt[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); } catch { /* ignore */ }
}

export const attemptStore = {
  all: read,
  get: (attemptId: string) => read().find((a) => a.attempt_id === attemptId),
  /** Unfinished guest attempt for this exam (to resume with its token). */
  openFor: (examId: string) => read().find((a) => a.exam_id === examId && !a.finished),
  forExam: (examId: string) => read().filter((a) => a.exam_id === examId),
  add(a: LocalAttempt) { write([a, ...read().filter((x) => x.attempt_id !== a.attempt_id)]); },
  markFinished(attemptId: string) { write(read().map((a) => (a.attempt_id === attemptId ? { ...a, finished: true } : a))); },
  remove(attemptIds: string[]) { const s = new Set(attemptIds); write(read().filter((a) => !s.has(a.attempt_id))); },
};

/** Unsaved answers survive a refresh / dropped connection until the server confirms them. */
const draftKey = (attemptId: string) => `haqq:draft:${attemptId}`;
export const draftStore = {
  get(attemptId: string): Record<string, unknown> {
    try { return JSON.parse(localStorage.getItem(draftKey(attemptId)) ?? "{}") as Record<string, unknown>; } catch { return {}; }
  },
  set(attemptId: string, examQuestionId: string, response: unknown) {
    const d = draftStore.get(attemptId);
    d[examQuestionId] = response;
    try { localStorage.setItem(draftKey(attemptId), JSON.stringify(d)); } catch { /* ignore */ }
  },
  clearOne(attemptId: string, examQuestionId: string, response: unknown) {
    const d = draftStore.get(attemptId);
    if (JSON.stringify(d[examQuestionId]) === JSON.stringify(response)) {
      delete d[examQuestionId];
      try { localStorage.setItem(draftKey(attemptId), JSON.stringify(d)); } catch { /* ignore */ }
    }
  },
  clear(attemptId: string) { try { localStorage.removeItem(draftKey(attemptId)); } catch { /* ignore */ } },
};
