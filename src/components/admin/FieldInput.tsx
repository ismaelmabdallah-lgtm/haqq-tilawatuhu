"use client";
import type { Field } from "@/lib/admin/entities";
import { useLookup } from "@/lib/admin/lookups";

/** Form values are kept as strings/booleans while editing; toPayload() converts them for the database. */
export type FormValue = string | boolean;

const input = "tap w-full rounded-lg border border-line bg-white px-3 focus:border-brand-500 disabled:bg-paper disabled:text-muted";

export function toFormValue(field: Field, v: unknown): FormValue {
  switch (field.type) {
    case "bool": return Boolean(v);
    case "lines": return Array.isArray(v) ? v.join("\n") : "";
    case "json": return JSON.stringify(v ?? (field.example !== undefined ? [] : null), null, 2);
    case "datetime": {
      if (!v) return "";
      const d = new Date(String(v));
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    default: return v === null || v === undefined ? "" : String(v);
  }
}

/** Returns [value, error]. */
export function fromFormValue(field: Field, v: FormValue): [unknown, string | null] {
  if (field.type === "bool") return [Boolean(v), null];
  const s = String(v);
  switch (field.type) {
    case "int": {
      if (s.trim() === "") return field.required ? [null, "مطلوب"] : [null, null];
      const n = Number(s);
      if (!Number.isInteger(n)) return [null, "عدد صحيح"];
      if (field.min !== undefined && n < field.min) return [null, `لا يقل عن ${field.min}`];
      if (field.max !== undefined && n > field.max) return [null, `لا يزيد عن ${field.max}`];
      return [n, null];
    }
    case "lines": return [s.split("\n").map((x) => x.trim()).filter(Boolean), null];
    case "json": {
      try { return [JSON.parse(s || "null"), null]; } catch { return [null, "JSON غير صالح"]; }
    }
    case "datetime": return s ? [new Date(s).toISOString(), null] : field.required ? [null, "مطلوب"] : [null, null];
    case "ref": case "select": return s ? [s, null] : field.required ? [null, "مطلوب"] : [null, null];
    case "url": return s.trim() ? (/^https:\/\//.test(s.trim()) ? [s.trim(), null] : [null, "يجب أن يبدأ بـ https://"]) : [null, null];
    default: return s.trim() ? [s, null] : field.required ? [null, "مطلوب"] : [null, null];
  }
}

export function FieldInput({ field, value, onChange, disabled, error }: {
  field: Field; value: FormValue; onChange: (v: FormValue) => void; disabled?: boolean; error?: string | null;
}) {
  const options = useLookup(field.type === "ref" ? field.lookup : null);
  const id = `f-${field.name}`;
  const dir = "dir" in field ? field.dir : undefined;
  let control: React.ReactNode;
  switch (field.type) {
    case "bool":
      control = <input id={id} type="checkbox" className="h-5 w-5 accent-brand-700" checked={Boolean(value)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
      break;
    case "textarea": case "lines":
      control = <textarea id={id} dir={dir} rows={field.type === "lines" ? 4 : 3} className={`${input} py-2`} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "markdown": case "json":
      control = <textarea id={id} dir={field.type === "json" ? "ltr" : undefined} rows={field.type === "json" ? 8 : 12} className={`${input} py-2 font-mono text-sm`} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select":
      control = (
        <select id={id} className={input} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {!field.required && <option value="">—</option>}
          {field.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      );
      break;
    case "ref":
      control = (
        <select id={id} className={input} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          {value && !options.some((o) => o.id === value) && <option value={String(value)}>{String(value)}</option>}
        </select>
      );
      break;
    case "int":
      control = <input id={id} type="number" inputMode="numeric" className={input} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "datetime":
      control = <input id={id} type="datetime-local" className={input} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      control = <input id={id} type={field.type === "url" ? "url" : "text"} dir={dir} className={input} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={field.type === "bool" ? "flex items-center gap-3" : ""}>
      <label htmlFor={id} className={`text-sm font-medium ${field.type === "bool" ? "order-2" : "mb-1 block"}`}>
        {field.label}{"required" in field && field.required ? <span className="text-danger"> *</span> : null}
      </label>
      {control}
      {"hint" in field && field.hint && <p className="mt-1 text-xs text-muted">{field.hint}</p>}
      {field.type === "json" && field.example !== undefined && <p className="mt-1 text-xs text-muted" dir="ltr">مثال: {JSON.stringify(field.example)}</p>}
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
