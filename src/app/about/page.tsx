import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Markdown } from "@/components/content/Markdown";
import { QuranVerse } from "@/components/quran/QuranVerse";
import { Breadcrumbs } from "@/components/ui";
import { getSite } from "@/lib/content/site";

export const metadata = { title: "عن المنصة" };

/** Text from docs/content/about.ar.md (the approved About copy), rendered at build time. */
export default async function AboutPage() {
  const md = readFileSync(join(process.cwd(), "docs", "content", "about.ar.md"), "utf8");
  const [, title = "عن المنصة", ...rest] = md.split(/^# (.+)$/m);
  const body = rest.join("");
  // Show the verse the name comes from (البقرة ١٢١) right after «معنى الاسم».
  const [beforeName, afterName] = body.split(/(?=^## الرؤية)/m);
  const site = await getSite();

  return (
    <article>
      <Breadcrumbs items={[{ label: "عن المنصة" }]} />
      <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">{title.trim()}</h1>
      <Markdown source={beforeName} />
      <QuranVerse quranRef={{ surah: 2, ayah: 121 }} />
      <Markdown source={afterName} />
      {site.edition?.curriculum.affiliation_note && (
        <p className="mt-6 rounded-lg bg-gold-100 p-3 text-sm text-gold-700">{site.edition.curriculum.affiliation_note}</p>
      )}
      <section className="mt-8 rounded-xl border border-line bg-white p-4 text-sm text-muted">
        <h2 className="mb-1 font-bold text-ink">مصدر النص القرآني</h2>
        <p>
          يُعرض النص القرآني في المنصة من <a href="https://tanzil.net" className="underline" target="_blank" rel="noopener">مشروع تنزيل (Tanzil Project)</a>
          {" "}— النص العثماني، الإصدار ١٫١، رواية حفص عن عاصم — منسوخًا كما هو دون أي تعديل، ومتحققًا منه ببصمة SHA-256
          عند كل بناء للموقع، وفق ترخيص المشاع الإبداعي (CC BY 3.0). لا يُكتب أي نص قرآني يدويًا في المنصة.
        </p>
      </section>
    </article>
  );
}
