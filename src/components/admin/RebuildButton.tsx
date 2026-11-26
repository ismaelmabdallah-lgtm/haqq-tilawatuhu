"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { can } from "@/lib/auth";
import { callFunction } from "@/lib/admin/db";

/** Publishers regenerate the static site after publishing (POST /api/rebuild, checked by is_publisher()). */
export function RebuildButton() {
  const { roles } = useAdmin();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const allowed = can.publish(roles);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    fetch("/api/rebuild").then((r) => (r.ok ? r.json() : { enabled: false })).catch(() => ({ enabled: false }))
      .then((j: { enabled?: boolean }) => { if (alive) setEnabled(Boolean(j.enabled)); });
    return () => { alive = false; };
  }, [allowed]);

  if (!allowed) return null;
  if (enabled === false) return <p className="text-xs text-muted">إعادة بناء الموقع غير مُفعّلة هنا (يلزم ربط Deploy Hook في Cloudflare Pages). ستظهر التغييرات بعد البناء التالي.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!enabled || state === "busy"} data-rebuild
        onClick={async () => {
          setState("busy");
          const res = await callFunction("/api/rebuild", { method: "POST" }).catch(() => null);
          if (res?.ok) { setState("done"); setMsg("طُلبت إعادة بناء الموقع؛ تظهر التغييرات خلال دقائق."); }
          else { setState("error"); setMsg("تعذر طلب إعادة البناء."); }
        }}
        className="tap rounded-lg border border-brand-500 px-4 text-sm text-brand-700 disabled:opacity-50">
        {state === "busy" ? "جارٍ الطلب…" : "إعادة بناء الموقع العام"}
      </button>
      {msg && <span role="status" className={`text-sm ${state === "error" ? "text-danger" : "text-ok"}`}>{msg}</span>}
    </div>
  );
}
