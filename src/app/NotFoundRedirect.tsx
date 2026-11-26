"use client";
import { useEffect, useSyncExternalStore } from "react";
import { NotFoundNotice } from "@/components/ui";

const LEVEL_PATH = /^\/levels\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?\/?$/;
const noop = () => () => {};

function liveTarget(pathname: string): string | null {
  const m = LEVEL_PATH.exec(pathname);
  if (!m || m[1] === "_") return null;
  const q = new URLSearchParams({ level: m[1]! });
  if (m[2]) q.set("chapter", m[2]);
  if (m[3]) q.set("lesson", m[3]);
  return `/learn/?${q.toString()}`;
}

export function NotFoundRedirect() {
  const target = useSyncExternalStore(noop, () => liveTarget(window.location.pathname), () => null);
  useEffect(() => { if (target) window.location.replace(target); }, [target]);
  return target ? <p className="py-10 text-center text-muted">جارٍ فتح الصفحة…</p> : <NotFoundNotice />;
}
