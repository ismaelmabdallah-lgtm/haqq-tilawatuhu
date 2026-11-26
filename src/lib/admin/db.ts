"use client";
/**
 * Dynamic-table access for the generic admin pages (table names come from the
 * entity configs). Every call still goes through RLS with the user's session.
 */
import { getBrowserClient } from "@/lib/supabase/client";

type Res<T> = { data: T | null; error: { code?: string; message: string } | null };
// Minimal, loosely-typed query surface used by the generic editor.
export interface LooseQuery<T = Record<string, unknown>> extends PromiseLike<Res<T[]>> {
  select(cols?: string): LooseQuery<T>;
  eq(col: string, v: unknown): LooseQuery<T>;
  neq(col: string, v: unknown): LooseQuery<T>;
  in(col: string, v: unknown[]): LooseQuery<T>;
  order(col: string, o?: { ascending?: boolean }): LooseQuery<T>;
  limit(n: number): LooseQuery<T>;
  insert(row: Record<string, unknown> | Record<string, unknown>[]): LooseQuery<T>;
  update(row: Record<string, unknown>): LooseQuery<T>;
  delete(): LooseQuery<T>;
  single(): PromiseLike<Res<T>>;
  maybeSingle(): PromiseLike<Res<T>>;
}

export function table<T = Record<string, unknown>>(name: string): LooseQuery<T> {
  return (getBrowserClient() as unknown as { from: (t: string) => LooseQuery<T> }).from(name);
}

/** Calls a Pages Function with the user's access token (Postgres decides authorization). */
export async function callFunction(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await getBrowserClient().auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("authorization", `Bearer ${data.session.access_token}`);
  return fetch(path, { ...init, headers });
}
