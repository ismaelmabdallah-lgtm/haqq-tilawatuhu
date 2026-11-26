"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { can, useRoles, useSession } from "@/lib/auth";
import { attemptStore } from "@/lib/exams/attempt-store";
import { errorMessage } from "@/lib/errors";
import { importItems, progressStore } from "@/lib/progress";
import { arDigits } from "@/lib/quran/ref";
import { shellHref } from "@/lib/shell-route";
import { getBrowserClient } from "@/lib/supabase/client";
import { useLiveSite } from "@/lib/content/live";
import { builtFrom, lessonLink, lessonPath, type Site } from "@/lib/content/model";

export type LessonIndex = { lessons: { id: string; title: string; href: string; levelId: string }[]; levels: { id: string; title: string }[] };

/** Lesson index from the live snapshot (falls back to the pre-rendered one). */
function useLessonIndex(initial: Site): LessonIndex {
  const { site } = useLiveSite(initial);
  const s = site ?? initial;
  const built = builtFrom(initial);
  return {
    lessons: s.lessons.flatMap((l) => { const p = lessonPath(s, l.id); return p ? [{ id: l.id, title: l.title, href: lessonLink(built, p), levelId: p.level.id }] : []; }),
    levels: s.levels.map((l) => ({ id: l.id, title: l.title })),
  };
}

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);

export function AccountClient({ initial }: { initial: Site }) {
  const index = useLessonIndex(initial);
  const { session, loading } = useSession();
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const reset = sp.get("reset") === "1";

  if (loading) return <p>جارٍ التحميل…</p>;
  if (session && reset) return <ResetPassword />;
  if (session) return <Dashboard session={session} index={index} next={next} />;
  return <AuthForms next={next} />;
}

// ---------------------------------------------------------------------------
function AuthForms({ next }: { next: string | null }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sb = getBrowserClient();
  const back = `${window.location.origin}/account/${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) setMsg({ ok: false, text: errorMessage(error) });
      else if (next) window.location.assign(next);
      return;
    }
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: back } });
      setBusy(false);
      if (error) setMsg({ ok: false, text: errorMessage(error) });
      else if (!data.session) setMsg({ ok: true, text: "أرسلنا رسالة تأكيد إلى بريدك. افتح الرابط فيها لتفعيل الحساب." });
      else if (next) window.location.assign(next);
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account/?reset=1` });
    setBusy(false);
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "إن كان البريد مسجلًا فستصلك رسالة لإعادة تعيين كلمة المرور." });
  }

  return (
    <div className="mx-auto max-w-md" data-auth={mode}>
      <h1 className="text-2xl font-bold text-brand-900">{mode === "signup" ? "إنشاء حساب" : mode === "forgot" ? "استعادة كلمة المرور" : "تسجيل الدخول"}</h1>
      <p className="mt-1 text-sm text-muted">الحساب اختياري تمامًا: كل الدروس والاختبارات متاحة دون تسجيل. يفيدك الحساب في حفظ تقدّمك ونتائجك عبر الأجهزة والحصول على شهادة إتمام مستوى.</p>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-line bg-white p-4">
        {mode === "signup" && (
          <label className="block text-sm">الاسم الكامل (يُطبع على الشهادة)
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={200} autoComplete="name" className="tap mt-1 w-full rounded-lg border border-line px-3" />
          </label>
        )}
        <label className="block text-sm">البريد الإلكتروني
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="tap mt-1 w-full rounded-lg border border-line px-3" />
        </label>
        {mode !== "forgot" && (
          <label className="block text-sm">كلمة المرور
            <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="tap mt-1 w-full rounded-lg border border-line px-3" />
          </label>
        )}
        <button disabled={busy} className="tap w-full rounded-lg bg-brand-700 font-bold text-white disabled:opacity-60">
          {busy ? "…" : mode === "signup" ? "إنشاء الحساب" : mode === "forgot" ? "إرسال رابط الاستعادة" : "دخول"}
        </button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      </form>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
        {mode !== "signin" && <button type="button" className="tap text-brand-700 underline" onClick={() => setMode("signin")}>لدي حساب</button>}
        {mode !== "signup" && <button type="button" className="tap text-brand-700 underline" onClick={() => setMode("signup")}>إنشاء حساب جديد</button>}
        {mode !== "forgot" && <button type="button" className="tap text-brand-700 underline" onClick={() => setMode("forgot")}>نسيت كلمة المرور</button>}
      </div>
    </div>
  );
}

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="mx-auto max-w-md space-y-3 rounded-xl border border-line bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await getBrowserClient().auth.updateUser({ password: pw });
        setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "تم تغيير كلمة المرور." });
      }}>
      <h1 className="text-xl font-bold">كلمة مرور جديدة</h1>
      <input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoComplete="new-password" className="tap w-full rounded-lg border border-line px-3" aria-label="كلمة المرور الجديدة" />
      <button className="tap w-full rounded-lg bg-brand-700 text-white">حفظ</button>
      {msg && <p role="status" className={msg.ok ? "text-ok" : "text-danger"}>{msg.text}</p>}
      {msg?.ok && <a href="/account/" className="text-brand-700 underline">متابعة إلى حسابي</a>}
    </form>
  );
}

// ---------------------------------------------------------------------------
type Progress = { lesson_id: string; viewed_at: string | null; completed_at: string | null; practice_completed_at: string | null; assessment_passed_at: string | null; mastered_at: string | null; best_accuracy: number | null };
type Attempt = { attempt_id: string; exam_id: string; exam_title: string; status: string; started_at: string; total_score: number | null; max_score: number; passed: boolean | null };
type Rec = { lesson_id: string; lesson_title: string; accuracy: number; practice_exam_ids: string[] };
type Cert = { id: string; title: string; level_id: string; verification_code: string; completion_date: string; revoked_at: string | null };
type Note = { id: number; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

const fmt = new Intl.DateTimeFormat("ar-u-nu-arab", { dateStyle: "medium" });

function Dashboard({ session, index, next }: { session: Session; index: LessonIndex; next: string | null }) {
  const sb = getBrowserClient();
  const { roles } = useRoles(session.user.id);
  const [profile, setProfile] = useState<{ full_name: string; display_name: string | null } | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const local = useSyncExternalStore(progressStore.subscribe, progressStore.get, progressStore.server);
  const [localAttempts, setLocalAttempts] = useState(() => attemptStore.all().filter((a) => a.finished));

  const load = useCallback(async () => {
    const [p, pr, at, rc, ce, no] = await Promise.all([
      sb.from("profiles").select("full_name,display_name").eq("id", session.user.id).maybeSingle(),
      sb.from("lesson_progress").select("lesson_id,viewed_at,completed_at,practice_completed_at,assessment_passed_at,mastered_at,best_accuracy"),
      sb.rpc("list_my_attempts", {}),
      sb.rpc("my_review_recommendations", {}),
      sb.from("certificates").select("id,title,level_id,verification_code,completion_date,revoked_at").order("issued_at", { ascending: false }),
      sb.from("notifications").select("id,title,body,link,read_at,created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    setProfile(p.data ?? null); setProgress((pr.data ?? []) as Progress[]); setAttempts((at.data ?? []) as Attempt[]);
    setRecs((rc.data ?? []) as Rec[]); setCerts((ce.data ?? []) as Cert[]); setNotes((no.data ?? []) as Note[]);
  }, [sb, session.user.id]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  const localCount = Object.keys(local).length;
  async function syncGuestData() {
    setMsg(null);
    let imported = 0, claimed = 0;
    if (localCount) {
      const { data, error } = await sb.rpc("import_guest_progress", { p_items: importItems(local) });
      if (error) { setMsg({ ok: false, text: errorMessage(error) }); return; }
      imported = Number(data ?? 0);
    }
    if (localAttempts.length) {
      const { data, error } = await sb.rpc("claim_guest_attempts", { p_attempts: localAttempts.map((a) => a.attempt_id), p_tokens: localAttempts.map((a) => a.token) });
      if (error) { setMsg({ ok: false, text: errorMessage(error) }); return; }
      claimed = Number(data ?? 0);
      attemptStore.remove(localAttempts.map((a) => a.attempt_id));
      setLocalAttempts([]);
    }
    setMsg({ ok: true, text: `تم: ${arDigits(imported)} درسًا و${arDigits(claimed)} محاولة أُضيفت إلى حسابك.` });
    void load();
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await sb.from("profiles").update({ full_name: String(f.get("full_name") ?? "").trim(), display_name: String(f.get("display_name") ?? "").trim() || null }).eq("id", session.user.id);
    setMsg(error ? { ok: false, text: errorMessage(error) } : { ok: true, text: "تم حفظ الملف الشخصي." });
  }

  async function issue(levelId: string) {
    const { data, error } = await sb.rpc("issue_level_certificate", { p_level: levelId });
    if (error) setMsg({ ok: false, text: errorMessage(error) });
    else window.location.assign(shellHref("certificates", String(data)));
  }

  const done = new Set(progress.filter((p) => p.completed_at).map((p) => p.lesson_id));
  const unread = notes.filter((n) => !n.read_at);

  return (
    <div className="space-y-6" data-account>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-900">مرحبًا{profile?.full_name ? ` ${profile.full_name}` : ""}</h1>
        <div className="flex gap-2">
          {can.team(roles) && <a href="/admin/" className="tap inline-flex items-center rounded-lg border border-brand-500 px-3 text-brand-700">لوحة الفريق</a>}
          <button type="button" onClick={() => void sb.auth.signOut()} className="tap rounded-lg border border-line px-3" data-signout>تسجيل الخروج</button>
        </div>
      </div>
      {next && <a href={next} className="tap inline-flex items-center rounded-lg bg-brand-700 px-4 text-white">متابعة إلى الصفحة المطلوبة</a>}
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-brand-50 text-ok" : "bg-red-50 text-danger"}`}>{msg.text}</p>}

      {(localCount > 0 || localAttempts.length > 0) && (
        <section className="rounded-xl border border-gold-500 bg-gold-100 p-4" data-guest-sync>
          <p className="font-bold">لديك تقدّم محفوظ في هذا المتصفح</p>
          <p className="text-sm">{arDigits(localCount)} درسًا و{arDigits(localAttempts.length)} محاولة اختبار كضيف. يمكنك نقلها إلى حسابك (يُنقل الاطلاع والإكمال فقط؛ الإتقان يُحسب من الاختبارات).</p>
          <button type="button" onClick={() => void syncGuestData()} className="tap mt-2 rounded-lg bg-brand-700 px-4 text-white" data-sync-guest>نقل إلى حسابي</button>
        </section>
      )}

      {unread.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">إشعارات جديدة</h2>
          <ul className="space-y-2">{unread.map((n) => <li key={n.id} className="rounded-lg border border-line bg-white p-3 text-sm">{n.link ? <a href={n.link} className="font-bold text-brand-700 underline">{n.title}</a> : <b>{n.title}</b>} {n.body && <span className="text-muted">— {n.body}</span>}</li>)}</ul>
          <button type="button" className="tap mt-1 text-sm text-brand-700 underline" onClick={async () => { await sb.rpc("mark_notifications_read", {}); void load(); }}>تعليم الكل كمقروء</button>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">تقدّمي في المستويات</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {index.levels.map((lv) => {
            const ls = index.lessons.filter((l) => l.levelId === lv.id);
            const n = ls.filter((l) => done.has(l.id)).length;
            const cert = certs.find((c) => c.level_id === lv.id && !c.revoked_at);
            return (
              <li key={lv.id} className="rounded-xl border border-line bg-white p-4" data-level-progress={lv.id}>
                <p className="font-bold">{lv.title}</p>
                <p className="text-sm text-muted">{ls.length ? `${arDigits(n)} من ${arDigits(ls.length)} درسًا مكتملًا` : "لا توجد دروس منشورة بعد"}</p>
                {ls.length > 0 && <div className="mt-2 h-2 rounded bg-line"><div className="h-2 rounded bg-brand-600" style={{ width: `${Math.round((n / ls.length) * 100)}%` }} /></div>}
                {cert ? <a href={shellHref("certificates", cert.id)} className="tap mt-2 inline-flex items-center text-sm text-brand-700 underline">عرض شهادة الإتمام</a>
                  : ls.length > 0 && n === ls.length && <button type="button" onClick={() => void issue(lv.id)} className="tap mt-2 rounded-lg border border-brand-500 px-3 text-sm text-brand-700">طلب شهادة إتمام المستوى</button>}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">شهادات المنصة شهادات إتمام مستوى تعليمي وليست إجازة قرآنية. تتطلب إكمال كل دروس المستوى المنشورة واجتياز اختباره النهائي.</p>
      </section>

      {recs.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">دروس ننصحك بمراجعتها</h2>
          <ul className="space-y-2">
            {recs.map((r) => {
              const l = index.lessons.find((x) => x.id === r.lesson_id);
              return <li key={r.lesson_id} className="rounded-lg border border-line bg-white p-3 text-sm">{l ? <a href={l.href} className="font-bold text-brand-700 underline">{r.lesson_title}</a> : r.lesson_title} — دقتك {arDigits(Math.round(r.accuracy * 100))}٪</li>;
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">سجل الاختبارات</h2>
        {attempts.length === 0 ? <p className="text-sm text-muted">لا توجد محاولات بعد.</p> : (
          <ul className="space-y-2" data-attempt-history>
            {attempts.map((a) => (
              <li key={a.attempt_id}>
                <a href={shellHref("attempts", a.attempt_id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3 text-sm hover:border-brand-500">
                  <span><b>{a.exam_title}</b> <span className="text-muted">— {fmt.format(new Date(a.started_at))}</span></span>
                  <span>{a.status === "in_progress" ? "قيد الإجابة" : a.total_score !== null ? `${arDigits(Number(a.total_score))} / ${arDigits(Number(a.max_score))}${a.passed ? " ✓" : ""}` : "بانتظار النتيجة"}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">الملف الشخصي</h2>
        {profile && (
          <form onSubmit={saveProfile} className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
            <label className="text-sm">الاسم الكامل (للشهادة)<input name="full_name" defaultValue={profile.full_name} maxLength={200} className="tap mt-1 w-full rounded-lg border border-line px-3" /></label>
            <label className="text-sm">اسم العرض<input name="display_name" defaultValue={profile.display_name ?? ""} maxLength={100} className="tap mt-1 w-full rounded-lg border border-line px-3" /></label>
            <p className="text-xs text-muted sm:col-span-2">{session.user.email}</p>
            <button className="tap rounded-lg bg-brand-700 px-4 text-white sm:w-fit">حفظ</button>
          </form>
        )}
      </section>
    </div>
  );
}
