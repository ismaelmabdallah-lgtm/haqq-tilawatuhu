"use client";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { FieldInput, fromFormValue, toFormValue, type FormValue } from "@/components/admin/FieldInput";
import { LinksEditor } from "@/components/admin/LinksEditor";
import { UploadWidget } from "@/components/admin/UploadWidget";
import { WorkflowPanel } from "@/components/admin/WorkflowPanel";
import { QuranVerseClient } from "@/components/quran/QuranVerseClient";
import { ENTITIES, isEditable, type ContentStatus, type EntityKey } from "@/lib/admin/entities";
import { table } from "@/lib/admin/db";
import { loadLookup } from "@/lib/admin/lookups";
import { errorMessage } from "@/lib/errors";

type Row = Record<string, unknown>;

/** Create/edit any configured entity. Only draft/changes_requested content can be edited (tg_content_guard). */
export function EntityEditor({ entity, id }: { entity: EntityKey; id: string | null }) {
  const cfg = ENTITIES[entity];
  const { userId } = useAdmin();
  const [row, setRow] = useState<Row | null | undefined>(id ? undefined : null);
  const [values, setValues] = useState<Record<string, FormValue>>(() =>
    Object.fromEntries(cfg.fields.map((f) => [f.name, toFormValue(f, cfg.defaults?.[f.name] ?? (f.type === "datetime" && f.required ? new Date().toISOString() : null))])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await table(cfg.key).select("*").eq("id", id).maybeSingle();
    if (error || !data) { setRow(null); setMsg({ ok: false, text: error ? errorMessage(error) : "غير موجود أو لا تملك صلاحية عرضه." }); return; }
    setRow(data);
    setValues(Object.fromEntries(cfg.fields.map((f) => [f.name, toFormValue(f, data[f.name])])));
  }, [cfg, id]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  if (id && row === undefined) return <p>جارٍ التحميل…</p>;
  if (id && row === null) return <p role="alert" className="text-danger">{msg?.text}</p>;

  const status = (row?.status as ContentStatus | undefined) ?? undefined;
  const editable = !cfg.reviewable || isEditable(status);

  async function save() {
    const payload: Row = {};
    const errs: Record<string, string> = {};
    for (const f of cfg.fields) {
      const [v, err] = fromFormValue(f, values[f.name] ?? "");
      if (err) errs[f.name] = err; else payload[f.name] = v;
    }
    setErrors(errs);
    if (Object.keys(errs).length) { setMsg({ ok: false, text: "راجع الحقول المظللة." }); return; }
    setSaving(true); setMsg(null);
    if (!id) {
      payload.created_by = userId;
      const { data, error } = await table(cfg.key).insert(payload).select("id").single();
      setSaving(false);
      if (error || !data) { setMsg({ ok: false, text: errorMessage(error) }); return; }
      void loadLookup(lookupFor(entity), true);
      window.location.replace(`/admin/content/edit/?entity=${entity}&id=${String(data.id)}`);
      return;
    }
    const { error } = await table(cfg.key).update(payload).eq("id", id);
    setSaving(false);
    if (error) { setMsg({ ok: false, text: errorMessage(error) }); return; }
    setMsg({ ok: true, text: "تم الحفظ." });
    void load();
  }

  const v = values;
  const isExample = entity === "quranic_examples";
  const exampleRef = isExample && Number(v.surah) >= 1 && Number(v.surah) <= 114 && Number(v.ayah_start) >= 1
    ? { surah: Number(v.surah), ayah: Number(v.ayah_start), ayahEnd: Number(v.ayah_end) || undefined, wordStart: Number(v.word_start) || undefined, wordEnd: Number(v.word_end) || undefined }
    : null;

  return (
    <div className="space-y-4" data-entity-editor={entity}>
      <h1 className="text-2xl font-bold text-brand-900">{id ? `${cfg.singular}: ${cfg.title(row ?? {})}` : `${cfg.singular} جديد`}</h1>
      {cfg.reviewable && id && status && (
        <WorkflowPanel entity={cfg.key} id={id} status={status} authorId={(row?.created_by as string | null) ?? null} onChanged={() => void load()} />
      )}
      {!editable && <p className="rounded-lg bg-gold-100 p-3 text-sm text-gold-700">المحتوى مجمّد في حالته الحالية. أعده إلى «مسودة» لتعديله (سيتطلب مراجعة علمية جديدة قبل النشر).</p>}

      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4 rounded-xl border border-line bg-white p-4">
        {cfg.fields.map((f) => (
          <FieldInput key={f.name} field={f} value={values[f.name] ?? ""} disabled={!editable || saving} error={errors[f.name]}
            onChange={(val) => setValues((s) => ({ ...s, [f.name]: val }))} />
        ))}
        {entity === "resources" && v.provider === "supabase" && editable && (
          <UploadWidget onUploaded={(u) => setValues((s) => ({ ...s, object_key: u.object_key, size_bytes: String(u.size_bytes), mime_type: u.mime_type,
            kind: s.kind === "diagram" && u.kind === "image" ? s.kind : u.kind }))} />
        )}
        {exampleRef && (
          <div>
            <p className="text-sm font-medium">معاينة من النص القرآني الموثق (تنزيل):</p>
            <QuranVerseClient quranRef={exampleRef} />
          </div>
        )}
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
        {editable && <button type="submit" disabled={saving} className="tap rounded-lg bg-brand-700 px-6 font-bold text-white disabled:opacity-60" data-save>{saving ? "جارٍ الحفظ…" : id ? "حفظ" : "إنشاء"}</button>}
      </form>

      {id && cfg.links?.map((l) => <LinksEditor key={String(l.table)} def={l} selfId={id} />)}
    </div>
  );
}

function lookupFor(e: EntityKey) {
  return ({ lessons: "lessons", quranic_examples: "examples", resources: "resources", tajweed_topics: "topics", articulation_points: "points", letter_characteristics: "characteristics", academy_letters: "letters", announcements: "levels" } as const)[e];
}
