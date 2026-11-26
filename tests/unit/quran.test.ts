import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { excerpt, parseToken, QURAN_TOKEN, refLabel, type SurahFile, type SurahIndex } from "../../src/lib/quran/ref";
import { parseShellId } from "../../src/lib/shell-route";

// Requires `npm run quran:setup` (runs automatically before dev/build).
const surah = (n: number) => JSON.parse(readFileSync(`public/quran/${n}.json`, "utf8")) as SurahFile;
const raw = readFileSync("vendor/tanzil/quran-uthmani.txt", "utf8");
const rawLine = (s: number, a: number) => raw.split("\n").find((l) => l.startsWith(`${s}|${a}|`))!.replace(/\r$/, "").split("|").slice(2).join("|");

test("bundle matches the pinned Tanzil checksum and keeps the copyright block", () => {
  const idx = JSON.parse(readFileSync("public/quran/index.json", "utf8")) as SurahIndex;
  assert.equal(createHash("sha256").update(readFileSync("vendor/tanzil/quran-uthmani.txt")).digest("hex"), idx.source.sha256);
  assert.equal(idx.surahs.length, 114);
  assert.equal(idx.surahs.reduce((n, s) => n + s.ayat, 0), 6236);
  assert.match(surah(1).source.copyright, /CHANGING IT IS NOT ALLOWED/);
});

test("ayat are copied byte-for-byte from the source text", () => {
  for (const [s, a] of [[1, 1], [2, 121], [2, 255], [114, 6]] as const) {
    assert.equal(surah(s).ayat[a - 1], rawLine(s, a));
  }
});

test("excerpt returns verbatim ayah ranges", () => {
  const s2 = surah(2);
  const r = excerpt(s2, { surah: 2, ayah: 121, ayahEnd: 122 })!;
  assert.deepEqual(r.map((p) => p.ayah), [121, 122]);
  assert.equal(r[0]!.text, rawLine(2, 121));
  assert.equal(excerpt(s2, { surah: 2, ayah: 287 }), null);
});

test("word ranges count words, not waqf marks, and stay verbatim", () => {
  const full = rawLine(2, 121);
  const w = excerpt(surah(2), { surah: 2, ayah: 121, wordStart: 1, wordEnd: 6 })![0]!.text;
  assert.ok(full.startsWith(w), "excerpt is a verbatim prefix");
  assert.equal(w.split(" ").length, 6);
  // word 10 comes after the waqf mark ۗ (token 10 in the raw text)
  const after = excerpt(surah(2), { surah: 2, ayah: 121, wordStart: 10, wordEnd: 10 })![0]!.text;
  assert.equal(after, full.split(" ")[10]);
  assert.equal(excerpt(surah(2), { surah: 2, ayah: 121, wordStart: 99 }), null);
});

test("[[quran:…]] tokens parse to references", () => {
  const refs = [..."أ [[quran:2:121]] ب [[quran:1:2-4]] ج [[quran:2:121:5-6]]".matchAll(QURAN_TOKEN)].map(parseToken);
  assert.deepEqual(refs, [
    { surah: 2, ayah: 121 },
    { surah: 1, ayah: 2, ayahEnd: 4 },
    { surah: 2, ayah: 121, wordStart: 5, wordEnd: 6 },
  ]);
  assert.equal(parseToken([..."[[quran:115:1]]".matchAll(QURAN_TOKEN)][0]!), null);
  assert.equal(refLabel("البقرة", { surah: 2, ayah: 121 }), "سورة البقرة: ١٢١");
});

test("shell routes read ids from the real URL", () => {
  const id = "AB2C0D1E-1234-4ABC-8DEF-0123456789AB";
  assert.equal(parseShellId("exams", `/exams/${id}/`), id.toLowerCase());
  assert.equal(parseShellId("attempts", `/attempts/${id}`), id.toLowerCase());
  assert.equal(parseShellId("exams", "/exams/level-1-final/"), "level-1-final");
  assert.equal(parseShellId("attempts", "/attempts/level-1-final/"), null);
  assert.equal(parseShellId("exams", "/exams/_/"), null);
  assert.equal(parseShellId("exams", "/exams/a/b/"), null);
  assert.equal(parseShellId("certificates", `/exams/${id}/`), null);
});
