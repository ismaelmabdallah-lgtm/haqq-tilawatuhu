"use client";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { formatBytes, isYoutubeId, KIND_LABEL, resourceUrl, youtubeEmbed } from "@/lib/files";
import type { Database } from "@/lib/database.types";

export type ResourceView = Pick<Database["public"]["Tables"]["resources"]["Row"],
  "id" | "kind" | "title" | "description" | "provider" | "object_key" | "youtube_id" | "external_url" | "mime_type"
  | "size_bytes" | "duration_seconds" | "reciter_name" | "is_downloadable" | "scientifically_verified">;

/** One downloadable / playable resource. Private Supabase images get a short-lived signed URL on demand. */
export function ResourceItem({ r }: { r: ResourceView }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = resourceUrl(r);
  const size = formatBytes(r.size_bytes);

  async function openSupabase() {
    if (!r.object_key) return;
    setBusy(true); setFailed(false);
    const { data, error } = await getBrowserClient().storage.from("images").createSignedUrl(r.object_key, 120);
    setBusy(false);
    if (error || !data) { setFailed(true); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <li className="rounded-xl border border-line bg-white p-4" data-resource={r.kind}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{r.title}</p>
          <p className="text-xs text-muted">
            {KIND_LABEL[r.kind]}{size ? ` · ${size}` : ""}{r.reciter_name ? ` · بصوت ${r.reciter_name}` : ""}
          </p>
          {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
        </div>
        {r.provider !== "youtube" && (
          r.provider === "supabase" ? (
            <button type="button" onClick={openSupabase} disabled={busy}
              className="tap inline-flex items-center rounded-lg bg-brand-700 px-4 text-sm text-white disabled:opacity-60">
              {busy ? "جارٍ الفتح…" : "فتح"}
            </button>
          ) : url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" download={r.is_downloadable && r.provider === "r2" ? "" : undefined}
              className="tap inline-flex items-center rounded-lg bg-brand-700 px-4 text-sm text-white">
              {r.provider === "external" || r.kind === "link" ? "فتح الرابط" : r.is_downloadable ? "تحميل" : "فتح"}
            </a>
          ) : (
            <span className="text-xs text-warn">الملف غير متاح حاليًا</span>
          )
        )}
      </div>
      {failed && <p className="mt-2 text-sm text-danger" role="alert">تعذر فتح الملف، حاول لاحقًا.</p>}
      {r.provider === "youtube" && r.youtube_id && isYoutubeId(r.youtube_id) && <YouTube id={r.youtube_id} title={r.title} />}
      {r.kind === "audio" && r.provider === "r2" && url && (
        <audio controls preload="none" src={url} className="mt-3 w-full">متصفحك لا يدعم تشغيل الصوت.</audio>
      )}
    </li>
  );
}

export function YouTube({ id, title }: { id: string; title: string }) {
  return (
    <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe src={youtubeEmbed(id)} title={title} loading="lazy" className="h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}
