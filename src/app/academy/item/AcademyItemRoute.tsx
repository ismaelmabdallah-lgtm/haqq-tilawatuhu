"use client";
import { useSearchParams } from "next/navigation";
import { AcademyHome, AcademyItem, type AcademyKind } from "@/components/learn/AcademyViews";

const TYPES: AcademyKind[] = ["letter", "point", "characteristic"];

export function AcademyItemRoute() {
  const sp = useSearchParams();
  const type = sp.get("type") as AcademyKind | null;
  const key = sp.get("key") ?? "";
  if (!type || !TYPES.includes(type) || !/^[a-z0-9-]{1,80}$/.test(key)) return <AcademyHome initial={null} />;
  return <AcademyItem key={type + key} initial={null} type={type} itemKey={key} />;
}
