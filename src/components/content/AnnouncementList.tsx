"use client";
import { useSyncExternalStore } from "react";
import { ResourceItem, type ResourceView } from "@/components/content/ResourceItem";
import { Badge } from "@/components/ui";
import type { Database } from "@/lib/database.types";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];

const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "long" });
// The page is static: re-check publish/expiry against the visitor's clock.
// getSnapshot must be stable, so the visitor's clock is read once per page load.
let pageLoadedAt: number | null = null;
const nowStore = { subscribe: () => () => {}, get: () => (pageLoadedAt ??= Date.now()), server: () => 0 };

export function AnnouncementList({ items, resources, compact = false }: { items: Announcement[]; resources: ResourceView[]; compact?: boolean }) {
  const now = useSyncExternalStore(nowStore.subscribe, nowStore.get, nowStore.server);
  const visible = now ? items.filter((a) => Date.parse(a.publish_at) <= now && (!a.expires_at || Date.parse(a.expires_at) > now)) : items;
  if (!visible.length) return <p className="text-muted">لا توجد إعلانات حاليًا.</p>;
  return (
    <ul className="space-y-3">
      {visible.map((a) => {
        const att = a.attachment_resource_id ? resources.find((r) => r.id === a.attachment_resource_id) : undefined;
        return (
          <li key={a.id} className="rounded-xl border border-line bg-white p-4" data-announcement>
            <div className="flex flex-wrap items-center gap-2">
              {a.pinned && <Badge tone="gold">مثبّت</Badge>}
              <time className="text-xs text-muted" dateTime={a.publish_at}>{fmt.format(new Date(a.publish_at))}</time>
            </div>
            <h3 className="mt-1 font-bold text-brand-900">{a.title}</h3>
            {a.body && <p className={`mt-1 whitespace-pre-line text-sm ${compact ? "line-clamp-3" : ""}`}>{a.body}</p>}
            {a.link_url && !compact && (
              <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="tap mt-2 inline-flex items-center text-brand-700 underline">فتح الرابط</a>
            )}
            {att && !compact && <ul className="mt-3"><ResourceItem r={att} /></ul>}
          </li>
        );
      })}
    </ul>
  );
}
