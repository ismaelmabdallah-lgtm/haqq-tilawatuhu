/**
 * Starting structures for specialized Tajweed questions (section 8.2).
 * Templates only build the PROMPT; the teacher always chooses the answer key,
 * and the question goes through review like any other. Option labels follow
 * the curriculum's terminology (e.g. «هاء التأنيث وتاء التأنيث», book p. 311)
 * and remain editable in the builder.
 */
import type { Prompt } from "./schema";

type QuranRef = NonNullable<Prompt["quran_ref"]>;

const choice = (id: string, text: string) => ({ id, text });

/** أحكام الراء: الحكم وصلًا، الحكم وقفًا، والسبب — لكل جزء درجته ومفتاحه. */
export function raaQuestion(word: string, ref: QuranRef, marks = { wasl: 1, waqf: 1, reason: 2 }): Prompt {
  const rulings = [choice("tafkheem", "التفخيم"), choice("tarqeeq", "الترقيق"), choice("both", "جواز الوجهين")];
  return {
    stem: `بيّن حكم الراء في كلمة «${word}»`,
    quran_ref: ref,
    parts: [
      { id: "wasl", type: "single_choice", marks: marks.wasl, prompt: "حكمها حال الوصل", options: rulings },
      { id: "waqf", type: "single_choice", marks: marks.waqf, prompt: "حكمها حال الوقف", options: rulings },
      { id: "reason", type: "short_text", marks: marks.reason, prompt: "اذكر السبب" },
    ],
  };
}

/** المقطوع والموصول: تحديد الرسم، مع خيار ذكر الموضع أو إرفاق صورة من المصحف. */
export function maqtuMawsulQuestion(words: string, ref: QuranRef, opts: { askPlacement?: boolean; marks?: number } = {}): Prompt {
  const parts: Prompt["parts"] = [
    { id: "rasm", type: "single_choice", marks: opts.marks ?? 1, prompt: `كيف رُسمت «${words}» في المصحف؟`,
      options: [choice("maqtu", "مقطوعة"), choice("mawsul", "موصولة")] },
  ];
  if (opts.askPlacement) {
    parts.push({ id: "note", type: "short_text", marks: 1, prompt: "اكتبها كما رُسمت" });
  }
  return { stem: "حدّد المقطوع والموصول", quran_ref: ref, parts };
}

/** هاء التأنيث وتاء التأنيث (الباب الثالث من متطلب الإجازة). */
export function taAnitheQuestion(word: string, ref: QuranRef, marks = 1): Prompt {
  return {
    stem: `كيف رُسمت التاء في كلمة «${word}»؟`,
    quran_ref: ref,
    parts: [
      { id: "rasm", type: "single_choice", marks, options: [
        choice("haa", "هاء التأنيث (مربوطة)"),
        choice("taa", "تاء التأنيث (مفتوحة)"),
      ] },
    ],
  };
}

/** Builds a fill-in-the-table part from row/column labels. Slot ids are "row:col". */
export function tablePart(id: string, columns: string[], rows: string[], marks: number): Prompt["parts"][number] {
  return {
    id, type: "table", marks,
    columns: columns.map((label, i) => ({ id: `c${i + 1}`, label })),
    rows: rows.map((label, i) => ({ id: `r${i + 1}`, label })),
  };
}
