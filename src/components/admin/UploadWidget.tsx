"use client";
import { useEffect, useState } from "react";
import { callFunction } from "@/lib/admin/db";
import { formatBytes } from "@/lib/files";

type Status = { enabled: boolean; max_bytes: number } | null;
export type Uploaded = { object_key: string; size_bytes: number; mime_type: string };

/**
 * Direct upload to Cloudflare R2 via /api/upload. When the Pages Function or
 * its R2 binding is not available (local dev, unconfigured project), only this
 * action is disabled — YouTube and external links keep working.
 */
export function UploadWidget({ onUploaded, disabled }: { onUploaded: (u: Uploaded) => void; disabled?: boolean }) {
  const [status, setStatus] = useState<Status>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/upload")
      .then((r) => (r.ok && (r.headers.get("content-type") ?? "").includes("json") ? r.json() : null))
      .catch(() => null)
      .then((j: Status) => { if (alive) { setStatus(j); setChecked(true); } });
    return () => { alive = false; };
  }, []);

  if (!checked) return <p className="text-xs text-muted">جارٍ التحقق من إمكانية الرفع…</p>;
  if (!status?.enabled) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-warn" data-upload-disabled>
        الرفع المباشر إلى Cloudflare R2 غير مُفعّل في هذه البيئة. استخدم رابط YouTube أو رابطًا خارجيًا، أو فعّل ربط R2 (FILES) في Cloudflare Pages.
      </p>
    );
  }

  async function upload(file: File) {
    if (file.size > status!.max_bytes) { setMsg({ ok: false, text: `الحد الأقصى ${formatBytes(status!.max_bytes)}` }); return; }
    setBusy(true); setMsg(null);
    const body = new FormData();
    body.append("file", file);
    const res = await callFunction("/api/upload", { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const err = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "network";
      setMsg({ ok: false, text: `تعذر الرفع: ${err ?? res?.status}` }); return;
    }
    const u = (await res.json()) as Uploaded;
    onUploaded(u);
    setMsg({ ok: true, text: `تم الرفع (${formatBytes(u.size_bytes)}). احفظ النموذج لتسجيل الملف.` });
  }

  return (
    <div className="rounded-lg border border-dashed border-brand-500 p-3" data-upload-enabled>
      <label className="text-sm font-medium">رفع ملف إلى R2 (PDF، صوت، صورة — حتى {formatBytes(status.max_bytes)})
        <input type="file" disabled={disabled || busy} className="mt-1 block w-full text-sm"
          accept="application/pdf,audio/mpeg,audio/mp4,audio/ogg,audio/wav,image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </label>
      {busy && <p className="mt-1 text-sm">جارٍ الرفع…</p>}
      {msg && <p role="status" className={`mt-1 text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
