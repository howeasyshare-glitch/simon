import { supabase } from "../lib/supabase/client";

type HeaderMap = Record<string, string>;

async function buildAuthHeaders(extraHeaders: HeaderMap = {}): Promise<HeaderMap> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: HeaderMap = {
    ...extraHeaders,
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

export async function apiGetJson<T = any>(url: string): Promise<T> {
  const headers = await buildAuthHeaders();

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers,
  });

  const text = await res.text();
  let data: T | any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}

  if (!res.ok) {
    throw new Error((data as any)?.error || "API GET failed");
  }

  return data as T;
}

export async function apiPostJson<T = any>(url: string, body: any = {}): Promise<T> {
  const headers = await buildAuthHeaders({
    "Content-Type": "application/json",
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: T | any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}

  if (!res.ok) {
    throw new Error((data as any)?.error || "API POST failed");
  }

  return data as T;
}
