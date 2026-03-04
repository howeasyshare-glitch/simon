// pages/api/outfits.js

function randSlug(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

async function getUserFromSupabase({ supabaseUrl, serviceKey, accessToken }) {
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
  });
  const text = await resp.text();
  if (!resp.ok) return { ok: false, detail: text };
  try {
    return { ok: true, user: JSON.parse(text) };
  } catch {
    return { ok: false, detail: text };
  }
}

function getEnv(res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({
      error: "Supabase env not set",
      missing: { SUPABASE_URL: !SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: !SERVICE_KEY },
    });
    return null;
  }
  return { SUPABASE_URL, SERVICE_KEY };
}

async function restFetch({ SUPABASE_URL, SERVICE_KEY, path, method = "GET", body }) {
  const resp = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: resp.ok, status: resp.status, json, text };
}

export default async function handler(req, res) {
  const env = getEnv(res);
  if (!env) return;
  const { SUPABASE_URL, SERVICE_KEY } = env;

  const { op } = req.query;

  // ---- auth for all ops below ----
  const auth = req.headers.authorization || "";
  const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!accessToken) return res.status(401).json({ error: "Missing bearer token" });

  const userRes = await getUserFromSupabase({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, accessToken });
  if (!userRes.ok) return res.status(401).json({ error: "Invalid token", detail: userRes.detail });

  const userId = userRes.user?.id;
  if (!userId) return res.status(401).json({ error: "Invalid user" });

  try {
    // =========================
    // CREATE (private)
    // POST /api/outfits?op=create
    // =========================
    if (req.method === "POST" && op === "create") {
      const b = req.body || {};
      const row = {
        user_id: userId,
        created_at: new Date().toISOString(),
        image_url: b.image_url ?? null,
        image_bucket: b.image_bucket ?? null,
        image_path: b.image_path ?? null,
        style: b.style ?? null,
        spec: b.spec ?? null,
        summary: b.summary ?? "",
        products: b.products ?? null,
        is_public: false,
        share_slug: null,
        like_count: 0,
        share_count: 0,
        apply_count: 0,
      };

      const r = await restFetch({
        SUPABASE_URL,
        SERVICE_KEY,
        path: "/rest/v1/outfits",
        method: "POST",
        body: row,
      });

      if (!r.ok) return res.status(500).json({ error: "create failed", status: r.status, detail: r.text });
      return res.status(200).json({ ok: true, item: Array.isArray(r.json) ? r.json[0] : r.json });
    }

    // =========================
    // PUBLISH (share)
    // POST /api/outfits?op=publish&id=...
    // =========================
    if (req.method === "POST" && op === "publish") {
      const id = String(req.query.id || "");
      if (!id) return res.status(400).json({ error: "Missing id" });

      // 先查這筆是不是你的
      const q = await restFetch({
        SUPABASE_URL,
        SERVICE_KEY,
        path: `/rest/v1/outfits?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=id,share_slug,is_public`,
      });
      if (!q.ok) return res.status(500).json({ error: "query failed", detail: q.text });
      const row = (q.json && q.json[0]) || null;
      if (!row) return res.status(404).json({ error: "Not found" });

      const shareSlug = row.share_slug || randSlug(12);

      const upd = await restFetch({
        SUPABASE_URL,
        SERVICE_KEY,
        path: `/rest/v1/outfits?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
        method: "PATCH",
        body: { is_public: true, share_slug: shareSlug },
      });
      if (!upd.ok) return res.status(500).json({ error: "publish failed", detail: upd.text });

      return res.status(200).json({
        ok: true,
        outfit_id: id,
        share_slug: shareSlug,
        share_url: `/share/${shareSlug}`,
      });
    }

    // =========================
    // UPDATE products
    // POST /api/outfits?op=update&id=...
    // =========================
    if (req.method === "POST" && op === "update") {
      const id = String(req.query.id || "");
      if (!id) return res.status(400).json({ error: "Missing id" });

      const b = req.body || {};
      const patch = {};
      if (b.products !== undefined) patch.products = b.products;

      if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });

      const upd = await restFetch({
        SUPABASE_URL,
        SERVICE_KEY,
        path: `/rest/v1/outfits?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
        method: "PATCH",
        body: patch,
      });
      if (!upd.ok) return res.status(500).json({ error: "update failed", detail: upd.text });

      return res.status(200).json({ ok: true, item: Array.isArray(upd.json) ? upd.json[0] : upd.json });
    }

    // =========================
    // RECENT 10 (private)
    // GET /api/outfits?op=recent&limit=10
    // =========================
    if (req.method === "GET" && op === "recent") {
      const limit = Math.min(parseInt(req.query.limit || "10", 10) || 10, 50);

      const r = await restFetch({
        SUPABASE_URL,
        SERVICE_KEY,
        path:
          `/rest/v1/outfits?user_id=eq.${encodeURIComponent(userId)}` +
          `&select=id,created_at,image_path,share_slug,is_public,summary,products,style,spec` +
          `&order=created_at.desc&limit=${limit}`,
      });

      if (!r.ok) return res.status(500).json({ error: "recent failed", detail: r.text });

      const items = (r.json || []).map((row) => ({
        ...row,
        image_url: row.image_path ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}` : "",
        share_url: row.share_slug ? `/share/${row.share_slug}` : "",
      }));

      return res.status(200).json({ ok: true, items });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Outfits API crashed", detail: String(e?.message || e) });
  }
}
