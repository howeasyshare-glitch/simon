// api/outfits.js
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: "Supabase env not set" });
    }

    // op = list | create | update | delete
    const op = String(req.query.op || "").toLowerCase();
    if (!op) return res.status(400).json({ error: "Missing op" });

    // bearer token（我的穿搭相關都需要登入）
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) return res.status(401).json({ error: "Missing bearer token" });

    // 用 token 取 user
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
    });
    const userText = await userResp.text();
    if (!userResp.ok) return res.status(401).json({ error: "Invalid token", detail: userText });
    const user = JSON.parse(userText);
    const userId = user?.id;
    if (!userId) return res.status(401).json({ error: "Invalid user payload" });

    // helper: DB fetch
    async function dbFetch(url, init = {}) {
      const r = await fetch(url, {
        ...init,
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Accept: "application/json",
          ...(init.headers || {}),
        },
      });
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    }

    // ===== LIST =====
    if (op === "list") {
      const limit = Math.min(parseInt(req.query.limit || "24", 10) || 24, 100);
      const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

      const url =
        `${SUPABASE_URL}/rest/v1/outfits` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&select=id,created_at,is_public,share_slug,image_path,style,summary` +
        `&order=created_at.desc` +
        `&limit=${limit}&offset=${offset}`;

      const r = await dbFetch(url);
      if (!r.ok) return res.status(500).json({ error: "Query failed", status: r.status, detail: r.text });
      const rows = JSON.parse(r.text);

      const items = rows.map((row) => ({
        ...row,
        image_url: row.image_path
          ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
          : "",
      }));

      return res.status(200).json({ ok: true, items, limit, offset });
    }

    // ===== CREATE =====
    if (op === "create") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const body = req.body || {};
      // 你可以依你 DB 欄位調整，這裡只示範常見欄位
      const payload = {
        user_id: userId,
        image_path: body.image_path || null,
        is_public: Boolean(body.is_public || false),
        share_slug: body.share_slug || null,
        style: body.style || null,
        spec: body.spec || null,
        summary: body.summary || null,
        products: body.products || null,
      };

      const url = `${SUPABASE_URL}/rest/v1/outfits?select=id,created_at,is_public,share_slug,image_path`;
      const r = await dbFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) return res.status(500).json({ error: "Create failed", status: r.status, detail: r.text });
      const item = JSON.parse(r.text)?.[0];
      return res.status(200).json({ ok: true, item });
    }

    // ===== UPDATE / DELETE needs id =====
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing id" });

    // 先抓這筆，驗 owner
    const getUrl =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=id,user_id,image_path,is_public,share_slug` +
      `&limit=1`;

    const got = await dbFetch(getUrl);
    if (!got.ok) return res.status(500).json({ error: "Fetch failed", status: got.status, detail: got.text });
    const row = JSON.parse(got.text)?.[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

    // ===== UPDATE =====
    if (op === "update") {
      if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

      const body = req.body || {};
      const patch = {};
      if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
      if (typeof body.share_slug === "string") patch.share_slug = body.share_slug;
      // 之後要做收藏可加：if (typeof body.is_favorite==="boolean") patch.is_favorite = body.is_favorite;

      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nothing to update" });

      const updUrl =
        `${SUPABASE_URL}/rest/v1/outfits` +
        `?id=eq.${encodeURIComponent(id)}` +
        `&select=id,is_public,share_slug,image_path,created_at`;

      const r = await dbFetch(updUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });

      if (!r.ok) return res.status(500).json({ error: "Update failed", status: r.status, detail: r.text });
      const item = JSON.parse(r.text)?.[0];
      return res.status(200).json({ ok: true, item });
    }

    // ===== DELETE =====
    if (op === "delete") {
      if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

      // 刪 storage（失敗也繼續刪 DB）
      if (row.image_path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/outfits/${encodeURIComponent(row.image_path)}`, {
          method: "DELETE",
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        });
      }

      const delUrl = `${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(id)}`;
      const r = await dbFetch(delUrl, { method: "DELETE" });
      if (!r.ok) return res.status(500).json({ error: "Delete failed", status: r.status, detail: r.text });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown op" });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
