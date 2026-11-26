import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUpload, MAX_UPLOAD_BYTES, uploadPath } from "../../src/lib/admin/upload-rules";
import { builtFrom, lessonLink, levelLink, type Site } from "../../src/lib/content/model";
import { readFileSync } from "node:fs";

test("upload rules match the materials bucket (types and 25 MiB limit)", () => {
  assert.equal(checkUpload({ type: "application/pdf", size: 1000 }), null);
  assert.equal(checkUpload({ type: "audio/mpeg", size: MAX_UPLOAD_BYTES }), null);
  assert.ok(checkUpload({ type: "audio/mpeg", size: MAX_UPLOAD_BYTES + 1 }));
  assert.ok(checkUpload({ type: "image/svg+xml", size: 10 }), "SVG is not allowed");
  assert.ok(checkUpload({ type: "text/html", size: 10 }));
  assert.ok(checkUpload({ type: "application/pdf", size: 0 }));
  const sql = readFileSync("supabase/migrations/20261127000600_solo_admin_materials.sql", "utf8");
  assert.ok(sql.includes(String(MAX_UPLOAD_BYTES)), "bucket limit equals the client limit");
  assert.equal(uploadPath("application/pdf", new Date(Date.UTC(2026, 10, 27)), "abc"), "pdf/2026/11/abc.pdf");
});

test("links use pre-rendered pages when built, the live route otherwise", () => {
  const level = { id: "L", code: "l1" } as Site["levels"][number];
  const chapter = { id: "C", code: "l1-c2" } as Site["chapters"][number];
  const lesson = { id: "X", code: "new-one" } as Site["lessons"][number];
  const built = builtFrom({ levels: [level], chapters: [chapter], lessons: [] } as unknown as Site);
  assert.equal(levelLink(built, level), "/levels/l1/");
  assert.equal(lessonLink(built, { level, chapter, lesson }), "/learn/?level=l1&chapter=l1-c2&lesson=new-one");
  const built2 = builtFrom({ levels: [level], chapters: [chapter], lessons: [lesson] } as unknown as Site);
  assert.equal(lessonLink(built2, { level, chapter, lesson }), "/levels/l1/l1-c2/new-one/");
});
