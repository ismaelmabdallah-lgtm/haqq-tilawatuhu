/** Human-readable answers for the result page (student response and, when released, the key). */
import type { Part } from "@/domain/questions/schema";
import type { PartResponse } from "@/domain/exams/types";

const optText = (part: Part, id: string): string => {
  const pools = "options" in part ? part.options : "items" in part ? part.items : "right" in part ? part.right : [];
  return pools.find((o) => o.id === id)?.text ?? id;
};
const leftText = (part: Part, id: string) => ("left" in part ? part.left.find((o) => o.id === id)?.text : undefined) ?? id;
const cellLabel = (part: Part, k: string) => {
  if (part.type !== "table") return k;
  const [r, c] = k.split(":");
  return `${part.rows.find((x) => x.id === r)?.label ?? r} / ${part.columns.find((x) => x.id === c)?.label ?? c}`;
};

export function responseText(part: Part, r: PartResponse | undefined): string[] {
  if (!r) return [];
  if ("choice" in r) return [optText(part, r.choice)];
  if ("choices" in r) return r.choices.map((c) => optText(part, c));
  if ("value" in r) return [r.value ? "صواب" : "خطأ"];
  if ("text" in r) return [r.text];
  if ("order" in r) return r.order.map((id, i) => `${i + 1}. ${optText(part, id)}`);
  if ("slots" in r) {
    return Object.entries(r.slots).map(([k, v]) => {
      if (part.type === "matching") return `${leftText(part, k)} ← ${optText(part, v)}`;
      if (part.type === "drag_drop") return `${k}: ${optText(part, v)}`;
      if (part.type === "table") return `${cellLabel(part, k)}: ${v}`;
      return `${k}: ${v}`;
    });
  }
  return [];
}

/** Formats a part key (only present in results when the exam allows model answers). */
export function keyText(part: Part, key: unknown): string[] {
  if (!key || typeof key !== "object") return [];
  const k = key as Record<string, unknown>;
  const slots = (k.slots ?? {}) as Record<string, string | string[]>;
  const one = (v: string | string[]) => (Array.isArray(v) ? v.join(" / ") : v);
  switch (part.type) {
    case "single_choice": return typeof k.correct === "string" ? [optText(part, k.correct)] : [];
    case "multiple_choice": return Array.isArray(k.correct) ? (k.correct as string[]).map((c) => optText(part, c)) : [];
    case "true_false": return typeof k.correct === "boolean" ? [k.correct ? "صواب" : "خطأ"] : [];
    case "short_text": return Array.isArray(k.accepted) ? [(k.accepted as string[]).join(" / ")] : [];
    case "ordering": return Array.isArray(k.order) ? (k.order as string[]).map((id, i) => `${i + 1}. ${optText(part, id)}`) : [];
    case "matching": return Object.entries(slots).map(([l, r]) => `${leftText(part, l)} ← ${Array.isArray(r) ? r.map((x) => optText(part, x)).join(" / ") : optText(part, r)}`);
    case "drag_drop": return Object.entries(slots).map(([s, r]) => `${s}: ${Array.isArray(r) ? r.map((x) => optText(part, x)).join(" / ") : optText(part, r)}`);
    case "table": return Object.entries(slots).map(([c, v]) => `${cellLabel(part, c)}: ${one(v)}`);
    case "fill_blank": return Object.entries(slots).map(([s, v]) => `${s}: ${one(v)}`);
    default: return [];
  }
}

/** Model answers are stored per part id ({partId: {text}}) or as a single {text}. */
export function modelAnswerText(model: Record<string, unknown> | null, partId: string): string | null {
  if (!model) return null;
  const v = (model[partId] ?? null) as { text?: unknown } | string | null;
  if (typeof v === "string") return v;
  if (v && typeof v.text === "string") return v.text;
  return null;
}
