"use client";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { can, ROLE_LABELS, type PlatformRole } from "@/lib/auth";
import { table } from "@/lib/admin/db";
import { errorMessage } from "@/lib/errors";

type Assignment = { user_id: string; role: PlatformRole; granted_at: string };
type Profile = { id: string; full_name: string; display_name: string | null };

/** Super admins grant/remove team roles (RLS: pra_write → is_super_admin()). */
export default function TeamPage() {
  const { roles, userId } = useAdmin();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [user, setUser] = useState("");
  const [role, setRole] = useState<PlatformRole>("content_editor");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, p] = await Promise.all([
      table<Assignment>("platform_role_assignments").select("user_id,role,granted_at").order("granted_at"),
      table<Profile>("profiles").select("id,full_name,display_name").order("full_name").limit(2000),
    ]);
    setAssignments(a.data ?? []); setProfiles(p.data ?? []);
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  if (!can.superAdmin(roles)) return <p>هذه الصفحة للمدير العام فقط.</p>;
  const name = (id: string) => { const p = profiles.find((x) => x.id === id); return p ? (p.full_name || p.display_name || id) : id; };

  async function grant() {
    if (!user) return;
    const { error } = await table("platform_role_assignments").insert({ user_id: user, role, granted_by: userId });
    setMsg(error ? errorMessage(error) : null); if (!error) void load();
  }
  async function revoke(a: Assignment) {
    if (a.user_id === userId && a.role === "super_admin" && !confirm("ستفقد صلاحية المدير العام. متابعة؟")) return;
    const { error } = await table("platform_role_assignments").delete().eq("user_id", a.user_id).eq("role", a.role);
    setMsg(error ? errorMessage(error) : null); if (!error) void load();
  }

  return (
    <div data-team>
      <h1 className="mb-4 text-2xl font-bold text-brand-900">فريق المنصة</h1>
      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-line bg-white p-3">
        <select value={user} onChange={(e) => setUser(e.target.value)} className="tap min-w-56 flex-1 rounded-lg border border-line px-2" aria-label="المستخدم">
          <option value="">— اختر حسابًا مسجلًا —</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.display_name || p.id}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)} className="tap rounded-lg border border-line px-2" aria-label="الدور">
          {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button type="button" onClick={() => void grant()} className="tap rounded-lg bg-brand-700 px-4 text-white">منح الدور</button>
      </div>
      {msg && <p role="alert" className="mb-2 text-danger">{msg}</p>}
      <table className="w-full rounded-xl border border-line bg-white text-sm">
        <thead className="bg-brand-50"><tr><th className="p-2 text-start">العضو</th><th className="p-2 text-start">الدور</th><th className="p-2 text-start">المعرّف (للتعيين في المراجعة)</th><th /></tr></thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.user_id + a.role} className="border-t border-line">
              <td className="p-2">{name(a.user_id)}</td><td className="p-2">{ROLE_LABELS[a.role]}</td>
              <td className="p-2 font-mono text-xs" dir="ltr">{a.user_id}</td>
              <td className="p-2"><button type="button" onClick={() => void revoke(a)} className="tap text-danger">إزالة</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
