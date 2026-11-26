"use client";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { formatBytes, isYoutubeId, KIND_LABEL, resourceUrl, youtubeEmbed } from "@/lib/files";
import type { Database } from "@/lib/database.types";

export type ResourceView = Pick<Database["public"]["Tables"]["resources"]["Row"],
  "id" | "kind" | "title" | "description" | "provider" | "object_key" | "youtube_id" | "external_url" | "mime_type"
  | "size_bytes" | "duration_seconds" | "reciter_name" | "is_downloadable" | "scientifically_verified">;

/**
 * Supabase Storage files are private: a short-lived signed URL is issued only
 * while a PUBLISHED resource points at the file (storage RLS, migration 0006).
 * New uploads live in "materials"; "images" (migration 0004) is a fallback.
 */
async function signedUrl(key: string, download: boolean): Promise<string | null> {
  const sb = getBrowserClient();
  for (const bucket of ["materials", "images"]) {
    const { data } = await sb.storage.from(bucket).createSignedUrl(key, 3600, download ? { download: true } : undefined);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}

const KIND_ICON: Record<string, string> = { pdf: "📄", audio: "🔊", video: "▶️", image: "🖼️", document: "📝", link: "🔗", diagram: "📐" };

/** One file / clip: download button for documents, inline player/preview for audio and images. */
export function ResourceItem({ r, compact = false }: { r: ResourceView; compact?: boolean }) {
  const stored = r.provider === "supabase" && r.object_key;
  const inline = stored && (r.kind === "image" || r.kind === "diagram" || r.kind === "audio");
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = resourceUrl(r);
  const size = formatBytes(r.size_bytes);

  useEffect(() => {
    if (!inline || !r.object_key) return;
    let alive = true;
    void signedUrl(r.object_key, false).then((u) => { if (alive) { if (u) setSrc(u); else setFailed(true); } });
    return () => { alive = false; };
  }, [inline, r.object_key]);

  async function download() {
    if (!r.object_key) return;
    setBusy(true); setFailed(false);
    const u = await signedUrl(r.object_key, r.is_downloadable);
    setBusy(false);
    if (u) window.open(u, "_blank", "noopener"); else setFailed(true);
  }

  const action = r.provider === "youtube" ? null : stored ? (
    <button type="button" onClick={() => void download()} disabled={busy} data-download
      className="tap inline-flex shrink-0 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white disabled:opacity-60">
      {busy ? "جارٍ الفتح…" : r.is_downloadable ? "تحميل" : "فتح"}
    </button>
  ) : url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" download={r.is_downloadable && r.provider === "r2" ? "" : undefined}
      className="tap inline-flex shrink-0 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white">
      {r.provider === "external" || r.kind === "link" ? "فتح الرابط" : r.is_downloadable ? "تحميل" : "فتح"}
    </a>
  ) : <span className="text-xs text-warn">غير متاح حاليًا</span>;

  return (
    <li className="rounded-2xl border border-line bg-white p-4" data-resource={r.kind}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-100 text-xl">{KIND_ICON[r.kind] ?? "📄"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">{r.title}</p>
          <p className="text-xs text-muted">{KIND_LABEL[r.kind]}{size ? ` · ${size}` : ""}{r.reciter_name ? ` · بصوت ${r.reciter_name}` : ""}</p>
          {!compact && r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
        </div>
        {!(inline && r.kind !== "audio") && r.kind !== "audio" && action}
      </div>
      {failed && <p className="mt-2 text-sm text-danger" role="alert">تعذر فتح الملف، حاول لاحقًا.</p>}
      {r.provider === "youtube" && r.youtube_id && isYoutubeId(r.youtube_id) && <YouTube id={r.youtube_id} title={r.title} />}
      {r.kind === "audio" && (stored ? src : r.provider === "r2" ? url : null) && (
        <audio controls preload="none" src={(stored ? src : url)!} className="mt-3 w-full" data-audio>متصفحك لا يدعم تشغيل الصوت.</audio>
      )}
      {r.kind === "audio" && stored && !src && !failed && <div className="skeleton mt-3 h-12" />}
      {(r.kind === "image" || r.kind === "diagram") && stored && (
        src ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Supabase URL; next/image is not available in static export
          <img src={src} alt={r.description ?? r.title} loading="lazy" className="mt-3 max-h-[480px] w-full rounded-xl border border-line object-contain" data-image />
        ) : !failed && <div className="skeleton mt-3 h-48" />
      )}
    </li>
  );
}

export function YouTube({ id, title }: { id: string; title: string }) {
  return (
    <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe src={youtubeEmbed(id)} title={title} loading="lazy" className="h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}
