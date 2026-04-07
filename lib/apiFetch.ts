import { supabase } from "./supabase/client";

async function buildAuthHeaders(extraHeaders = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    ...extraHeaders,
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

export async function apiGetJson(url) {
  const headers = await buildAuthHeaders();

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}

  if (!res.ok) {
    throw new Error(data?.error || "API GET failed");
  }

  return data;
}

export async function apiPostJson(url, body = {}) {
  const headers = await buildAuthHeaders({
    "Content-Type": "application/json",
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}

  if (!res.ok) {
    throw new Error(data?.error || "API POST failed");
  }

  return data;
}
