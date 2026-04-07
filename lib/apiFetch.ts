export async function apiGetJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("API GET failed");
  }

  return res.json();
}

export async function apiPostJson<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    throw new Error("API POST failed");
  }

  return res.json();
}
