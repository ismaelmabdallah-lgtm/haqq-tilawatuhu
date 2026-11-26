/** Defensive readers for the lesson jsonb columns (definitions, rules, tables). */
import type { Json } from "@/lib/database.types";

export type Definition = { term: string; definition: string; source_page?: number };
export type Rule = { title: string; body: string; source_page?: number };
export type LessonTable = { caption?: string; columns: string[]; rows: string[][]; source_page?: number };

const obj = (v: Json): Record<string, Json> | null => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, Json> : null);
const str = (v: Json | undefined) => (typeof v === "string" ? v : undefined);
const page = (v: Json | undefined) => (typeof v === "number" && v > 0 ? v : undefined);
const arr = (v: Json): Json[] => (Array.isArray(v) ? v : []);

export function definitions(v: Json): Definition[] {
  return arr(v).flatMap((x) => {
    const o = obj(x); const term = str(o?.term); const definition = str(o?.definition);
    return o && term && definition ? [{ term, definition, source_page: page(o.source_page) }] : [];
  });
}
export function rules(v: Json): Rule[] {
  return arr(v).flatMap((x) => {
    const o = obj(x); const title = str(o?.title); const body = str(o?.body);
    return o && title && body ? [{ title, body, source_page: page(o.source_page) }] : [];
  });
}
export function tables(v: Json): LessonTable[] {
  return arr(v).flatMap((x) => {
    const o = obj(x);
    if (!o) return [];
    const columns = arr(o.columns ?? null).map((c) => (typeof c === "string" ? c : String(c ?? "")));
    const rows = arr(o.rows ?? null).map((r) => arr(r).map((c) => (typeof c === "string" ? c : String(c ?? ""))));
    return columns.length ? [{ caption: str(o.caption), columns, rows, source_page: page(o.source_page) }] : [];
  });
}
