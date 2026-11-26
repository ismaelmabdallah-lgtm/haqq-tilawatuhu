# Curriculum analysis — منهاج الدارسين لترتيل الكتاب المبين (الطبعة الثانية 2026)

## Source facts (verified from the PDF)

* 392 pages; printed page numbers equal PDF page numbers.
* Riwayah: حفص عن عاصم من طريق الشاطبية. Authors: د. حاتم جميل السحيمات، توفيق إبراهيم ضمرة. Publisher: وزارة الأوقاف والشؤون والمقدسات الإسلامية. National Library deposit 2026/6/3177. 1448هـ / 2026م.
* Front matter 1–8, references 381–382, table of contents 383–389, two «إجازة دراية» certificate templates 391–392 (useful later for the certificates module — note they are the book's own forms, not platform certificates).

## Structure

The book names the four stages — use these names, not generic "Level 2/3":

| Stage | Pages | Chapters | Lessons (incl. sub-items) |
|---|---|---|---|
| المستوى الأول (التأسيسي) | 9–76 | 3 | 16 |
| المستوى الثاني (التكميلي) | 77–164 | 4 | 37 |
| المستوى الثالث (المتقدم) | 165–246 | 4 | 32 |
| متطلب الإجازة | 247–380 | 5 | 16 |

Full map with ids and page ranges: `content/curricula/minhaj-al-darisin-ed2-2026/curriculum-map.md` (seed: `supabase/seed/0001_minhaj_al_darisin.sql`).

Each stage's intro page also states what the student memorises and reads alongside the level (e.g. Level 1: جزء عمّ + reading the last five juz'). Those requirements belong in `levels.description` after review.

## Items for the scientific reviewer

1. متطلب الإجازة, Chapter 3: divider page (p. 309) reads «تاء التأنيث وهاء التأنيث», the TOC (p. 388) reads «هاء التأنيث وتاء التأنيث». The map follows the TOC.
2. «تنبيهات عامة» (p. 361) has no divider page; its attachment to Chapter 5 is assumed.
3. المد chapter: the TOC lists «ب-» and «ج-» sub-groups but no «أ-»; no heading was invented.
4. End pages are derived (next start − 1); several items share a page (e.g. pp. 92, 153, 195, 219, 230, 325).

## Extraction findings

* **Text layer is unreliable.** Lam-alef ligatures and some letters drop out (e.g. «الظهار» for «الإظهار»). Lesson text must be read from page images and checked by a person.
* **Quranic text cannot be copied.** Verses use page-specific glyph fonts (private-use code points). Examples are stored as `surah:ayah[:word]` and rendered from a verified Uthmani Hafs text (`quranic_examples.text_source`).

## Extraction plan (Phase 5 content work)

Per lesson: rasterize its page range → transcribe definitions, rules, tables, notes and exercises into the lesson fields with `source_page` on each item → record Quranic examples by reference → submit for review. Nothing is published until a reviewer approves it.
