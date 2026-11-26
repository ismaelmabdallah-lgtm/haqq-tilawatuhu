"use client";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { STATUS_LABEL, type ContentStatus } from "@/lib/admin/entities";
import { allowedTransitions } from "@/lib/admin/workflow";
import { table } from "@/lib/admin/db";
import { errorMessage } from "@/lib/errors";
import { getBrowserClient } from "@/lib/supabase/client";
import { can } from "@/lib/auth";

type Event = { id: number; from_status: ContentStatus | null; to_status: ContentStatus; actor_id: string | null; comment: string | null; occurred_at: string };
type Comment = { id: number; author_id: string; body: string; field_path: string | null; resolved: boolean; created_at: string };

const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "medium", timeStyle: "short" });

export function StatusBadge({ status }: { status: ContentStatus }) {
  const tone = status === "published" ? "bg-brand-700 text-white" : status === "approved" ? "bg-brand-50 text-brand-700"
    : status === "changes_requested" ? "bg-red-50 text-danger" : status === "draft" ? "bg-line/60" : "bg-gold-100 text-gold-700";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`} data-status={status}>{STATUS_LABEL[status]}</span>;
}

/** Status, allowed transitions (via transition_content), review history and comments. */
export function WorkflowPanel({ entity, id, status, authorId, onChanged }: {
  entity: string; id: string; status: ContentStatus; authorId: string | null; onChanged: () => void;
}) {
  const { roles, userId } = useAdmin();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [reviewer, setReviewer] = useState("");

  const loadHistory = useCallback(async () => {
    const [ev, cm] = await Promise.all([
      table<Event>("review_events").select("id,from_status,to_status,actor_id,comment,occurred_at").eq("entity_type", entity).eq("entity_id", id).order("occurred_at", { ascending: false }),
      table<Comment>("review_comments").select("id,author_id,body,field_path,resolved,created_at").eq("entity_type", entity).eq("entity_id", id).order("created_at", { ascending: false }),
    ]);
    setEvents(ev.data ?? []); setComments(cm.data ?? []);
  }, [entity, id]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void loadHistory(); });
    return () => { alive = false; };
  }, [loadHistory, status]);

  const transitions = allowedTransitions(status, roles, authorId === userId);

  async function go(to: ContentStatus, needsComment?: boolean) {
    if (needsComment && !comment.trim()) { setMsg({ ok: false, text: "اكتب ملاحظة توضح التعديلات المطلوبة." }); return; }
    setBusy(true); setMsg(null);
    const { error } = await getBrowserClient().rpc("transition_content", { p_entity: entity, p_id: id, p_to: to, p_comment: comment.trim() || undefined });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errorMessage(error) }); return; }
    setComment(""); setMsg({ ok: true, text: `تم: ${STATUS_LABEL[to]}` });
    onChanged();
  }

  async function addComment() {
    if (!newComment.trim()) return;
    const { error } = await table("review_comments").insert({ entity_type: entity, entity_id: id, author_id: userId, body: newComment.trim() });
    if (error) { setMsg({ ok: false, text: errorMessage(error) }); return; }
    setNewComment(""); void loadHistory();
  }

  async function assign() {
    const { error } = await getBrowserClient().rpc("assign_reviewer", { p_entity: entity, p_id: id, p_reviewer: reviewer.trim() });
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "تم تعيين المراجع." });
  }

  /** Super admin: one-step publish/archive/draft via publish_content() (migration 0006). */
  async function direct(to: ContentStatus) {
    setBusy(true); setMsg(null);
    const { error } = await getBrowserClient().rpc("publish_content", { p_entity: entity, p_id: id, p_to: to });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errorMessage(error) }); return; }
    setMsg({ ok: true, text: to === "published" ? "نُشر — يظهر للزوار فورًا دون إعادة بناء." : `تم: ${STATUS_LABEL[to]}` });
    onChanged();
  }
  const solo = can.superAdmin(roles);
  const soloActions: { to: ContentStatus; label: string; tone: "primary" | "neutral" | "danger" }[] = !solo ? [] : [
    ...(status !== "published" ? [{ to: "published" as const, label: status === "archived" ? "إعادة النشر" : "نشر الآن", tone: "primary" as const }] : []),
    ...(status === "published" ? [{ to: "archived" as const, label: "أرشفة (إخفاء عن الزوار)", tone: "danger" as const }] : []),
    ...(status !== "draft" ? [{ to: "draft" as const, label: "إعادة إلى مسودة للتعديل", tone: "neutral" as const }] : []),
  ];

  const lastChangeRequest = events.find((e) => e.to_status === "changes_requested");

  return (
    <section className="rounded-xl border border-line bg-white p-4" data-workflow>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">الحالة:</span><StatusBadge status={status} />
        {authorId === userId && !solo && <span className="text-xs text-muted">(أنت كاتب هذا المحتوى — لا يمكنك اعتماده بنفسك)</span>}
      </div>
      {status === "changes_requested" && lastChangeRequest?.comment && (
        <p className="mt-2 rounded bg-red-50 p-2 text-sm text-danger"><b>ملاحظات المراجع: </b>{lastChangeRequest.comment}</p>
      )}
      {solo && (
        <div className="mt-3 flex flex-wrap gap-2" data-solo-actions>
          {soloActions.map((a) => (
            <button key={a.to} type="button" disabled={busy} onClick={() => void direct(a.to)} data-direct={a.to}
              className={`tap rounded-xl px-5 font-bold disabled:opacity-50 ${a.tone === "primary" ? "bg-brand-700 text-white" : a.tone === "danger" ? "border border-danger text-danger" : "border border-line"}`}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      {transitions.length > 0 && (
        <details className="mt-3" open={!solo}>
          <summary className={solo ? "cursor-pointer text-sm text-muted" : "sr-only"}>مسار المراجعة العلمية بفريق (اختياري)</summary>
        <div className="mt-3">
          {transitions.some((t) => t.needsComment) && (
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="ملاحظة (مطلوبة عند طلب التعديلات)"
              className="mb-2 w-full rounded-lg border border-line p-2 text-sm" aria-label="ملاحظة المراجعة" />
          )}
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <button key={t.to + t.label} type="button" disabled={busy} onClick={() => void go(t.to, t.needsComment)} data-transition={t.to}
                className={`tap rounded-lg px-4 text-sm font-bold disabled:opacity-50 ${t.tone === "primary" ? "bg-brand-700 text-white" : t.tone === "danger" ? "border border-danger text-danger" : "border border-line"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        </details>
      )}
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}

      {roles.some((r) => r === "super_admin" || r === "scientific_review_admin") && (status === "submitted" || status === "under_review") && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} dir="ltr" placeholder="معرّف المراجع (UUID)" className="tap flex-1 rounded-lg border border-line px-2" aria-label="معرّف المراجع" />
          <button type="button" onClick={() => void assign()} className="tap rounded-lg border border-line px-3">تعيين مراجع</button>
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-bold">السجل والملاحظات ({events.length + comments.length})</summary>
        <div className="mt-2 flex gap-2">
          <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="أضف ملاحظة" className="tap flex-1 rounded-lg border border-line px-2 text-sm" aria-label="ملاحظة جديدة" />
          <button type="button" onClick={() => void addComment()} className="tap rounded-lg border border-line px-3 text-sm">إضافة</button>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {comments.map((c) => <li key={`c${c.id}`} className="rounded bg-paper p-2">💬 {c.body} <span className="text-xs text-muted">— {fmt.format(new Date(c.created_at))}</span></li>)}
          {events.map((e) => (
            <li key={`e${e.id}`} className="rounded bg-paper p-2">
              {e.from_status ? STATUS_LABEL[e.from_status] : "—"} ← {STATUS_LABEL[e.to_status]}
              {e.comment && <>: «{e.comment}»</>} <span className="text-xs text-muted">— {fmt.format(new Date(e.occurred_at))}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
