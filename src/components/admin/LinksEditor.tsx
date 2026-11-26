"use client";
import { useCallback, useEffect, useState } from "react";
import type { LinkDef } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";
import { useLookup } from "@/lib/admin/lookups";
import { errorMessage } from "@/lib/errors";

type Row = Record<string, unknown>;

/** Many-to-many links (lesson ↔ examples/resources/related, topic ↔ lessons, letter ↔ characteristics/examples). */
export function LinksEditor({ def, selfId }: { def: LinkDef; selfId: string }) {
  const options = useLookup(def.lookup);
  const [rows, setRows] = useState<Row[]>([]);
  const [pick, setPick] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await table(def.table).select("*").eq(def.self, selfId);
    setRows(data ?? []);
  }, [def, selfId]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  async function add() {
    if (!pick) return;
    setError(null);
    const row: Row = { [def.self]: selfId, [def.other]: pick };
    for (const x of def.extra ?? []) if (extra[x.name]) row[x.name] = extra[x.name];
    if ("sort_order" in (rows[0] ?? {}) || def.table === "lesson_examples" || def.table === "lesson_resources") row.sort_order = rows.length + 1;
    const { error: err } = await table(def.table).insert(row);
    if (err) { setError(errorMessage(err)); return; }
    setPick(""); setExtra({}); void load();
  }
  async function remove(otherId: string) {
    const { error: err } = await table(def.table).delete().eq(def.self, selfId).eq(def.other, otherId);
    if (err) setError(errorMessage(err)); else void load();
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4" data-links={def.table}>
      <h3 className="mb-2 font-bold">{def.label}</h3>
      <ul className="space-y-1">
        {rows.map((r) => {
          const oid = String(r[def.other]);
          return (
            <li key={oid} className="flex items-center justify-between gap-2 rounded bg-paper px-2 py-1 text-sm">
              <span>{options.find((o) => o.id === oid)?.label ?? oid}{def.extra?.map((x) => (r[x.name] ? ` — ${r[x.name]}` : "")).join("")}</span>
              <button type="button" onClick={() => void remove(oid)} className="tap text-danger" aria-label="إزالة">✕</button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-sm text-muted">لا يوجد.</li>}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="tap min-w-48 flex-1 rounded-lg border border-line px-2 text-sm" aria-label={`إضافة إلى ${def.label}`}>
          <option value="">— اختر —</option>
          {options.filter((o) => o.id !== selfId && !rows.some((r) => String(r[def.other]) === o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {def.extra?.map((x) => (
          <input key={x.name} placeholder={x.label} value={extra[x.name] ?? ""} onChange={(e) => setExtra({ ...extra, [x.name]: e.target.value })} className="tap rounded-lg border border-line px-2 text-sm" />
        ))}
        <button type="button" onClick={() => void add()} className="tap rounded-lg border border-brand-500 px-3 text-sm text-brand-700">إضافة</button>
      </div>
      <p className="mt-1 text-xs text-muted">الروابط تظهر للعامة فقط عندما يكون الطرفان منشورين.</p>
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
