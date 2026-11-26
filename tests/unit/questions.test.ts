import { test } from "node:test";
import assert from "node:assert/strict";
import { promptSchema, validateKey, FORBIDDEN_PROMPT_KEYS, responseSchema } from "../../src/domain/questions/schema";
import { raaQuestion, maqtuMawsulQuestion, taAnitheQuestion, tablePart } from "../../src/domain/questions/templates";

const ref = { surah: 2, ayah: 4 };

test("templates produce valid prompts", () => {
  for (const p of [raaQuestion("الآخرة", ref), maqtuMawsulQuestion("أن لا", ref, { askPlacement: true }), taAnitheQuestion("رحمت", ref)]) {
    const r = promptSchema.safeParse(p);
    assert.ok(r.success, JSON.stringify(!r.success && r.error.issues));
  }
});

test("Raa template has three independently marked parts", () => {
  const p = raaQuestion("الآخرة", ref, { wasl: 1, waqf: 1, reason: 3 });
  assert.deepEqual(p.parts.map((x) => [x.id, x.marks]), [["wasl", 1], ["waqf", 1], ["reason", 3]]);
});

test("templates never contain answer data", () => {
  const json = JSON.stringify([raaQuestion("x", ref), maqtuMawsulQuestion("x", ref), taAnitheQuestion("x", ref)]);
  for (const k of FORBIDDEN_PROMPT_KEYS) assert.ok(!json.includes(`"${k}"`), k);
});

test("prompt with answer data or duplicate part ids is rejected", () => {
  const bad = { stem: "س", parts: [
    { id: "a", type: "true_false", marks: 1, correct: true },
    { id: "a", type: "true_false", marks: 1 },
  ] };
  const r = promptSchema.safeParse(bad);
  assert.equal(r.success, false);
  const msgs = !r.success ? r.error.issues.map((i) => i.message) : [];
  assert.ok(msgs.includes("معرّف الجزء مكرر"));
  assert.ok(msgs.includes("بيانات الإجابة لا توضع في نص السؤال"));
});

test("validateKey checks every auto-graded part and option references", () => {
  const p = promptSchema.parse(raaQuestion("الآخرة", ref));
  assert.deepEqual(validateKey(p, {
    wasl: { correct: "tafkheem" }, waqf: { correct: "tarqeeq" }, reason: { accepted: ["لسكونها بعد كسر"], manual_if_unmatched: true },
  }), []);
  const errs = validateKey(p, { wasl: { correct: "nope" }, waqf: { correct: "tarqeeq" } });
  assert.equal(errs.length, 2); // unknown option + missing reason key
});

test("ordering key must include every item", () => {
  const p = promptSchema.parse({ stem: "رتّب", parts: [{ id: "o", type: "ordering", marks: 2,
    items: [{ id: "x", text: "1" }, { id: "y", text: "2" }, { id: "z", text: "3" }] }] });
  assert.equal(validateKey(p, { o: { order: ["x", "y"] } }).length, 1);
  assert.equal(validateKey(p, { o: { order: ["x", "y", "z"] } }).length, 0);
});

test("table part slot ids follow row:col", () => {
  const p = promptSchema.parse({ stem: "أكمل الجدول", parts: [tablePart("t", ["الحكم", "السبب"], ["مِن نُّور"], 2)] });
  assert.deepEqual(validateKey(p, { t: { slots: { "r1:c1": "إدغام", "r1:c2": ["نون ساكنة بعدها نون"] } } }), []);
  assert.ok(validateKey(p, { t: { slots: { r1c1: "x" } } }).length > 0);
});

test("response schema accepts the shapes graded by the database", () => {
  assert.ok(responseSchema.safeParse({ parts: {
    a: { choice: "x" }, b: { choices: ["x"] }, c: { value: true }, d: { text: "نص" },
    e: { order: ["x", "y"] }, f: { slots: { b1: "ساكنة" } },
  } }).success);
});
