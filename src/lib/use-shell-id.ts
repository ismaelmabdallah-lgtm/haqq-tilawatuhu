"use client";
import { useSyncExternalStore } from "react";
import { parseShellId, type ShellRoute } from "@/lib/shell-route";

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};

/**
 * The id of a client-only route, read from the real browser URL.
 * undefined = not yet known (server/prerender), null = invalid/missing id.
 */
export function useShellId(route: ShellRoute): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => parseShellId(route, window.location.pathname),
    () => undefined,
  );
}
