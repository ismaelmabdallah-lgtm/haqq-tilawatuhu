"""Build the page-referenced curriculum map for منهاج الدارسين لترتيل الكتاب المبين (2nd ed., 2026).

Source of truth: the book's own table of contents (PDF pp. 383-389) and level/chapter
divider pages, verified visually. Printed page numbers equal PDF page indices.
Lesson body content is NOT extracted here (see extraction_notes).
"""
import json

BLANK = {10, 12, 46, 66, 78, 106, 128, 150, 152, 166, 168, 198, 212, 214, 248, 250,
         278, 308, 324, 354, 390}

# (level_code, title, subtitle, divider_page, chapters)
# chapter: (title, divider_page, items)  item: (title, start_page, parent_index or None)
LEVELS = [
    ("l1", "المستوى الأول", "التأسيسي", 9, [
        ("مدخل إلى علم التجويد", 11, [
            ("أولًا: القرآن الكريم (تعريفه، فضل وآداب تلاوته)", 13, None),
            ("ثانيًا: التجويد: وتعريفاته", 23, None),
            ("ثالثًا: اللحن: تعريفه، أقسامه، حكم كل قسم", 28, None),
            ("رابعًا: الاستعاذة", 30, None),
            ("خامسًا: البسملة", 37, None),
        ]),
        ("أحكام النون الساكنة والتنوين", 47, [
            ("أحكام النون الساكنة والتنوين", 49, None),
            ("الإظهار الحلقي", 51, 0),
            ("الإدغام", 54, 0),
            ("الإقلاب", 59, 0),
            ("الإخفاء الحقيقي", 61, 0),
        ]),
        ("أحكام الميم الساكنة، والنون والميم المشددتين والغنة", 67, [
            ("أولًا: أحكام الميم الساكنة", 69, None),
            ("الإخفاء الشفوي", 70, 0),
            ("الإدغام الشفوي", 71, 0),
            ("الإظهار الشفوي", 72, 0),
            ("ثانيًا: النون والميم المشددتان", 73, None),
            ("ثالثًا: الغنة ومراتبها", 74, None),
        ]),
    ]),
    ("l2", "المستوى الثاني", "التكميلي", 77, [
        ("المد أحكامه وأنواعه", 79, [
            ("أولًا: المد الأصلي (الطبيعي)", 81, None),
            ("المدود الملحقة بالمد الأصلي", 82, 0),
            ("مد التمكين", 83, 1),
            ("مد العوض", 84, 1),
            ("هاء الكناية - مد الصلة", 85, 1),
            ("ثانيًا: المد الفرعي", 87, None),
            ("المد الواجب المتصل", 88, 5),
            ("المد الجائز المنفصل", 89, 5),
            ("مد البدل", 90, 5),
            ("ب- المد الفرعي بسبب السكون", 92, 5),
            ("المد العارض للسكون", 92, 9),
            ("مد اللين", 92, 9),
            ("المد الفرعي بسبب السكون الأصلي", 93, 9),
            ("أولًا: المد اللازم الكلمي", 94, 12),
            ("ثانيًا: المد اللازم الحرفي", 96, 12),
            ("ج- مد الفرق", 99, 5),
            ("مراتب المدود", 100, None),
        ]),
        ("الحروف وأقسامها ومخارجها وألقابها", 105, [
            ("الحروف وأقسامها", 107, None),
            ("المخارج العامة", 113, None),
            ("المخرج الأول: الجوف", 114, 1),
            ("المخرج الثاني: الحلق", 115, 1),
            ("المخرج الثالث: اللسان", 117, 1),
            ("المخرج الرابع: الشفتان", 122, 1),
            ("المخرج الخامس: الخيشوم", 124, 1),
            ("ألقاب الحروف", 125, None),
        ]),
        ("صفات الحروف", 129, [
            ("صفات الحروف", 131, None),
            ("صفات الحروف اللازمة ذوات الأضداد", 133, 0),
            ("صفات الحروف اللازمة التي لا ضد لها", 138, 0),
            ("صفات أخرى", 144, 0),
        ]),
        ("التفخيم والترقيق", 151, [
            ("أقسام الحروف بحسب تفخيمها وترقيقها", 153, None),
            ("الأحرف المفخمة دائمًا", 153, 0),
            ("أحرف ترقق أحيانًا وتفخم أحيانًا أخرى", 156, 0),
            ("الألف المدية", 156, 2),
            ("اللام من اسم الجلالة", 157, 2),
            ("الراء", 158, 2),
            ("الغنة", 162, 2),
            ("الحروف المرققة دائمًا", 163, 0),
        ]),
    ]),
    ("l3", "المستوى الثالث", "المتقدم", 165, [
        ("الإظهار والإدغام بين الحروف", 167, [
            ("علاقة الحروف ببعضها", 169, None),
            ("المتماثلان", 172, 0),
            ("المتجانسان", 177, 0),
            ("المتقاربان", 180, 0),
            ("المتباعدان", 184, 0),
        ]),
        ("اللامات الساكنة", 189, [
            ("اللام الاسمية", 191, None),
            ("لام الفعل", 194, None),
            ("لام الحرف", 195, None),
            ("لام الأمر", 195, None),
        ]),
        ("البدء بالكلمة", 197, [
            ("البدء بالكلمة", 199, None),
            ("همزة القطع", 199, 0),
            ("همزة الوصل", 200, 0),
            ("همزة الوصل في الأسماء", 200, 2),
            ("همزة الوصل في الأفعال", 202, 2),
            ("همزة الوصل التي تقع في الحرف", 204, 2),
            ("إذا اجتمعت همزة الاستفهام مع همزة الوصل في كلمة (فعل)", 205, 2),
            ("التقاء الساكنين", 208, None),
        ]),
        ("الوقف والابتداء", 213, [
            ("الوقف والابتداء", 215, None),
            ("السكت", 216, None),
            ("القطع", 218, None),
            ("أنواع الوقف", 219, None),
            ("الوقف الاضطراري", 219, 3),
            ("الوقف الاختباري", 219, 3),
            ("الوقف الانتظاري", 220, 3),
            ("الوقف الاختياري", 220, 3),
            ("أنواع الوقف الاختياري", 221, 7),
            ("الابتداء وأنواعه", 227, None),
            ("كيفية الوقف على الكلمة", 230, None),
            ("الروم والإشمام", 230, 10),
            ("الفرق بين الروم والإشمام", 232, 10),
            ("أوجه الوقف على الكلمة", 235, 10),
            ("الحالات التي لا يدخلها روم أو إشمام", 242, 10),
        ]),
    ]),
    ("ijazah", "متطلب الإجازة", None, 247, [
        ("تعريف الإجازة، وأنواعها", 249, [
            ("تعريف الإجازة، وأنواعها", 251, None),
            ("أصول رواية حفص", 256, None),
            ("أنواع الهاءات", 267, None),
            ("تفردات رواية حفص بن سليمان", 271, None),
        ]),
        ("المقطوع والموصول", 277, [
            ("المقطوع والموصول من المقدمة الجزرية", 279, None),
            ("القطع والوصل من غير المقدمة الجزرية", 302, None),
        ]),
        ("هاء التأنيث وتاء التأنيث", 309, [
            ("هاء التأنيث وتاء التأنيث", 311, None),
            ("ما اتفق القراء على قراءته بالإفراد", 312, 0),
            ("ما اختلف القراء على قراءته بين الإفراد والجمع", 319, 0),
        ]),
        ("الإثبات والحذف", 323, [
            ("الإثبات والحذف", 325, None),
            ("الألف", 325, 0),
            ("الواو المدية", 332, 0),
            ("الياء المدية", 335, 0),
        ]),
        ("موازين الحروف", 341, [
            ("موازين الحروف", 343, None),
            ("مصطلحات ضبط المصحف", 355, None),
            ("تنبيهات عامة", 361, None),
        ]),
    ]),
]
BOOK_END = 380  # 381-382 references, 383-389 index, 391-392 certificate templates

NOTES = {
    ("ijazah", 2): "عنوان صفحة الفاصل (ص309): «تاء التأنيث وهاء التأنيث»؛ وفي الفهرس (ص388): «هاء التأنيث وتاء التأنيث». اعتمد عنوان الفهرس؛ يحتاج تأكيد المراجع.",
    ("ijazah", 4): "«تنبيهات عامة» مدرجة في الفهرس بعد عناصر الباب الخامس دون فاصل مستقل؛ إلحاقها بالباب الخامس يحتاج تأكيد المراجع.",
    ("l2", 0): "عناصر «المد الواجب المتصل/الجائز المنفصل/البدل» لا يسبقها عنوان «أ-» في الفهرس رغم وجود «ب-» و«ج-»؛ لم يُضف عنوان غير موجود.",
}


def trim(end):
    while end in BLANK:
        end -= 1
    return end


def build():
    levels_out, lessons_out = [], []
    starts = [lv[3] for lv in LEVELS] + [BOOK_END + 1]
    for li, (lcode, ltitle, lsub, lpage, chapters) in enumerate(LEVELS):
        ch_starts = [c[1] for c in chapters] + [starts[li + 1]]
        chs = []
        for ci, (ctitle, cpage, items) in enumerate(chapters):
            cid = f"{lcode}-c{ci + 1}"
            cend = trim(ch_starts[ci + 1] - 1)
            item_starts = [it[1] for it in items]
            ids = [f"{cid}-{k + 1:02d}" for k in range(len(items))]
            for k, (title, sp, parent) in enumerate(items):
                nxt = item_starts[k + 1] if k + 1 < len(items) else cend + 1
                own_end = trim(max(sp, nxt - 1))
                lessons_out.append({
                    "lesson_id": ids[k], "chapter_id": cid, "level_id": lcode,
                    "parent_id": ids[parent] if parent is not None else None,
                    "order": k + 1, "title": title,
                    "source_page_start": sp, "source_page_end": own_end,
                    "description": None, "content": None, "definitions": [],
                    "rules": [], "quranic_examples": [], "tables": [], "exercises": [],
                    "related_files": [], "content_origin": "curriculum_quoted",
                    "review_status": "draft", "publication_status": "unpublished",
                })
            chs.append({"chapter_id": cid, "order": ci + 1,
                        "label": f"الباب {['الأول','الثاني','الثالث','الرابع','الخامس'][ci]}",
                        "title": ctitle, "divider_page": cpage,
                        "source_page_start": cpage, "source_page_end": cend,
                        "review_note": NOTES.get((lcode, ci))})
        levels_out.append({"level_id": lcode, "order": li + 1, "title": ltitle,
                           "subtitle": lsub, "divider_page": lpage,
                           "source_page_start": lpage,
                           "source_page_end": trim(starts[li + 1] - 1),
                           "chapters": chs})

    # extend each parent's end to its last descendant's end
    by_id = {l["lesson_id"]: l for l in lessons_out}
    for l in reversed(lessons_out):
        if l["parent_id"]:
            p = by_id[l["parent_id"]]
            p["source_page_end"] = max(p["source_page_end"], l["source_page_end"])

    return {
        "schema_version": "1.0",
        "curriculum": {
            "curriculum_id": "minhaj-al-darisin",
            "title": "منهاج الدارسين لترتيل الكتاب المبين",
            "subtitle": "أحكام التلاوة والتجويد للمستويات الثلاثة والإجازة في دور القرآن الكريم",
            "riwayah": "حفص عن عاصم من طريق الشاطبية",
            "authors": ["د. حاتم جميل السحيمات", "توفيق إبراهيم ضمرة"],
            "publisher": "وزارة الأوقاف والشؤون والمقدسات الإسلامية – المملكة الأردنية الهاشمية",
            "edition": {"edition_id": "minhaj-al-darisin-ed2-2026", "label": "الطبعة الثانية",
                        "year_ah": 1448, "year_ce": 2026,
                        "national_library_deposit": "2026/6/3177"},
            "source_document": {"pages": 392, "page_numbering": "printed page = PDF page",
                                "front_matter": [1, 8], "references": [381, 382],
                                "table_of_contents": [383, 389],
                                "certificate_templates": [391, 392]},
            "affiliation_note": "مرجع منشور؛ لا يعني اعتماد المنصة رسميًا من الوزارة.",
        },
        "levels": levels_out,
        "lessons": lessons_out,
        "extraction_notes": [
            "Structure (levels, chapters, lessons, start pages) is taken from the book's TOC and divider pages, verified visually.",
            "End pages are derived (next start − 1, blank pages trimmed); items sharing a start page share that page.",
            "The PDF text layer is unreliable: lam-alef ligatures and some letters drop out, so body text must be extracted from page images and checked.",
            "Quranic text uses page-specific glyph fonts (private codepoints) and cannot be copied from the PDF; examples must be stored by surah:ayah and rendered from a verified Uthmani Hafs text.",
            "All lesson content fields are empty and every item is draft until extracted and scientifically reviewed.",
        ],
    }


if __name__ == "__main__":
    data = build()
    with open("content/curricula/minhaj-al-darisin-ed2-2026/curriculum-map.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # readable outline
    lines = [f"# خريطة منهاج: {data['curriculum']['title']}", "",
             f"{data['curriculum']['edition']['label']} {data['curriculum']['edition']['year_ce']} — رواية {data['curriculum']['riwayah']}",
             "", "كل العناصر بحالة **مسودة** وتنتظر الاستخراج والمراجعة العلمية. الأرقام = صفحات الكتاب.", ""]
    les_by_ch = {}
    for l in data["lessons"]:
        les_by_ch.setdefault(l["chapter_id"], []).append(l)
    depth = {}
    for l in data["lessons"]:
        depth[l["lesson_id"]] = 0 if not l["parent_id"] else depth[l["parent_id"]] + 1
    for lv in data["levels"]:
        sub = f" ({lv['subtitle']})" if lv["subtitle"] else ""
        lines += [f"## {lv['title']}{sub} — ص {lv['source_page_start']}–{lv['source_page_end']}", ""]
        for ch in lv["chapters"]:
            lines.append(f"### {ch['label']}: {ch['title']} — ص {ch['source_page_start']}–{ch['source_page_end']}")
            if ch["review_note"]:
                lines.append(f"> ⚠️ {ch['review_note']}")
            lines.append("")
            for l in les_by_ch[ch["chapter_id"]]:
                ind = "  " * depth[l["lesson_id"]]
                lines.append(f"{ind}- `{l['lesson_id']}` {l['title']} — ص {l['source_page_start']}–{l['source_page_end']}")
            lines.append("")
    lines += ["## ملاحظات الاستخراج", ""] + [f"- {n}" for n in data["extraction_notes"]]
    with open("content/curricula/minhaj-al-darisin-ed2-2026/curriculum-map.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(len(data["levels"]), "levels,",
          sum(len(l["chapters"]) for l in data["levels"]), "chapters,",
          len(data["lessons"]), "lessons")
