import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { HomeLive } from "@/components/learn/LiveLists";
import { QuranVerse } from "@/components/quran/QuranVerse";
import { Section } from "@/components/ui";
import { getSite, lightSite } from "@/lib/content/site";
import { arDigits } from "@/lib/quran/ref";

const STEPS = [
  { t: "اختر مستواك", d: "أربعة مستويات متدرجة من التأسيسي حتى متطلب الإجازة." },
  { t: "ادرس وحمّل", d: "دروس مختصرة وملخصات PDF ومقاطع صوتية." },
  { t: "تدرّب واختبر", d: "اختبارات تُصحَّح فورًا مع شرح الأخطاء." },
  { t: "احفظ تقدّمك", d: "بحساب اختياري تُحفظ نتائجك وتحصل على شهادة إتمام." },
];

export default async function HomePage() {
  const site = await getSite();
  return (
    <>
      <section className="overflow-hidden rounded-3xl bg-brand-700 px-5 py-8 text-white sm:px-10 sm:py-12">
        <div className="flex items-center gap-4">
          <BrandMark size={64} className="shrink-0 rounded-2xl ring-2 ring-gold-500/60" />
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">حق تلاوته</h1>
            <p className="text-brand-100">رحلتك نحو إتقان تلاوة القرآن الكريم</p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-paper px-4 text-ink">
          <QuranVerse quranRef={{ surah: 2, ayah: 121, wordStart: 1, wordEnd: 6 }} inline />
        </div>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-100">
          تعلّم أحكام التلاوة والتجويد مجانًا: ادرس، وحمّل الملخصات، وتدرّب، واختبر نفسك — دون تسجيل.
        </p>
        <div className="mt-6 grid gap-3 sm:flex">
          <Link href="/levels/" className="tap inline-flex items-center justify-center rounded-xl bg-gold-500 px-6 text-lg font-bold text-white shadow">ابدأ التعلّم</Link>
          <Link href="/exams/" className="tap inline-flex items-center justify-center rounded-xl border border-white/40 px-6 text-lg">اختبر نفسك</Link>
        </div>
      </section>

      <HomeLive initial={lightSite(site)} />

      <Section title="كيف تعمل المنصة؟" id="how">
        <ol className="grid gap-3 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-line bg-white p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-100 font-bold text-gold-700">{arDigits(i + 1)}</span>
              <p className="mt-2 font-bold">{s.t}</p>
              <p className="text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="تعلّم أكثر" id="explore">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["/academy/", "أكاديمية المخارج والصفات", "مخرج كل حرف وصفاته بالصورة والصوت."],
            ["/resources/", "المواد والملخصات", "ملفات للتحميل ومقاطع صوتية ومرئية."],
            ["/encyclopedia/", "موسوعة التجويد", "تعريفات الأحكام وشرحها."],
          ].map(([href, t, d]) => (
            <Link key={href} href={href!} className="block rounded-2xl border border-line bg-white p-4 hover:border-brand-500">
              <p className="font-bold text-brand-900">{t}</p><p className="text-sm text-muted">{d}</p>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
