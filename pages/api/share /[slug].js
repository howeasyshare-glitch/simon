
// api/share/[slug].js
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: "Supabase env not set" });
    }

    const slug = String(req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    // 只允許公開分享的 row 被讀到
    const url =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?share_slug=eq.${encodeURIComponent(slug)}` +
      `&is_public=eq.true` +
      `&select=id,created_at,spec,style,summary,products,image_path,share_slug`;

    const resp = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Accept: "application/json",
      },
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(500).json({
        error: "Query failed",
        status: resp.status,
        detail: text,
      });
    }

    const rows = JSON.parse(text);
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: "Not found" });

    // ✅ public bucket 圖片 URL 一定要含 /public/
    const imageUrl = row.image_path
      ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
      : "";

    return res.status(200).json({
      ok: true,
      outfit: { ...row, image_url: imageUrl },
    });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
