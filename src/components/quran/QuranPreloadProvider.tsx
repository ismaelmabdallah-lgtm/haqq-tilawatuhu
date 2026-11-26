"use client";
import { QuranPreload, type Resolved } from "./QuranVerseClient";

export function QuranPreloadProvider({ value, children }: { value: Record<string, Resolved>; children: React.ReactNode }) {
  return <QuranPreload.Provider value={value}>{children}</QuranPreload.Provider>;
}
