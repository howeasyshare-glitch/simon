// pages/api/outfits.js
// ops:
// - list (GET)            : 我的穿搭（需要登入）
// - favorites (GET)       : 我的最愛（需要登入）
// - create (POST)         : 建立一筆 outfit（需要登入）
// - update (POST/PATCH)   : 更新一筆 outfit（需要登入 + owner）
// - delete (DELETE)       : 刪除一筆 outfit（需要登入 + owner）

function json(res, code, body) {
  return res.status(code).json(body);
}

function base64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeSlug() {
  // 10~12 chars 的短 slug
  const crypto = require("crypto");
  return base64Url(crypto.randomBytes(9));
}

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(res, 500, { error: "Supabase env not set" });
    }

    const op = String(req.query.op || "").toLowerCase();
    if (!op) return json(res, 400, { error: "Missing op" });

    // ====== Auth (all ops in this file require login) ======
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) return json(res, 401, { error: "Missing bearer token" });

    // verify token -> user
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
    });
    const userText = await userResp.text();
    if (!userResp.ok) return json(res, 401, { error: "Invalid token", detail: userText });

    const user = JSON.parse(userText);
    const userId = user?.id;
    if (!userId) return json(res, 401, { error: "Invalid user payload" });

    // helper: DB fetch with service role
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

    function toRowWithUrls(row) {
      return {
        ...row,
        image_url: row?.image_path
          ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
          : "",
        share_url: row?.share_slug ? `/share/${row.share_slug}` : "",
      };
    }

    // ===== LIST (my recent) =====
    if (op === "list") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

      const limit = Math.min(parseInt(req.query.limit || "24", 10) || 24, 100);
      const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

      const url =
        `${SUPABASE_URL}/rest/v1/outfits` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&select=id,created_at,is_public,share_slug,image_path,style,summary,products,spec` +
        `&order=created_at.desc` +
        `&limit=${limit}&offset=${offset}`;

      const r = await dbFetch(url);
      if (!r.ok) return json(res, 500, { error: "Query failed", status: r.status, detail: r.text });

      const rows = JSON.parse(r.text || "[]");
      return json(res, 200, { ok: true, items: rows.map(toRowWithUrls), limit, offset });
    }

    // ===== FAVORITES =====
    // 支援兩種 schema：
    // A) outfits 有 boolean 欄位 is_favorite
    // B) 有 join table outfit_favorites(user_id, outfit_id)
    if (op === "favorites") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

      const limit = Math.min(parseInt(req.query.limit || "10", 10) || 10, 50);

      // 先試 A) outfits.is_favorite
      {
        const urlA =
          `${SUPABASE_URL}/rest/v1/outfits` +
          `?user_id=eq.${encodeURIComponent(userId)}` +
          `&is_favorite=eq.true` +
          `&select=id,created_at,is_public,share_slug,image_path,style,summary,products,spec` +
          `&order=created_at.desc` +
          `&limit=${limit}`;

        const rA = await dbFetch(urlA);
        if (rA.ok) {
          const rowsA = JSON.parse(rA.text || "[]");
          return json(res, 200, { ok: true, items: rowsA.map(toRowWithUrls), limit });
        }
      }

      // 再試 B) join table outfit_favorites
      {
        const urlB =
          `${SUPABASE_URL}/rest/v1/outfit_favorites` +
          `?user_id=eq.${encodeURIComponent(userId)}` +
          `&select=outfit:outfits(id,created_at,is_public,share_slug,image_path,style,summary,products,spec)` +
          `&order=created_at.desc` +
          `&limit=${limit}`;

        const rB = await dbFetch(urlB);
        if (!rB.ok) {
          return json(res, 500, {
            error: "Favorites not supported by DB schema",
            detail: rB.text,
            hint: "Need outfits.is_favorite OR outfit_favorites(user_id,outfit_id).",
          });
        }

        const rowsB = JSON.parse(rB.text || "[]");
        const items = rowsB.map((x) => x.outfit).filter(Boolean).map(toRowWithUrls);
        return json(res, 200, { ok: true, items, limit });
      }
    }

    // ===== CREATE =====
    if (op === "create") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

      const body = req.body || {};
      const share_slug = String(body.share_slug || "").trim() || makeSlug();

      // 你 DB 可能有 not-null 欄位（例如 is_public / image_path），這裡保守處理
      const payload = {
        user_id: userId,
        image_path: body.image_path || null,
        is_public: typeof body.is_public === "boolean" ? body.is_public : true, // 生成後預設公開，才會進 explore
        share_slug,
        style: body.style || null,
        spec: body.spec || null,
        summary: body.summary || null,
        products: body.products || null,
      };

      const url =
        `${SUPABASE_URL}/rest/v1/outfits` +
        `?select=id,created_at,is_public,share_slug,image_path`;

      const r = await dbFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        return json(res, 500, { error: "Create failed", status: r.status, detail: r.text, payload });
      }

      const item = JSON.parse(r.text || "[]")?.[0];
      return json(res, 200, { ok: true, item: toRowWithUrls(item) });
    }

    // ===== UPDATE / DELETE need id & owner =====
    const id = String(req.query.id || "").trim();
    if (!id) return json(res, 400, { error: "Missing id" });

    // fetch row to verify owner
    const getUrl =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=id,user_id,image_path,is_public,share_slug` +
      `&limit=1`;

    const got = await dbFetch(getUrl);
    if (!got.ok) return json(res, 500, { error: "Fetch failed", status: got.status, detail: got.text });

    const row = JSON.parse(got.text || "[]")?.[0];
    if (!row) return json(res, 404, { error: "Not found" });
    if (row.user_id !== userId) return json(res, 403, { error: "Forbidden" });

    // ===== UPDATE =====
    if (op === "update") {
      // ✅ 你前端現在用 POST，這裡允許 POST/PATCH 兩種
      if (!["POST", "PATCH"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });

      const body = req.body || {};
      const patch = {};

      // 允許更新 products / summary / spec / style / is_public / share_slug
      if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
      if (typeof body.share_slug === "string") patch.share_slug = body.share_slug;
      if (body.products !== undefined) patch.products = body.products;
      if (body.summary !== undefined) patch.summary = body.summary;
      if (body.spec !== undefined) patch.spec = body.spec;
      if (body.style !== undefined) patch.style = body.style;

      if (Object.keys(patch).length === 0) return json(res, 400, { error: "Nothing to update" });

      const updUrl =
        `${SUPABASE_URL}/rest/v1/outfits` +
        `?id=eq.${encodeURIComponent(id)}` +
        `&select=id,is_public,share_slug,image_path,created_at,products,summary,style`;

      const r = await dbFetch(updUrl, {
        method: "PATCH", // 對 Supabase 一律用 PATCH
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });

      if (!r.ok) return json(res, 500, { error: "Update failed", status: r.status, detail: r.text });

      const item = JSON.parse(r.text || "[]")?.[0];
      return json(res, 200, { ok: true, item: toRowWithUrls(item) });
    }

    // ===== DELETE =====
    if (op === "delete") {
      if (req.method !== "DELETE") return json(res, 405, { error: "Method not allowed" });

      // delete storage (best-effort)
      if (row.image_path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/outfits/${encodeURIComponent(row.image_path)}`, {
          method: "DELETE",
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        }).catch(() => {});
      }

      const delUrl = `${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(id)}`;
      const r = await dbFetch(delUrl, { method: "DELETE" });
      if (!r.ok) return json(res, 500, { error: "Delete failed", status: r.status, detail: r.text });

      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: "Unknown op" });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e?.message || e) });
  }
}
