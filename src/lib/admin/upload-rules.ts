/** Upload rules — must match the "materials" bucket (migration 0006) and resources.size_bytes (≤ 25 MiB). */
export const MAX_UPLOAD_BYTES = 26_214_400;

export type UploadKind = "pdf" | "image" | "audio";
export const UPLOAD_TYPES: Record<string, { ext: string; kind: UploadKind }> = {
  "application/pdf": { ext: "pdf", kind: "pdf" },
  "image/png": { ext: "png", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "audio/mpeg": { ext: "mp3", kind: "audio" },
  "audio/mp4": { ext: "m4a", kind: "audio" },
  "audio/x-m4a": { ext: "m4a", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
  "audio/wav": { ext: "wav", kind: "audio" },
  "audio/webm": { ext: "webm", kind: "audio" },
};

/** Returns an Arabic error message, or null when the file may be uploaded. */
export function checkUpload(file: { type: string; size: number }): string | null {
  if (!UPLOAD_TYPES[file.type]) return "نوع الملف غير مسموح (PDF أو صورة PNG/JPG/WebP أو صوت MP3/M4A/OGG/WAV).";
  if (file.size === 0) return "الملف فارغ.";
  if (file.size > MAX_UPLOAD_BYTES) return "حجم الملف يتجاوز الحد الأقصى (25 م.ب).";
  return null;
}

/** Storage path inside the bucket: <kind>/<yyyy>/<mm>/<uuid>.<ext> */
export function uploadPath(type: string, now: Date, id: string): string {
  const t = UPLOAD_TYPES[type];
  if (!t) throw new Error("unsupported type");
  return `${t.kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${t.ext}`;
}
