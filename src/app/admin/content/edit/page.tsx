"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EntityEditor } from "@/components/admin/EntityEditor";
import { ENTITIES, type EntityKey } from "@/lib/admin/entities";
import { isUuid } from "@/lib/shell-route";

export default function ContentEditPage() {
  const sp = useSearchParams();
  const entity = sp.get("entity") as EntityKey | null;
  const id = sp.get("id");
  if (!entity || !ENTITIES[entity]) return <p>نوع غير معروف.</p>;
  if (id && !isUuid(id)) return <p>معرّف غير صالح.</p>;
  return (
    <>
      <Link href={`/admin/content/?entity=${entity}`} className="tap mb-2 inline-flex items-center text-sm text-brand-700">→ {ENTITIES[entity].label}</Link>
      <EntityEditor key={`${entity}:${id ?? "new"}`} entity={entity} id={id} />
    </>
  );
}
