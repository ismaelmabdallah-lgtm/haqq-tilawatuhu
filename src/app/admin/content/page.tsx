"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/WorkflowPanel";
import { LESSON_TABS, SubTabs } from "@/components/admin/SubTabs";
import { ENTITIES, STATUS_LABEL, type ContentStatus, type EntityKey } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";
import { errorMessage } from "@/lib/errors";

type Row = Record<string, unknown>;

export default function ContentListPage() {
  const sp = useSearchParams();
  const key = (sp.get("entity") ?? "lessons") as EntityKey;
  const cfg = ENTITIES[key];
  const [rows, setRows] = useState<{ key: EntityKey; list: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ContentStatus | "">("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!cfg) return;
    let alive = true;
    void table(cfg.key).select("*").order(cfg.order, { ascending: cfg.key !== "announcements" && cfg.key !== "resources" }).limit(1000)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(errorMessage(err)); else setRows({ key: cfg.key, list: data ?? [] });
      });
    return () => { alive = false; };
  }, [cfg]);

  if (!cfg) return <p>نوع غير معروف.</p>;
  const list = rows?.key === key ? rows.list : null;
  const filtered = (list ?? []).filter((r) => (!status || r.status === status) && (!q || JSON.stringify(r).includes(q)));

  return (
    <div data-content-list={key}>
      {(key === "lessons" || key === "quranic_examples") && <SubTabs tabs={LESSON_TABS} active={key} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-900">{cfg.label}</h1>
        <Link href={`/admin/content/edit/?entity=${key}`} className="tap inline-flex items-center rounded-lg bg-brand-700 px-4 text-white" data-new>+ {cfg.singular} جديد</Link>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث" className="tap flex-1 rounded-lg border border-line px-3" aria-label="بحث" />
        {cfg.reviewable && (
          <select value={status} onChange={(e) => setStatus(e.target.value as ContentStatus | "")} className="tap rounded-lg border border-line px-2" aria-label="الحالة">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {!list ? <p>جارٍ التحميل…</p> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-50"><tr>
              {cfg.listColumns.map((c) => <th key={c.name} className="px-3 py-2 text-start">{c.label}</th>)}
              {cfg.reviewable && <th className="px-3 py-2 text-start">الحالة</th>}
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={String(r.id)} className="border-t border-line hover:bg-paper">
                  {cfg.listColumns.map((c, i) => (
                    <td key={c.name} className="px-3 py-2">
                      {i === 0 || c.name === "title" ? <Link href={`/admin/content/edit/?entity=${key}&id=${String(r.id)}`} className="text-brand-700 underline">{fmt(r[c.name])}</Link> : fmt(r[c.name])}
                    </td>
                  ))}
                  {cfg.reviewable && <td className="px-3 py-2"><StatusBadge status={r.status as ContentStatus} /></td>}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="px-3 py-4 text-muted" colSpan={9}>لا توجد عناصر.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (typeof v === "boolean") return v ? "نعم" : "—";
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("ar-u-nu-arab");
  return String(v);
}
