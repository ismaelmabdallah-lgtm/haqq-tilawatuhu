import Link from "next/link";
import { QuranVerse } from "@/components/quran/QuranVerse";
import { AnnouncementList } from "@/components/content/AnnouncementList";
import { Card, EmptyState, Section, UNDER_REVIEW_NOTE } from "@/components/ui";
import { chaptersOf, getSite, levelHref, lessonsOfLevel, liveAnnouncements } from "@/lib/content/site";
import { arDigits } from "@/lib/quran/ref";

const STEPS = [
  { t: "اختر مستواك", d: "أربعة مستويات متدرجة من التأسيسي حتى متطلب الإجازة." },
  { t: "ادرس الدرس", d: "شرح منظم مع رقم الصفحة من المنهج وأمثلة قرآنية موثقة." },
  { t: "حمّل وتدرّب", d: "ملفات ومقاطع صوتية وتمارين تفاعلية." },
  { t: "اختبر نفسك", d: "اختبارات بنتيجة فورية وتصحيح مفصل — دون تسجيل." },
];

export default async function HomePage() {
  const site = await getSite();
  const announcements = liveAnnouncements(site).slice(0, 3);

  return (
    <>
      <section className="rounded-2xl bg-brand-900 px-5 py-8 text-white sm:px-8 sm:py-12">
        <p className="text-sm text-gold-100">منصة مجانية مفتوحة للجميع</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">حَقَّ تِلَاوَتِهِ</h1>
        <p className="mt-2 text-lg text-brand-100">رحلتك نحو إتقان تلاوة القرآن الكريم</p>
        <div className="mt-4 rounded-xl bg-white/95 px-3 text-ink">
          <QuranVerse quranRef={{ surah: 2, ayah: 121, wordStart: 1, wordEnd: 6 }} inline />
        </div>
        <p className="mt-4 max-w-2xl text-brand-100">
          تصفّح المستويات، وادرس الدروس، وحمّل المواد، وتدرّب، واختبر نفسك وشاهد نتيجتك وتصحيحك — دون تسجيل ودون أي رسوم.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/levels/" className="tap inline-flex items-center rounded-lg bg-gold-500 px-5 font-bold text-brand-900">ابدأ التعلّم</Link>
          <Link href="/exams/" className="tap inline-flex items-center rounded-lg border border-white/40 px-5">الاختبارات</Link>
        </div>
      </section>

      <Section title="المستويات الأربعة" id="levels">
        {site.levels.length === 0 ? (
          <EmptyState title="لم يُنشر المنهج بعد">{UNDER_REVIEW_NOTE}</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {site.levels.map((l) => {
              const lessons = lessonsOfLevel(site, l.id).length;
              return (
                <Card key={l.id} href={levelHref(l)}>
                  <p className="text-sm text-gold-700">{l.subtitle ?? `المرحلة ${arDigits(l.sort_order)}`}</p>
                  <h3 className="text-lg font-bold text-brand-900">{l.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {arDigits(chaptersOf(site, l.id).length)} أبواب · {lessons ? `${arDigits(lessons)} درسًا منشورًا` : "الدروس قيد المراجعة"}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="كيف تعمل المنصة؟" id="how">
        <ol className="grid gap-3 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-xl border border-line bg-white p-4">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">{arDigits(i + 1)}</span>
              <p className="mt-2 font-bold">{s.t}</p>
              <p className="text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">
          الحساب اختياري: أنشئه فقط إن أردت حفظ تقدّمك وسجل اختباراتك عبر أجهزتك، أو الحصول على شهادة إتمام مستوى.
        </p>
      </Section>

      <Section title="استكشف" id="explore">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card href="/academy/"><h3 className="font-bold text-brand-900">أكاديمية المخارج والصفات</h3><p className="text-sm text-muted">مخارج الحروف وصفاتها وألقابها.</p></Card>
          <Card href="/encyclopedia/"><h3 className="font-bold text-brand-900">موسوعة التجويد</h3><p className="text-sm text-muted">تعريفات الأحكام وشرحها مرتبة.</p></Card>
          <Card href="/resources/"><h3 className="font-bold text-brand-900">المواد والملفات</h3><p className="text-sm text-muted">ملفات للتحميل ومقاطع صوتية ومرئية.</p></Card>
        </div>
      </Section>

      {announcements.length > 0 && (
        <Section title="آخر الإعلانات" id="news">
          <AnnouncementList items={announcements} resources={site.resources} compact />
          <Link href="/announcements/" className="tap mt-2 inline-flex items-center text-brand-700 underline">كل الإعلانات</Link>
        </Section>
      )}
    </>
  );
}
