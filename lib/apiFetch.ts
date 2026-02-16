// lib/apiFetch.ts
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export async function apiFetch(url: string, init?: RequestInit) {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const r = await fetch(url, {
    ...init,
    headers,
  });

  return r;
}

export async function apiGetJson<T>(url: string): Promise<T> {
  const r = await apiFetch(url, { method: "GET" });
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(j?.error || j?.message || text || `HTTP ${r.status}`);
  return j as T;
}

export async function apiPostJson<T>(url: string, body: any): Promise<T> {
  const r = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(j?.error || j?.message || text || `HTTP ${r.status}`);
  return j as T;
}
