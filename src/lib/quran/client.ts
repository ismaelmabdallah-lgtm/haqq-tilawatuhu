"use client";
/** Browser access to the verified Tanzil bundle (served statically from /quran/). */
import type { SurahFile } from "./ref";

const cache = new Map<number, Promise<SurahFile>>();

export function fetchSurah(n: number): Promise<SurahFile> {
  let p = cache.get(n);
  if (!p) {
    p = fetch(`/quran/${n}.json`).then((r) => {
      if (!r.ok) throw new Error(`quran ${n}: ${r.status}`);
      return r.json() as Promise<SurahFile>;
    });
    p.catch(() => cache.delete(n));
    cache.set(n, p);
  }
  return p;
}
