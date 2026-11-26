"use client";
import { useEffect, useState } from "react";
import type { Lookup } from "./entities";
import { table } from "./db";

export type Option = { id: string; label: string };
type Row = Record<string, unknown>;

const SOURCES: Record<Lookup, { table: string; cols: string; order: string; label: (r: Row, ctx: Ctx) => string }> = {
  levels: { table: "levels", cols: "id,title,sort_order", order: "sort_order", label: (r) => String(r.title) },
  chapters: { table: "chapters", cols: "id,title,label,level_id,sort_order", order: "sort_order", label: (r, c) => `${c.levels.get(String(r.level_id)) ?? ""} › ${r.label ? `${r.label}: ` : ""}${r.title}` },
  lessons: { table: "lessons", cols: "id,code,title,status", order: "code", label: (r) => `${r.code} — ${r.title}` },
  editions: { table: "curriculum_editions", cols: "id,label,slug", order: "slug", label: (r) => `${r.label} (${r.slug})` },
  riwayat: { table: "riwayat", cols: "id,name_ar,code", order: "code", label: (r) => String(r.name_ar) },
  resources: { table: "resources", cols: "id,title,kind,status", order: "title", label: (r) => `${r.title} [${r.kind}]` },
  points: { table: "articulation_points", cols: "id,name,general_area,sort_order", order: "sort_order", label: (r) => `${r.general_area} › ${r.name}` },
  characteristics: { table: "letter_characteristics", cols: "id,name", order: "name", label: (r) => String(r.name) },
  examples: { table: "quranic_examples", cols: "id,surah,ayah_start,ayah_end,word_start,word_end,note", order: "surah", label: (r) => `${r.surah}:${r.ayah_start}${r.ayah_end !== r.ayah_start ? `–${r.ayah_end}` : ""}${r.word_start ? ` ك${r.word_start}${r.word_end ? `–${r.word_end}` : ""}` : ""}${r.note ? ` — ${r.note}` : ""}` },
  topics: { table: "tajweed_topics", cols: "id,title", order: "title", label: (r) => String(r.title) },
  letters: { table: "academy_letters", cols: "id,letter,sort_order", order: "sort_order", label: (r) => String(r.letter) },
};
type Ctx = { levels: Map<string, string> };

const cache = new Map<Lookup, Promise<Option[]>>();

async function load(name: Lookup): Promise<Option[]> {
  const src = SOURCES[name];
  const ctx: Ctx = { levels: new Map() };
  if (name === "chapters") (await loadLookup("levels")).forEach((l) => ctx.levels.set(l.id, l.label));
  const { data } = await table(src.table).select(src.cols).order(src.order);
  return (data ?? []).map((r) => ({ id: String(r.id), label: src.label(r, ctx) }));
}

export function loadLookup(name: Lookup, fresh = false): Promise<Option[]> {
  if (fresh || !cache.has(name)) cache.set(name, load(name));
  return cache.get(name)!;
}

export function useLookup(name: Lookup | null): Option[] {
  const [opts, setOpts] = useState<{ name: Lookup | null; list: Option[] }>({ name: null, list: [] });
  useEffect(() => {
    if (!name) return;
    let alive = true;
    void loadLookup(name).then((list) => { if (alive) setOpts({ name, list }); });
    return () => { alive = false; };
  }, [name]);
  return opts.name === name ? opts.list : [];
}
