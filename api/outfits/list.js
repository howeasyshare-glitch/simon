// api/outfits/list.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: "Supabase env not set" });
    }

    // 需要 Bearer token（由前端 sb.auth.getSession() 取得）
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    // 1) 用 token 取得 user
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userText = await userResp.text();
    if (!userResp.ok) {
      return res.status(401).json({ error: "Invalid token", detail: userText });
    }
    const user = JSON.parse(userText);
    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Invalid user payload" });
    }

    // 2) 分頁參數
    const limit = Math.min(parseInt(req.query.limit || "24", 10) || 24, 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

    // 3) 查詢此 user 的 outfits（只取列表需要欄位）
    const url =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&select=id,created_at,is_public,share_slug,image_path,style,summary` +
      `&order=created_at.desc` +
      `&limit=${limit}&offset=${offset}`;

    const r = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Accept: "application/json",
      },
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(500).json({ error: "Query failed", status: r.status, detail: text });
    }

    const rows = JSON.parse(text);

    // 4) 組出圖片 public URL（bucket: outfits）
    const items = rows.map((row) => ({
      ...row,
      image_url: row.image_path
        ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
        : "",
    }));

    return res.status(200).json({ ok: true, items, limit, offset });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
