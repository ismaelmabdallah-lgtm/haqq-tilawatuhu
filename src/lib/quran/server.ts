/** Build-time access to the verified Tanzil bundle (public/quran). */
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SurahFile, SurahIndex } from "./ref";

const dir = join(process.cwd(), "public", "quran");
const cache = new Map<number, SurahFile>();
let index: SurahIndex | null = null;

export function surahIndex(): SurahIndex {
  index ??= JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as SurahIndex;
  return index;
}

export function loadSurah(n: number): SurahFile {
  let s = cache.get(n);
  if (!s) {
    s = JSON.parse(readFileSync(join(dir, `${n}.json`), "utf8")) as SurahFile;
    cache.set(n, s);
  }
  return s;
}
