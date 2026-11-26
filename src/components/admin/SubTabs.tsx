import Link from "next/link";

/** Secondary tabs inside a sidebar section (e.g. Questions | Exams). */
export function SubTabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav aria-label="أقسام فرعية" className="mb-4 flex gap-2 overflow-x-auto">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}
          className={`tap inline-flex shrink-0 items-center rounded-full px-4 text-sm font-medium ${t.key === active ? "bg-brand-700 text-white" : "border border-line bg-white hover:border-brand-500"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const QUESTION_TABS = [
  { key: "questions", href: "/admin/questions/", label: "بنك الأسئلة" },
  { key: "exams", href: "/admin/exams/", label: "الاختبارات" },
];
export const LESSON_TABS = [
  { key: "lessons", href: "/admin/content/?entity=lessons", label: "الدروس" },
  { key: "quranic_examples", href: "/admin/content/?entity=quranic_examples", label: "الأمثلة القرآنية" },
];
