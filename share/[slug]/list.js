export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: "Supabase env not set" });

    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) return res.status(401).json({ error: "Missing bearer token" });

    // 取得登入者
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: SERVICE_ROLE },
    });
    const userText = await userResp.text();
    if (!userResp.ok) return res.status(401).json({ error: "Invalid token", detail: userText });
    const user = JSON.parse(userText);
    const userId = user?.id;
    if (!userId) return res.status(401).json({ error: "Invalid user payload" });

    // 分頁
    const limit = Math.min(parseInt(req.query.limit || "24", 10) || 24, 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

    // 查詢（只拿列表需要的欄位）
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
    if (!r.ok) return res.status(500).json({ error: "Query failed", status: r.status, detail: text });

    const rows = JSON.parse(text);

    // 拼出公開圖片 URL（bucket: outfits）
    const mapped = rows.map((row) => ({
      ...row,
      image_url: row.image_path
        ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
        : "",
      share_url: row.share_slug ? `/share/${row.share_slug}` : "",
    }));

    return res.status(200).json({ ok: true, items: mapped, limit, offset });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
