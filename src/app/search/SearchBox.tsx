"use client";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { normalizeArabic } from "@/lib/arabic/normalize";

export type SearchEntry = { kind: string; title: string; href: string; context: string; snippet: string; n: string };

export function SearchBox({ index }: { index: SearchEntry[] }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const results = useMemo(() => {
    const terms = normalizeArabic(dq).split(" ").filter((t) => t.length >= 2);
    if (!terms.length) return [];
    return index
      .map((e) => {
        if (!terms.every((t) => e.n.includes(t))) return null;
        const nt = normalizeArabic(e.title);
        const score = terms.reduce((s, t) => s + (nt.includes(t) ? 3 : 1), 0);
        return { e, score };
      })
      .filter((x) => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [dq, index]);

  return (
    <div>
      <label htmlFor="q" className="sr-only">كلمة البحث</label>
      <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="مثال: الإخفاء، الغنة، المد…"
        className="tap w-full rounded-xl border border-line bg-white px-4 text-lg focus:border-brand-500" />
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {index.length === 0 ? "لا يوجد محتوى منشور بعد للبحث فيه." : dq.trim().length >= 2 ? `${results.length} نتيجة` : "يتجاهل البحث التشكيل واختلاف أشكال الهمزة والتاء المربوطة."}
      </p>
      <ul className="mt-4 space-y-2">
        {results.map(({ e }) => (
          <li key={e.href + e.title}>
            <Link href={e.href} className="block rounded-xl border border-line bg-white p-3 hover:border-brand-500">
              <span className="text-xs text-gold-700">{e.kind}{e.context ? ` · ${e.context}` : ""}</span>
              <span className="block font-bold">{e.title}</span>
              {e.snippet && <span className="line-clamp-2 block text-sm text-muted">{e.snippet}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
