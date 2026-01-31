// api/outfits/[id].js
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: "Supabase env not set" });
    }

    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) return res.status(401).json({ error: "Missing bearer token" });

    // 取得登入者
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
    });
    const userText = await userResp.text();
    if (!userResp.ok) return res.status(401).json({ error: "Invalid token", detail: userText });
    const user = JSON.parse(userText);
    const userId = user?.id;
    if (!userId) return res.status(401).json({ error: "Invalid user payload" });

    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing id" });

    // 先抓這筆，確認擁有者並拿 image_path
    const getUrl =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=id,user_id,image_path,is_public` +
      `&limit=1`;

    const getResp = await fetch(getUrl, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, Accept: "application/json" },
    });
    const getText = await getResp.text();
    if (!getResp.ok) return res.status(500).json({ error: "Fetch failed", detail: getText });
    const row = JSON.parse(getText)?.[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

    if (req.method === "PATCH") {
      const body = req.body || {};
      const patch = {};
      if (typeof body.is_public === "boolean") patch.is_public = body.is_public;

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "Nothing to update" });
      }

      const updUrl =
        `${SUPABASE_URL}/rest/v1/outfits` +
        `?id=eq.${encodeURIComponent(id)}` +
        `&select=id,is_public,share_slug,image_path,created_at`;

      const updResp = await fetch(updUrl, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(patch),
      });

      const updText = await updResp.text();
      if (!updResp.ok) return res.status(500).json({ error: "Update failed", detail: updText });
      const updated = JSON.parse(updText)?.[0];
      return res.status(200).json({ ok: true, item: updated });
    }

    if (req.method === "DELETE") {
      // 先刪 Storage（即使失敗也繼續刪 DB）
      if (row.image_path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/outfits/${encodeURIComponent(row.image_path)}`, {
          method: "DELETE",
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        });
      }

      const delResp = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
      });

      const delText = await delResp.text();
      if (!delResp.ok) return res.status(500).json({ error: "Delete failed", detail: delText });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
