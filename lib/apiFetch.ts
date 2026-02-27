import { supabaseBrowser } from "./supabaseBrowser";

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("debug") === "1") return true;
  } catch {}
  try {
    return localStorage.getItem("DEBUG_API") === "1";
  } catch {}
  return false;
}

async function getAccessTokenWithRetry(): Promise<string> {
  const { data } = await supabaseBrowser.auth.getSession();
  let token = data?.session?.access_token || "";

  // ✅ 處理剛 OAuth 回來的競態：等一下再拿一次
  if (!token) {
    await new Promise((r) => setTimeout(r, 200));
    const r2 = await supabaseBrowser.auth.getSession();
    token = r2.data?.session?.access_token || "";
  }

  return token;
}

/**
 * 自動帶 Bearer token 的 fetch（只要 browser session 存在）
 */
export async function apiFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  // ✅ 不要覆蓋呼叫端自己給的 Content-Type
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const token = await getAccessTokenWithRetry();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const debug = isDebugEnabled();
  if (debug) {
    console.log("[apiFetch]", {
      url,
      hasToken: !!token,
      method: init.method || "GET",
    });
  }

  const r = await fetch(url, {
    ...init,
    headers,
    // ✅ 同站 API 建議帶上（不影響 Supabase）
    credentials: init.credentials ?? "same-origin",
  });

  if (debug) {
    console.log("[apiFetch] response", { url, status: r.status });
  }

  return r;
}

export async function apiGetJson<T>(url: string): Promise<T> {
  const r = await apiFetch(url, { method: "GET" });
  const text = await r.text();

  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {}

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
  try {
    j = JSON.parse(text);
  } catch {}

  if (!r.ok) throw new Error(j?.error || j?.message || text || `HTTP ${r.status}`);
  return j as T;
}
