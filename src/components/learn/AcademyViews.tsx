"use client";
import Link from "next/link";
import { MarkdownClient } from "@/components/content/MarkdownClient";
import { ResourceItem } from "@/components/content/ResourceItem";
import { ListSkeleton } from "@/components/learn/LearnViews";
import { QuranVerseClient } from "@/components/quran/QuranVerseClient";
import { Breadcrumbs, EmptyState, NotFoundNotice, PageTitle, ProvenanceBadges, Section } from "@/components/ui";
import { characteristicsOfLetter, examplesOfLetter, lettersOfPoint, lettersWithCharacteristic, pointsByArea } from "@/lib/content/academy";
import { useLiveSite } from "@/lib/content/live";
import type { AcademyLetter, Site } from "@/lib/content/model";
import { fromExample } from "@/lib/quran/ref";

export type AcademyKind = "letter" | "point" | "characteristic";

/** Pre-rendered pages when they exist in this build, else the live route. */
function academyLinks(initial: Site | null) {
  const letters = new Set(initial?.letters.map((l) => l.id) ?? []);
  const points = new Set(initial?.points.map((p) => p.id) ?? []);
  const chars = new Set(initial?.characteristics.map((c) => c.id) ?? []);
  const live = (type: AcademyKind, key: string) => `/academy/item/?type=${type}&key=${encodeURIComponent(key)}`;
  return {
    letter: (l: AcademyLetter) => (letters.has(l.id) ? `/academy/letters/${l.sort_order}/` : live("letter", String(l.sort_order))),
    point: (p: { id: string; code: string }) => (points.has(p.id) ? `/academy/points/${p.code}/` : live("point", p.code)),
    characteristic: (c: { id: string; code: string }) => (chars.has(c.id) ? `/academy/characteristics/${c.code}/` : live("characteristic", c.code)),
  };
}

const crumbs = (label: string, section?: { href: string; label: string }) => (
  <Breadcrumbs items={[{ href: "/academy/", label: "الأكاديمية" }, ...(section ? [section] : []), { label }]} />
);

// ---------------------------------------------------------------------------
export function AcademyHome({ initial }: { initial: Site | null }) {
  const { site, failed } = useLiveSite(initial);
  const link = academyLinks(initial);
  if (!site) return failed ? <EmptyState title="تعذر الاتصال بالخادم" /> : <ListSkeleton />;
  const pairs: [Site["characteristics"][number], Site["characteristics"][number] | undefined][] = [];
  const seen = new Set<string>();
  for (const c of site.characteristics.filter((x) => x.has_opposite)) {
    if (seen.has(c.id)) continue;
    const o = site.characteristics.find((x) => x.id === c.opposite_id) ?? site.characteristics.find((x) => x.opposite_id === c.id);
    seen.add(c.id); if (o) seen.add(o.id);
    pairs.push([c, o]);
  }
  const single = site.characteristics.filter((c) => !c.has_opposite);
  const empty = !site.points.length && !site.characteristics.length && !site.letters.length;

  return (
    <div data-academy>
      <Breadcrumbs items={[{ label: "الأكاديمية" }]} />
      <PageTitle title="أكاديمية المخارج والصفات" subtitle="تعرّف على مخرج كل حرف وصفاته، بالصورة والصوت، كما وردت في المنهج." />
      <div className="mb-6 grid grid-cols-3 gap-2 text-center">
        {[["#letters", "الحروف", site.letters.length], ["#points", "المخارج", site.points.length], ["#characteristics", "الصفات", site.characteristics.length]].map(([href, label, n]) => (
          <a key={String(href)} href={String(href)} className="tap rounded-2xl border border-line bg-white p-3 hover:border-brand-500">
            <b className="block text-2xl text-brand-700">{Number(n).toLocaleString("ar-u-nu-arab")}</b><span className="text-sm text-muted">{label}</span>
          </a>
        ))}
      </div>
      {empty && <EmptyState title="محتوى الأكاديمية قيد الإعداد">تُضاف الحروف والمخارج والصفات تدريجيًا مع الصور والتسجيلات الصوتية.</EmptyState>}

      {site.letters.length > 0 && (
        <Section title="الحروف" id="letters">
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {site.letters.map((l) => (
              <li key={l.id}>
                <Link href={link.letter(l)} aria-label={`الحرف ${l.letter}`} className="grid aspect-square min-h-14 place-items-center rounded-2xl border border-line bg-white text-3xl font-bold text-brand-700 shadow-sm hover:border-brand-500">{l.letter}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {site.points.length > 0 && (
        <Section title="المخارج" id="points">
          <div className="space-y-4">
            {pointsByArea(site).map(([area, points]) => (
              <div key={area}>
                <h3 className="mb-2 font-bold text-gold-700">{area}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {points.map((p) => (
                    <li key={p.id}>
                      <Link href={link.point(p)} className="block rounded-2xl border border-line bg-white p-4 hover:border-brand-500">
                        <span className="font-bold">{p.name}</span>
                        <span className="mt-1 block text-2xl tracking-widest text-brand-700">{lettersOfPoint(site, p.id).map((l) => l.letter).join(" ") || "—"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}
      {site.characteristics.length > 0 && (
        <Section title="الصفات" id="characteristics">
          {pairs.length > 0 && (
            <>
              <h3 className="mb-2 font-bold text-gold-700">صفات لها ضد</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {pairs.map(([a, b]) => (
                  <li key={a.id} className="flex items-stretch gap-2">
                    <Link href={link.characteristic(a)} className="tap flex flex-1 items-center justify-center rounded-xl border border-line bg-white font-bold hover:border-brand-500">{a.name}</Link>
                    <span className="self-center text-muted" aria-label="ضدها">⇄</span>
                    {b ? <Link href={link.characteristic(b)} className="tap flex flex-1 items-center justify-center rounded-xl border border-line bg-white font-bold hover:border-brand-500">{b.name}</Link> : <span className="flex-1" />}
                  </li>
                ))}
              </ul>
            </>
          )}
          {single.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 font-bold text-gold-700">صفات لا ضد لها</h3>
              <ul className="flex flex-wrap gap-2">
                {single.map((c) => <li key={c.id}><Link href={link.characteristic(c)} className="tap inline-flex items-center rounded-xl border border-line bg-white px-4 font-bold hover:border-brand-500">{c.name}</Link></li>)}
              </ul>
            </>
          )}
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AcademyItem({ initial, type, itemKey }: { initial: Site | null; type: AcademyKind; itemKey: string }) {
  const { site, live, failed } = useLiveSite(initial);
  const link = academyLinks(initial);
  if (!site) return failed ? <EmptyState title="تعذر الاتصال بالخادم" /> : <ListSkeleton rows={2} />;
  const settled = live || failed || initial;
  const riwayahCode = site.edition?.riwayah?.code;

  if (type === "letter") {
    const letter = site.letters.find((l) => String(l.sort_order) === itemKey);
    if (!letter) return settled ? <NotFoundNotice what="صفحة الحرف" /> : <ListSkeleton rows={2} />;
    const point = site.points.find((p) => p.id === letter.articulation_point_id);
    const chars = characteristicsOfLetter(site, letter.id);
    const audio = site.resources.find((r) => r.id === letter.audio_resource_id);
    return (
      <article data-academy-letter={letter.sort_order}>
        {crumbs(`الحرف ${letter.letter}`)}
        <div className="mb-6 flex items-center gap-4">
          <span className="grid h-24 w-24 place-items-center rounded-3xl bg-brand-700 text-5xl font-bold text-white">{letter.letter}</span>
          <div>
            <h1 className="text-2xl font-bold text-brand-900">الحرف «{letter.letter}»</h1>
            <div className="mt-2"><ProvenanceBadges origin={letter.origin} verified={letter.scientifically_verified} pageStart={letter.source_page_start} /></div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-muted">المخرج</p>
            {point ? <Link href={link.point(point)} className="font-bold text-brand-700 underline">{point.name} ({point.general_area})</Link> : <p>—</p>}
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-muted">الصفات</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {chars.length ? chars.map((c) => <li key={c.id}><Link href={link.characteristic(c)} className="inline-flex min-h-9 items-center rounded-full bg-brand-50 px-3 text-sm text-brand-700">{c.name}</Link></li>) : <li>—</li>}
            </ul>
          </div>
        </div>
        {audio && <Section title="النطق الصحيح"><ul><ResourceItem r={audio} /></ul></Section>}
        {letter.description_md && <Section title="الوصف"><MarkdownClient source={letter.description_md} riwayahCode={riwayahCode} /></Section>}
        {letter.common_mistakes_md && <Section title="أخطاء شائعة"><MarkdownClient source={letter.common_mistakes_md} riwayahCode={riwayahCode} /></Section>}
        {examplesOfLetter(site, letter.id).length > 0 && (
          <Section title="أمثلة قرآنية">
            {examplesOfLetter(site, letter.id).map((e) => <QuranVerseClient key={e.id} quranRef={fromExample(e)} riwayahCode={site.riwayat.find((r) => r.id === e.riwayah_id)?.code ?? riwayahCode} note={e.note} />)}
          </Section>
        )}
      </article>
    );
  }

  if (type === "point") {
    const point = site.points.find((p) => p.code === itemKey);
    if (!point) return settled ? <NotFoundNotice what="صفحة المخرج" /> : <ListSkeleton rows={2} />;
    const letters = lettersOfPoint(site, point.id);
    const diagram = site.resources.find((r) => r.id === point.diagram_resource_id);
    return (
      <article data-academy-point={point.code}>
        {crumbs(point.name, { href: "/academy/#points", label: "المخارج" })}
        <PageTitle title={point.name} subtitle={point.general_area}>
          <ProvenanceBadges origin={point.origin} verified={point.scientifically_verified} pageStart={point.source_page_start} />
        </PageTitle>
        {diagram && <ul><ResourceItem r={diagram} /></ul>}
        {letters.length > 0 && (
          <Section title="الحروف الخارجة منه">
            <ul className="flex flex-wrap gap-2">
              {letters.map((l) => <li key={l.id}><Link href={link.letter(l)} className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white text-2xl font-bold hover:border-brand-500">{l.letter}</Link></li>)}
            </ul>
          </Section>
        )}
        {point.description_md && <Section title="الوصف"><MarkdownClient source={point.description_md} riwayahCode={riwayahCode} /></Section>}
      </article>
    );
  }

  const c = site.characteristics.find((x) => x.code === itemKey);
  if (!c) return settled ? <NotFoundNotice what="صفحة الصفة" /> : <ListSkeleton rows={2} />;
  const opposite = c.opposite_id ? site.characteristics.find((x) => x.id === c.opposite_id) : site.characteristics.find((x) => x.opposite_id === c.id);
  const letters = lettersWithCharacteristic(site, c.id);
  return (
    <article data-academy-characteristic={c.code}>
      {crumbs(c.name, { href: "/academy/#characteristics", label: "الصفات" })}
      <PageTitle title={`صفة ${c.name}`} subtitle={c.has_opposite ? "من الصفات التي لها ضد" : "من الصفات التي لا ضد لها"}>
        <ProvenanceBadges origin={c.origin} verified={c.scientifically_verified} pageStart={c.source_page_start} />
      </PageTitle>
      {opposite && <p>ضدها: <Link href={link.characteristic(opposite)} className="font-bold text-brand-700 underline">{opposite.name}</Link></p>}
      {c.description_md && <Section title="الوصف"><MarkdownClient source={c.description_md} riwayahCode={riwayahCode} /></Section>}
      {letters.length > 0 && (
        <Section title="حروفها">
          <ul className="flex flex-wrap gap-2">
            {letters.map((l) => <li key={l.id}><Link href={link.letter(l)} className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white text-2xl font-bold hover:border-brand-500">{l.letter}</Link></li>)}
          </ul>
        </Section>
      )}
    </article>
  );
}
