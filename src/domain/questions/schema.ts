/**
 * Question structure shared by the exam builder (client) and server actions.
 * The database enforces the same rules (tg_question_version_prepare,
 * grade_part); these schemas give authors immediate, field-level feedback.
 *
 * A question = stem + media + optional Quran reference + 1..n PARTS.
 * Each part has its own type, marks and key, so multi-part Tajweed questions
 * (Raa: wasl / waqf / reason) need no special code.
 */
import { z } from "zod";

export const PART_TYPES = [
  "single_choice", "multiple_choice", "true_false", "short_text", "long_text",
  "fill_blank", "drag_drop", "table", "matching", "ordering", "audio_response",
] as const;
export type PartType = (typeof PART_TYPES)[number];

/** Field names that must never appear in a student-visible prompt part. */
export const FORBIDDEN_PROMPT_KEYS = ["correct", "accepted", "answer", "answers", "order_key", "pairs_key"] as const;

const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "معرّف غير صالح");
const option = z.object({ id, text: z.string().min(1).max(500), image_resource_id: z.string().uuid().optional() });

export const quranRefSchema = z.object({
  surah: z.number().int().min(1).max(114),
  ayah: z.number().int().min(1).max(286),
  ayah_end: z.number().int().min(1).max(286).optional(),
  word_start: z.number().int().min(1).optional(),
  word_end: z.number().int().min(1).optional(),
});

const base = { id, marks: z.number().min(0).max(100), prompt: z.string().max(2000).optional() };

export const partSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("single_choice"), options: z.array(option).min(2).max(10) }),
  z.object({ ...base, type: z.literal("multiple_choice"), options: z.array(option).min(2).max(12) }),
  z.object({ ...base, type: z.literal("true_false") }),
  z.object({ ...base, type: z.literal("short_text") }),
  z.object({ ...base, type: z.literal("long_text") }),
  z.object({ ...base, type: z.literal("audio_response"), max_seconds: z.number().int().min(5).max(600).default(120) }),
  // text uses {slotId} placeholders, e.g. "أحكام النون {b1} و{b2}"
  z.object({ ...base, type: z.literal("fill_blank"), text: z.string().min(3).max(2000) }),
  z.object({ ...base, type: z.literal("drag_drop"), text: z.string().min(3).max(2000), options: z.array(option).min(2).max(20) }),
  z.object({
    ...base, type: z.literal("table"),
    columns: z.array(z.object({ id, label: z.string().max(200) })).min(1).max(8),
    rows: z.array(z.object({ id, label: z.string().max(300), cells: z.record(z.string(), z.string().max(300)).optional() })).min(1).max(30),
  }),
  z.object({ ...base, type: z.literal("matching"), left: z.array(option).min(2).max(15), right: z.array(option).min(2).max(15) }),
  z.object({ ...base, type: z.literal("ordering"), items: z.array(option).min(2).max(15) }),
]);
export type Part = z.infer<typeof partSchema>;

const promptShape = z.object({
  stem: z.string().min(1).max(4000),
  quran_ref: quranRefSchema.optional(),
  media: z.array(z.object({ resource_id: z.string().uuid() })).max(6).optional(),
  parts: z.array(partSchema).min(1).max(12),
});

/**
 * Checks run on the RAW input, before zod strips unknown keys — otherwise an
 * answer placed in a prompt part would be silently dropped instead of flagged.
 */
export const promptSchema = z.unknown().superRefine((raw, ctx) => {
  const parts = (raw as { parts?: unknown })?.parts;
  if (!Array.isArray(parts)) return;
  const ids = new Set<string>();
  parts.forEach((part, i) => {
    if (!part || typeof part !== "object") return;
    const pid = (part as { id?: unknown }).id;
    if (typeof pid === "string") {
      if (ids.has(pid)) ctx.addIssue({ code: "custom", path: ["parts", i, "id"], message: "معرّف الجزء مكرر" });
      ids.add(pid);
    }
    for (const k of FORBIDDEN_PROMPT_KEYS) {
      if (k in part) ctx.addIssue({ code: "custom", path: ["parts", i, k], message: "بيانات الإجابة لا توضع في نص السؤال" });
    }
  });
}).pipe(promptShape);
export type Prompt = z.infer<typeof promptShape>;

// --- keys --------------------------------------------------------------------
const scoring = z.enum(["partial", "all_or_nothing"]).optional();
const slotValue = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);

export const partKeySchemas = {
  single_choice: z.object({ correct: id }),
  multiple_choice: z.object({ correct: z.array(id).min(1), scoring }),
  true_false: z.object({ correct: z.boolean() }),
  short_text: z.object({ accepted: z.array(z.string().min(1)).min(1), manual_if_unmatched: z.boolean().optional() }),
  long_text: z.object({}).passthrough(),
  audio_response: z.object({}).passthrough(),
  fill_blank: z.object({ slots: z.record(id, slotValue), scoring }),
  table: z.object({ slots: z.record(z.string().regex(/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/, "rowId:colId"), slotValue), scoring }),
  drag_drop: z.object({ slots: z.record(id, slotValue), scoring }),
  matching: z.object({ slots: z.record(id, slotValue), scoring }),
  ordering: z.object({ order: z.array(id).min(2), scoring }),
} satisfies Record<PartType, z.ZodTypeAny>;

/** Validates a full key against its prompt (every auto part keyed, ids exist). */
export function validateKey(prompt: Prompt, key: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const part of prompt.parts) {
    const k = key[part.id];
    if (part.type === "long_text" || part.type === "audio_response") continue;
    if (k === undefined) { errors.push(`${part.id}: لا يوجد مفتاح إجابة`); continue; }
    const parsed = partKeySchemas[part.type].safeParse(k);
    if (!parsed.success) { errors.push(`${part.id}: ${parsed.error.issues.map((i) => i.message).join("، ")}`); continue; }
    const optionIds = new Set(
      "options" in part ? part.options.map((o) => o.id)
        : "items" in part ? part.items.map((o) => o.id)
          : "right" in part ? part.right.map((o) => o.id) : [],
    );
    const refs: string[] =
      part.type === "single_choice" ? [(parsed.data as { correct: string }).correct]
        : part.type === "multiple_choice" ? (parsed.data as { correct: string[] }).correct
          : part.type === "ordering" ? (parsed.data as { order: string[] }).order
            : part.type === "matching" || part.type === "drag_drop"
              ? Object.values((parsed.data as { slots: Record<string, string | string[]> }).slots).flat()
              : [];
    for (const r of refs) if (!optionIds.has(r)) errors.push(`${part.id}: الخيار "${r}" غير موجود`);
    if (part.type === "ordering" && (parsed.data as { order: string[] }).order.length !== optionIds.size) {
      errors.push(`${part.id}: الترتيب يجب أن يشمل كل العناصر`);
    }
  }
  return errors;
}

/** Response shape sent by the exam player to save_answer(). */
export const responseSchema = z.object({
  parts: z.record(id, z.union([
    z.object({ choice: id }),
    z.object({ choices: z.array(id) }),
    z.object({ value: z.boolean() }),
    z.object({ text: z.string().max(10000) }),
    z.object({ order: z.array(id) }),
    z.object({ slots: z.record(z.string(), z.string().max(500)) }),
    z.object({ audio_path: z.string().max(500) }),
  ])),
});
