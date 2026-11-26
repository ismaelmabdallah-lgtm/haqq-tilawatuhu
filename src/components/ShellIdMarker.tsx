"use client";
import type { ShellRoute } from "@/lib/shell-route";
import { useShellId } from "@/lib/use-shell-id";

/** Exposes the id parsed from the real URL (used by the routing E2E test). */
export function ShellIdMarker({ route, children }: { route: ShellRoute; children: React.ReactNode }) {
  const id = useShellId(route);
  return <div data-shell-id={id ?? undefined} data-shell-route={route}>{children}</div>;
}
