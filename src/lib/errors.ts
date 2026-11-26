/** Maps the database's documented error codes to Arabic messages for the UI. */
export type DbError = { code?: string; message?: string } | null | undefined;

const BY_CODE: Record<string, string> = {
  "42501": "غير مسموح بهذا الإجراء.",
  "22023": "لا يمكن تنفيذ الإجراء في الحالة الحالية.",
  "23514": "البيانات المدخلة غير مكتملة أو غير صحيحة.",
  P0002: "العنصر غير موجود.",
  "54000": "محاولات كثيرة من هذه الشبكة، يرجى المحاولة لاحقًا.",
};

const BY_MESSAGE: [RegExp, string][] = [
  [/requires signing in/, "هذا الاختبار يتطلب تسجيل الدخول."],
  [/outside its availability window/, "الاختبار غير متاح في هذا الوقت."],
  [/attempt limit reached/, "استنفدت عدد المحاولات المسموح بها."],
  [/required question\(s\) unanswered/, "توجد أسئلة إلزامية لم تُجب عنها."],
  [/time is over/, "انتهى وقت الاختبار."],
  [/platform is busy/, "المنصة مشغولة الآن، يرجى المحاولة بعد قليل."],
  [/attempt not found/, "المحاولة غير موجودة أو انتهت صلاحية رابطها."],
  [/comment is required/, "يجب كتابة ملاحظة عند طلب التعديلات."],
  [/not eligible: (\d+) lesson/, "لم تُكمل جميع دروس المستوى بعد."],
  [/final level exam not passed/, "لم تجتز الاختبار النهائي للمستوى بعد."],
  [/complete your full name/, "يرجى إكمال اسمك الكامل في الملف الشخصي أولًا."],
  [/Invalid login credentials/, "البريد الإلكتروني أو كلمة المرور غير صحيحة."],
  [/Email not confirmed/, "لم يتم تأكيد البريد الإلكتروني بعد."],
  [/User already registered/, "هذا البريد مسجّل مسبقًا."],
  [/Password should be at least/, "كلمة المرور قصيرة جدًا."],
  [/Failed to fetch|NetworkError/, "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مجددًا."],
];

export function errorMessage(err: DbError | Error | unknown): string {
  const e = err as { code?: string; message?: string } | null | undefined;
  const msg = e?.message ?? "";
  for (const [re, text] of BY_MESSAGE) if (re.test(msg)) return text;
  if (e?.code && BY_CODE[e.code]) return BY_CODE[e.code]!;
  return msg ? `حدث خطأ: ${msg}` : "حدث خطأ غير متوقع.";
}
