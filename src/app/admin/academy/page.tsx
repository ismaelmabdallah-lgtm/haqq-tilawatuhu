import Link from "next/link";

export default function AdminAcademy() {
  const items = [
    ["articulation_points", "المخارج", "المخرج العام والخاص وحروفه"],
    ["letter_characteristics", "الصفات", "الصفات وأضدادها"],
    ["academy_letters", "الحروف", "مخرج كل حرف وصفاته وأمثلته"],
  ];
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-brand-900">أكاديمية المخارج والصفات</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map(([k, t, d]) => (
          <Link key={k} href={`/admin/content/?entity=${k}`} className="block rounded-xl border border-line bg-white p-4 hover:border-brand-500">
            <p className="font-bold text-brand-900">{t}</p><p className="text-sm text-muted">{d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
