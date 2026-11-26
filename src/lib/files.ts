/** Public URLs for resources. Large files live in R2 (no egress fees), video on YouTube. */
import type { Database } from "@/lib/database.types";

type Resource = Pick<Database["public"]["Tables"]["resources"]["Row"], "provider" | "object_key" | "youtube_id" | "external_url">;

const filesBase = (process.env.NEXT_PUBLIC_FILES_BASE_URL ?? "").trim().replace(/\/+$/, "");

/** Direct URL, or null when it must be fetched at click time (private Supabase images) or is not configured. */
export function resourceUrl(r: Resource): string | null {
  switch (r.provider) {
    case "r2":
      return filesBase && r.object_key ? `${filesBase}/${r.object_key.split("/").map(encodeURIComponent).join("/")}` : null;
    case "youtube":
      return r.youtube_id ? `https://www.youtube.com/watch?v=${r.youtube_id}` : null;
    case "external":
      return r.external_url;
    case "supabase":
      return null;
  }
}

export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
export const isYoutubeId = (id: string) => /^[A-Za-z0-9_-]{11}$/.test(id);

export function formatBytes(n: number | null | undefined): string | null {
  if (!n) return null;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} ك.ب`;
  return `${(n / (1024 * 1024)).toFixed(1)} م.ب`;
}

export const KIND_LABEL: Record<Database["public"]["Enums"]["resource_kind"], string> = {
  pdf: "ملف PDF", image: "صورة", audio: "مقطع صوتي", video: "مقطع مرئي", document: "مستند", link: "رابط", diagram: "رسم توضيحي",
};
