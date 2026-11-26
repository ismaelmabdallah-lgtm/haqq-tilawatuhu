/**
 * TEST-ONLY session helpers: an unsigned JWT the PGlite stand-in understands,
 * stored under the app's fixed auth key so supabase-js treats the user as
 * signed in without contacting any auth server.
 */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

export const TEST_USERS = {
  super: { id: "00000000-0000-4000-a000-000000000001", email: "super@test.local", name: "مدير عام تجريبي", roles: ["super_admin"] },
  reviewAdmin: { id: "00000000-0000-4000-a000-000000000002", email: "ra@test.local", name: "مدير مراجعة تجريبي", roles: ["scientific_review_admin"] },
  reviewer: { id: "00000000-0000-4000-a000-000000000003", email: "rev@test.local", name: "مراجع تجريبي", roles: ["scientific_reviewer"] },
  editor: { id: "00000000-0000-4000-a000-000000000004", email: "ed@test.local", name: "محرر تجريبي", roles: ["content_editor"] },
  grader: { id: "00000000-0000-4000-a000-000000000005", email: "gr@test.local", name: "مصحح تجريبي", roles: ["grader"] },
  learner: { id: "00000000-0000-4000-a000-000000000006", email: "learner@test.local", name: "متعلم تجريبي", roles: [] },
};

export function usersSql() {
  return Object.values(TEST_USERS).map((u) =>
    `insert into auth.users (id, email, raw_user_meta_data) values ('${u.id}', '${u.email}', '${JSON.stringify({ full_name: u.name })}');\n` +
    u.roles.map((r) => `insert into public.platform_role_assignments (user_id, role) values ('${u.id}', '${r}');\n`).join("")).join("");
}

export function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: user.id, role: "authenticated", aud: "authenticated", email: user.email, exp: now + 86400 })}.test`;
  return {
    access_token, token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "test-refresh",
    user: { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, app_metadata: {}, user_metadata: { full_name: user.name }, created_at: new Date().toISOString() },
  };
}
