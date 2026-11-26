"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth";
import { markLocal, progressStore } from "@/lib/progress";
import { getBrowserClient } from "@/lib/supabase/client";

function useLocalProgress() {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get, progressStore.server);
}

export function LessonProgressDot({ lessonId }: { lessonId: string }) {
  const p = useLocalProgress()[lessonId];
  if (p?.completed_at) return <span className="text-brand-600" title="أكملت هذا الدرس" aria-label="مكتمل">●</span>;
  if (p?.viewed_at) return <span className="text-gold-500" title="اطّلعت على هذا الدرس" aria-label="تمت المشاهدة">◐</span>;
  return <span className="text-line" aria-hidden>○</span>;
}

/** Marks the lesson viewed on open; toggles completion. Syncs to the account when signed in. */
export function LessonProgressControls({ lessonId }: { lessonId: string }) {
  const progress = useLocalProgress()[lessonId];
  const { session } = useSession();
  const signedIn = Boolean(session);

  useEffect(() => {
    markLocal(lessonId, "viewed");
    if (signedIn) void getBrowserClient().rpc("mark_lesson", { p_lesson: lessonId, p_action: "viewed" });
  }, [lessonId, signedIn]);

  const done = Boolean(progress?.completed_at);
  function toggle() {
    const action = done ? "uncompleted" : "completed";
    markLocal(lessonId, action);
    if (signedIn) void getBrowserClient().rpc("mark_lesson", { p_lesson: lessonId, p_action: action });
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
      <button type="button" onClick={toggle} aria-pressed={done}
        className={`tap inline-flex items-center rounded-lg px-4 font-bold ${done ? "bg-brand-50 text-brand-700" : "bg-brand-700 text-white"}`}>
        {done ? "✓ أكملت هذا الدرس" : "أكملت الدرس"}
      </button>
      <span className="text-sm text-muted">
        {signedIn ? "يُحفظ تقدّمك في حسابك." : "يُحفظ تقدّمك في هذا المتصفح. أنشئ حسابًا اختياريًا لمزامنته بين أجهزتك."}
      </span>
    </div>
  );
}
