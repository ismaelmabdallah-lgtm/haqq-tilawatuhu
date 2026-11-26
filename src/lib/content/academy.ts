import type { AcademyLetter, Site } from "./model";

export const letterHref = (l: AcademyLetter) => `/academy/letters/${l.sort_order}/`;
export const pointHref = (code: string) => `/academy/points/${code}/`;
export const characteristicHref = (code: string) => `/academy/characteristics/${code}/`;

export function lettersOfPoint(site: Site, pointId: string) {
  return site.letters.filter((l) => l.articulation_point_id === pointId);
}
export function characteristicsOfLetter(site: Site, letterId: string) {
  return site.letterCharacteristics.filter((lc) => lc.letter_id === letterId)
    .map((lc) => site.characteristics.find((c) => c.id === lc.characteristic_id)).filter((c) => c !== undefined);
}
export function lettersWithCharacteristic(site: Site, characteristicId: string) {
  const ids = new Set(site.letterCharacteristics.filter((lc) => lc.characteristic_id === characteristicId).map((lc) => lc.letter_id));
  return site.letters.filter((l) => ids.has(l.id));
}
export function examplesOfLetter(site: Site, letterId: string) {
  return site.letterExamples.filter((le) => le.letter_id === letterId)
    .map((le) => site.examples.find((e) => e.id === le.example_id)).filter((e) => e !== undefined);
}
/** Articulation points grouped by general area (الجوف، الحلق، اللسان، الشفتان، الخيشوم), in sort order. */
export function pointsByArea(site: Site) {
  const groups = new Map<string, Site["points"]>();
  for (const p of site.points) groups.set(p.general_area, [...(groups.get(p.general_area) ?? []), p]);
  return [...groups.entries()];
}
