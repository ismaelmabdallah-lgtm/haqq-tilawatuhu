"use client";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { can } from "@/lib/auth";
import { formatBytes } from "@/lib/files";
import { getBrowserClient } from "@/lib/supabase/client";
import { checkUpload, MAX_UPLOAD_BYTES, UPLOAD_TYPES, uploadPath, type UploadKind } from "@/lib/admin/upload-rules";

export type Uploaded = { object_key: string; size_bytes: number; mime_type: string; kind: UploadKind };

/**
 * Direct upload to Supabase Storage (bucket "materials"). Authorization is
 * enforced by Storage RLS: only the super admin may insert/delete. Files stay
 * private until a PUBLISHED resource points at them.
 */
export function UploadWidget({ onUploaded, disabled }: { onUploaded: (u: Uploaded) => void; disabled?: boolean }) {
  const { roles } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!can.superAdmin(roles)) {
    return <p className="rounded-xl bg-amber-50 p-3 text-sm text-warn" data-upload-disabled>رفع الملفات متاح للمدير العام فقط. يمكنك استخدام رابط YouTube أو رابط خارجي.</p>;
  }

  async function upload(file: File) {
    const problem = checkUpload(file);
    if (problem) { setMsg({ ok: false, text: problem }); return; }
    const t = UPLOAD_TYPES[file.type]!;
    const key = uploadPath(file.type, new Date(), crypto.randomUUID());
    setBusy(true); setMsg(null);
    const { error } = await getBrowserClient().storage.from("materials").upload(key, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: `تعذر الرفع: ${error.message}` }); return; }
    onUploaded({ object_key: key, size_bytes: file.size, mime_type: file.type, kind: t.kind });
    setMsg({ ok: true, text: `تم الرفع (${formatBytes(file.size)}). احفظ النموذج لتسجيل الملف.` });
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/40 p-4" data-upload-enabled>
      <label className="block text-sm font-bold">رفع ملف (PDF، صورة، أو تسجيل صوتي — حتى {formatBytes(MAX_UPLOAD_BYTES)})
        <input type="file" disabled={disabled || busy} className="mt-2 block w-full text-sm" data-upload-input
          accept={Object.keys(UPLOAD_TYPES).join(",")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      </label>
      {busy && <div className="skeleton mt-2 h-3" aria-label="جارٍ الرفع" />}
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
