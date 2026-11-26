"use client";
import type { Part } from "@/domain/questions/schema";
import { splitSlots, type PartResponse } from "@/domain/exams/types";
import { arDigits } from "@/lib/quran/ref";

type Props = { part: Part; value: PartResponse | undefined; onChange: (v: PartResponse | undefined) => void; disabled?: boolean; name: string };

const box = "tap rounded-lg border border-line bg-white px-3 focus:border-brand-500";

/**
 * Inputs for all 11 part types. Each produces exactly the response shape that
 * grade_part() grades: {choice} {choices} {value} {text} {order} {slots}.
 * Options arrive already shuffled per attempt by the server.
 */
export function PartInput({ part, value, onChange, disabled, name }: Props) {
  switch (part.type) {
    case "single_choice": {
      const cur = value && "choice" in value ? value.choice : undefined;
      return (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">{part.prompt ?? "اختر إجابة واحدة"}</legend>
          {part.options.map((o) => (
            <label key={o.id} className={`tap flex cursor-pointer items-center gap-3 rounded-lg border px-3 ${cur === o.id ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}>
              <input type="radio" name={name} value={o.id} checked={cur === o.id} onChange={() => onChange({ choice: o.id })} className="h-5 w-5 accent-brand-700" />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    case "multiple_choice": {
      const cur = value && "choices" in value ? value.choices : [];
      const toggle = (id: string) => {
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        onChange(next.length ? { choices: next } : undefined);
      };
      return (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="mb-1 text-sm text-muted">اختر كل الإجابات الصحيحة</legend>
          {part.options.map((o) => (
            <label key={o.id} className={`tap flex cursor-pointer items-center gap-3 rounded-lg border px-3 ${cur.includes(o.id) ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}>
              <input type="checkbox" checked={cur.includes(o.id)} onChange={() => toggle(o.id)} className="h-5 w-5 accent-brand-700" />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    case "true_false": {
      const cur = value && "value" in value ? value.value : undefined;
      return (
        <div className="flex gap-2" role="radiogroup" aria-label={part.prompt ?? "صواب أم خطأ"}>
          {([true, false] as const).map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={cur === v} disabled={disabled} onClick={() => onChange({ value: v })}
              className={`tap flex-1 rounded-lg border font-bold ${cur === v ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-white"}`}>
              {v ? "صواب" : "خطأ"}
            </button>
          ))}
        </div>
      );
    }
    case "short_text":
      return (
        <input type="text" dir="rtl" className={`${box} w-full`} disabled={disabled} maxLength={500} aria-label={part.prompt ?? "إجابتك"}
          value={value && "text" in value ? value.text : ""} onChange={(e) => onChange(e.target.value ? { text: e.target.value } : undefined)} />
      );
    case "long_text":
      return (
        <div>
          <textarea dir="rtl" rows={5} className={`${box} w-full py-2`} disabled={disabled} maxLength={10000} aria-label={part.prompt ?? "إجابتك"}
            value={value && "text" in value ? value.text : ""} onChange={(e) => onChange(e.target.value ? { text: e.target.value } : undefined)} />
          <p className="mt-1 text-xs text-muted">تُصحَّح هذه الإجابة يدويًا من مصحح المنصة.</p>
        </div>
      );
    case "audio_response":
      return (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-warn" data-audio-unsupported>
          الإجابة الصوتية غير متاحة عبر الموقع حاليًا. يمكنك متابعة بقية الأسئلة.
        </p>
      );
    case "fill_blank":
    case "drag_drop": {
      const slots = value && "slots" in value ? value.slots : {};
      const set = (id: string, v: string) => {
        const next = { ...slots, [id]: v };
        if (!v) delete next[id];
        onChange(Object.keys(next).length ? { slots: next } : undefined);
      };
      return (
        <p className="leading-[3]">
          {splitSlots(part.text).map((seg, i) => seg.kind === "text" ? <span key={i}>{seg.value}</span> : part.type === "fill_blank" ? (
            <input key={i} type="text" dir="rtl" aria-label={`الفراغ ${seg.id}`} disabled={disabled}
              className="mx-1 inline-block w-36 rounded-md border-b-2 border-brand-500 bg-brand-50/50 px-2 text-center"
              value={slots[seg.id] ?? ""} onChange={(e) => set(seg.id, e.target.value)} />
          ) : (
            <select key={i} aria-label={`الفراغ ${seg.id}`} disabled={disabled} value={slots[seg.id] ?? ""} onChange={(e) => set(seg.id, e.target.value)}
              className="mx-1 inline-block rounded-md border border-brand-500 bg-brand-50/50 px-2 py-1">
              <option value="">— اختر —</option>
              {part.options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
            </select>
          ))}
        </p>
      );
    }
    case "table": {
      const slots = value && "slots" in value ? value.slots : {};
      const set = (k: string, v: string) => {
        const next = { ...slots, [k]: v };
        if (!v) delete next[k];
        onChange(Object.keys(next).length ? { slots: next } : undefined);
      };
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead><tr className="bg-brand-50"><th className="border border-line p-2" />{part.columns.map((c) => <th key={c.id} scope="col" className="border border-line p-2">{c.label}</th>)}</tr></thead>
            <tbody>
              {part.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="border border-line p-2 text-start font-medium">{r.label}</th>
                  {part.columns.map((c) => {
                    const given = r.cells?.[c.id];
                    const k = `${r.id}:${c.id}`;
                    return (
                      <td key={c.id} className="border border-line p-1">
                        {given !== undefined ? <span className="px-2 text-muted">{given}</span> : (
                          <input type="text" dir="rtl" disabled={disabled} aria-label={`${r.label} — ${c.label}`}
                            className="w-full rounded border border-line px-2 py-2" value={slots[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "matching": {
      const slots = value && "slots" in value ? value.slots : {};
      return (
        <ul className="space-y-2">
          {part.left.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2">
              <span className="min-w-28 flex-1 font-medium">{l.text}</span>
              <span aria-hidden className="text-muted">←</span>
              <select aria-label={`ما يقابل: ${l.text}`} disabled={disabled} value={slots[l.id] ?? ""}
                onChange={(e) => {
                  const next = { ...slots, [l.id]: e.target.value };
                  if (!e.target.value) delete next[l.id];
                  onChange(Object.keys(next).length ? { slots: next } : undefined);
                }}
                className="tap min-w-40 flex-1 rounded-lg border border-line bg-white px-2">
                <option value="">— اختر —</option>
                {part.right.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
              </select>
            </li>
          ))}
        </ul>
      );
    }
    case "ordering": {
      const order = value && "order" in value ? value.order : part.items.map((i) => i.id);
      const confirmed = Boolean(value && "order" in value);
      const move = (i: number, d: -1 | 1) => {
        const j = i + d;
        if (j < 0 || j >= order.length) return;
        const next = [...order];
        [next[i], next[j]] = [next[j]!, next[i]!];
        onChange({ order: next });
      };
      return (
        <div>
          <ol className="space-y-2">
            {order.map((id, i) => {
              const item = part.items.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-line bg-white p-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">{arDigits(i + 1)}</span>
                  <span className="flex-1">{item?.text ?? id}</span>
                  <button type="button" className="tap rounded border border-line" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`تحريك «${item?.text}» لأعلى`}>▲</button>
                  <button type="button" className="tap rounded border border-line" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label={`تحريك «${item?.text}» لأسفل`}>▼</button>
                </li>
              );
            })}
          </ol>
          {!confirmed && (
            <button type="button" disabled={disabled} onClick={() => onChange({ order })} className="tap mt-2 rounded-lg border border-brand-500 px-3 text-sm text-brand-700">
              اعتماد هذا الترتيب
            </button>
          )}
        </div>
      );
    }
  }
}
