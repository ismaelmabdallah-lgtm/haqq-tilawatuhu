#!/usr/bin/env node
/**
 * Quranic text setup — the ONLY way Quranic text enters the site.
 *
 * Source: Tanzil Project, Uthmani text v1.1 (Hafs), CC BY 3.0, verbatim copies
 * only ("CHANGING IT IS NOT ALLOWED"). This script:
 *   1. downloads the text + metadata into vendor/tanzil/ if missing,
 *   2. verifies both files against pinned SHA-256 checksums (fails hard on mismatch),
 *   3. splits the text into public/quran/<surah>.json (ayah text copied byte-for-byte)
 *      and public/quran/index.json (surah names/ayah counts from Tanzil metadata),
 *      each carrying Tanzil's copyright block, as its terms require.
 *
 * To update the pinned text deliberately: download, review the change at
 * https://tanzil.net/updates/, then update the hashes below.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(root, "vendor", "tanzil");
const outDir = join(root, "public", "quran");

const SOURCES = {
  text: {
    file: "quran-uthmani.txt",
    url: "https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=false&tatweel=true&quranType=uthmani&outType=txt-2&agree=true",
    sha256: "7f30c647331a61100ebf24a80507dc0fcdd9f2df97f1312b5b2dfcb982a7f326",
  },
  meta: {
    file: "quran-data.xml",
    url: "https://tanzil.net/res/text/metadata/quran-data.xml",
    sha256: "8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a",
  },
};
const TOTAL_AYAT = 6236;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function ensure(src) {
  const path = join(vendorDir, src.file);
  if (!existsSync(path)) {
    console.log(`[quran] downloading ${src.file} from Tanzil…`);
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`download failed (${res.status}) for ${src.url}`);
    mkdirSync(vendorDir, { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const buf = readFileSync(path);
  const got = sha256(buf);
  if (got !== src.sha256) {
    throw new Error(`[quran] CHECKSUM MISMATCH for ${src.file}\n  expected ${src.sha256}\n  got      ${got}\nRefusing to build with unverified Quranic text.`);
  }
  return buf.toString("utf8");
}

async function main() {
  const text = await ensure(SOURCES.text);
  const meta = await ensure(SOURCES.meta);

  const copyright = text.split("\n").filter((l) => l.startsWith("#")).join("\n");
  if (!copyright.includes("Tanzil")) throw new Error("[quran] copyright block missing from source text");

  const surahs = [];
  for (const m of meta.matchAll(/<sura index="(\d+)" ayas="(\d+)" start="\d+" name="([^"]+)" tname="([^"]+)" ename="[^"]*" type="(Meccan|Medinan)"/g)) {
    surahs.push({ number: Number(m[1]), ayat: Number(m[2]), name: m[3], tname: m[4], type: m[5] });
  }
  if (surahs.length !== 114) throw new Error(`[quran] expected 114 surahs in metadata, got ${surahs.length}`);

  const ayat = new Map(surahs.map((s) => [s.number, []]));
  let count = 0;
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [s, a, ...rest] = line.replace(/\r$/, "").split("|");
    const list = ayat.get(Number(s));
    if (!list || Number(a) !== list.length + 1) throw new Error(`[quran] unexpected line order at ${s}:${a}`);
    list.push(rest.join("|"));   // verbatim
    count++;
  }
  if (count !== TOTAL_AYAT) throw new Error(`[quran] expected ${TOTAL_AYAT} ayat, got ${count}`);
  for (const s of surahs) {
    if (ayat.get(s.number).length !== s.ayat) throw new Error(`[quran] surah ${s.number}: ayah count mismatch`);
  }

  const source = { name: "Tanzil Project — Uthmani text v1.1 (Hafs)", url: "https://tanzil.net", license: "CC BY 3.0", sha256: SOURCES.text.sha256, copyright };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.json"), JSON.stringify({ source, surahs }));
  for (const s of surahs) {
    writeFileSync(join(outDir, `${s.number}.json`), JSON.stringify({ source, surah: s.number, name: s.name, ayat: ayat.get(s.number) }));
  }
  console.log(`[quran] verified ${count} ayat (sha256 ${SOURCES.text.sha256.slice(0, 12)}…) → public/quran/ (115 files)`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
