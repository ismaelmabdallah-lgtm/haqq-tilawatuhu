/**
 * /api/upload — store a large file (PDF, audio, image) in Cloudflare R2.
 *
 * GET  → { enabled, max_bytes, public_base_url } so the admin UI can disable
 *        the upload action when no R2 binding exists (local dev, unconfigured).
 * POST → multipart/form-data with `file`; content staff only (SQL
 *        is_content_staff()). Returns { object_key, size_bytes, mime_type }.
 *        The admin UI then creates the `resources` row (provider 'r2') through
 *        RLS, where it starts as a draft and goes through scientific review.
 */
import { callerPasses, json, sameOrigin, type Env } from "./_shared";

const MAX_BYTES = 26_214_400; // 25 MiB — matches resources.size_bytes check and Cloudflare's per-file limit
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({ enabled: Boolean(env.FILES), max_bytes: MAX_BYTES, public_base_url: env.FILES_PUBLIC_BASE_URL ?? null });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.FILES) return json({ error: "R2 is not configured" }, 503);
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!(await callerPasses(request, env, "is_content_staff"))) return json({ error: "not allowed" }, 403);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES + 64 * 1024) return json({ error: "file too large" }, 413);

  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "expected multipart/form-data" }, 400); }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "missing file" }, 400);
  if (file.size === 0 || file.size > MAX_BYTES) return json({ error: "file too large or empty" }, 413);
  const ext = ALLOWED[file.type];
  if (!ext) return json({ error: `file type not allowed: ${file.type || "unknown"}` }, 415);

  const now = new Date();
  const objectKey = `resources/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
  await env.FILES.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: ext === "pdf" ? "inline" : undefined,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { original_name: file.name.slice(0, 200) },
  });
  return json({ object_key: objectKey, size_bytes: file.size, mime_type: file.type }, 201);
};
