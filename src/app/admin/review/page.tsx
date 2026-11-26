"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { StatusBadge, WorkflowPanel } from "@/components/admin/WorkflowPanel";
import { ENTITIES, REVIEWABLE, type ContentStatus, type EntityKey } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";

type Item = { entity: string; label: string; id: string; title: string; status: ContentStatus; created_by: string | null; updated_at: string };
type Row = Record<string, unknown>;

const titleOf = (entity: string, r: Row) =>
  entity === "question_versions" ? `${String((r.prompt as { stem?: string } | null)?.stem ?? "سؤال").slice(0, 80)} (إصدار ${r.version_no})`
    : ENTITIES[entity as EntityKey]?.title(r) ?? String(r.id);

/** Scientific review queue across every reviewable table, with snapshot comparison. */
export default function ReviewPage() {
  const mine = useSearchParams().get("mine") === "1";
  const { userId } = useAdmin();
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Item | null>(null);

  const load = useCallback(async () => {
    const statuses = mine ? ["changes_requested", "draft"] : ["submitted", "under_review", "approved"];
    const lists = await Promise.all(REVIEWABLE.map(async (r) => {
      const { data } = await table(r.entity).select("*").in("status", statuses).order("updated_at", { ascending: false }).limit(200);
      return (data ?? []).map((row) => ({ entity: r.entity, label: r.label, id: String(row.id), title: titleOf(r.entity, row), status: row.status as ContentStatus, created_by: (row.created_by as string | null) ?? null, updated_at: String(row.updated_at) }));
    }));
    setItems(lists.flat().filter((i) => !mine || i.created_by === userId).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  }, [mine, userId]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  return (
    <div data-review-queue>
      <h1 className="mb-1 text-2xl font-bold text-brand-900">{mine ? "محتواي (مسودات وطلبات تعديل)" : "المراجعة العلمية"}</h1>
      <p className="mb-4 text-sm text-muted">{mine ? "" : "يعتمد المراجع ما لم يكتبه بنفسه، ثم ينشره مدير المراجعة."}</p>
      {!items ? <p>جارٍ التحميل…</p> : items.length === 0 ? <p className="text-muted">لا توجد عناصر.</p> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.entity + i.id}>
                <button type="button" onClick={() => setOpen(i)} data-review-item={i.id}
                  className={`w-full rounded-xl border p-3 text-start ${open?.id === i.id ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}>
                  <span className="flex items-center justify-between gap-2"><span className="text-xs text-gold-700">{i.label}</span><StatusBadge status={i.status} /></span>
                  <span className="mt-1 block font-bold">{i.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <div>{open ? <ReviewDetail key={open.entity + open.id + open.status} item={open} onChanged={() => { setOpen(null); void load(); }} /> : <p className="text-muted">اختر عنصرًا للمراجعة.</p>}</div>
        </div>
      )}
    </div>
  );
}

function ReviewDetail({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [row, setRow] = useState<Row | null>(null);
  const [prev, setPrev] = useState<Row | null>(null);
  const [key, setKey] = useState<Row | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cur, ev, k] = await Promise.all([
        table(item.entity).select("*").eq("id", item.id).maybeSingle(),
        table("review_events").select("snapshot,to_status,occurred_at").eq("entity_type", item.entity).eq("entity_id", item.id).order("occurred_at", { ascending: false }).limit(20),
        item.entity === "question_versions" ? table("question_keys").select("*").eq("question_version_id", item.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      setRow(cur.data ?? null);
      // Compare with the snapshot taken at the last approval/publication (or the oldest one we have).
      const events = (ev.data ?? []) as { snapshot: Row; to_status: string }[];
      setPrev(events.find((e) => e.to_status === "approved" || e.to_status === "published")?.snapshot ?? null);
      setKey((k.data as Row | null) ?? null);
    })();
    return () => { alive = false; };
  }, [item]);

  if (!row) return <p>جارٍ التحميل…</p>;
  const skip = new Set(["search_norm", "updated_at", "created_at", "status", "scientifically_verified"]);
  const fields = Object.keys(row).filter((f) => !skip.has(f));
  const changed = (f: string) => prev && JSON.stringify(prev[f]) !== JSON.stringify(row[f]);

  return (
    <div className="space-y-3" data-review-detail>
      <WorkflowPanel entity={item.entity} id={item.id} status={row.status as ContentStatus} authorId={(row.created_by as string | null) ?? null} onChanged={onChanged} />
      {item.entity !== "question_versions" && (
        <Link href={`/admin/content/edit/?entity=${item.entity}&id=${item.id}`} className="tap inline-flex items-center text-sm text-brand-700 underline">فتح في المحرر</Link>
      )}
      <div className="rounded-xl border border-line bg-white p-3">
        <p className="mb-2 text-sm font-bold">{prev ? "المحتوى (الحقول المعدّلة منذ آخر اعتماد مظللة)" : "المحتوى"}</p>
        <dl className="space-y-2 text-sm">
          {fields.map((f) => (
            <div key={f} className={`rounded p-2 ${changed(f) ? "bg-gold-100" : "bg-paper"}`}>
              <dt className="text-xs font-bold text-muted" dir="ltr">{f}</dt>
              <dd className="whitespace-pre-wrap break-words" dir="auto">{show(row[f])}</dd>
              {changed(f) && <dd className="mt-1 whitespace-pre-wrap break-words text-xs text-muted line-through" dir="auto">{show(prev![f])}</dd>}
            </div>
          ))}
        </dl>
      </div>
      {key && (
        <div className="rounded-xl border border-brand-500 bg-white p-3 text-sm" data-review-key>
          <p className="mb-1 font-bold">مفتاح الإجابة (يراجَع علميًا مع السؤال — لا يصل إلى المتعلمين)</p>
          <pre dir="ltr" className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify({ key: key.key, model_answer: key.model_answer, explanation: key.explanation }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
}
