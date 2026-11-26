import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { normalizeArabic, normAnswer } from "../../src/lib/arabic/normalize";

const SAMPLES = [
  "إِنَّ ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّـٰلِحَـٰتِ",
  "الإظهار  الحلقيّ",
  "أحكام النون الساكنة والتنوين",
  "مُؤْمِنٌ وَشَيْئًا وَمُوسَىٰ وَرَحْمَةٌ",
  "  الْقُرْآنِ   الْكَرِيمِ ",
  "",
];

test("removes diacritics and unifies letter forms", () => {
  assert.equal(normalizeArabic("الإِظْهَارُ"), "الاظهار");
  assert.equal(normalizeArabic("رَحْمَةٌ"), "رحمه");
  assert.equal(normalizeArabic("مُوسَىٰ"), "موسي");
  assert.equal(normAnswer(" لِسُكونِها  بعدَ كَسْر "), "لسكونها بعد كسر");
});

// Parity with the SQL function the database uses for search and grading.
// Runs only when a test database is reachable (PGHOST/PGPORT/TEST_DB set).
test("matches public.normalize_arabic() in PostgreSQL", { skip: !process.env.TEST_DB }, () => {
  for (const s of SAMPLES) {
    const sql = execFileSync("psql", ["-X", "-At", "-d", process.env.TEST_DB!, "-c",
      `select public.normalize_arabic($t$${s}$t$)`], { encoding: "utf8" }).replace(/\n$/, "");
    assert.equal(normalizeArabic(s), sql, `sample: ${s}`);
  }
});
