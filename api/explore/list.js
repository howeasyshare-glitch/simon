// api/explore/list.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: "Supabase env not set" });

    const limit = Math.min(parseInt(req.query.limit || "30", 10) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

    // Only public + has share_slug so it can be opened
    const url =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?is_public=eq.true` +
      `&share_slug=not.is.null` +
      `&select=id,created_at,share_slug,image_path,style,spec,summary` +
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

    const items = rows.map((row) => ({
      ...row,
      image_url: row.image_path
        ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
        : "",
      share_url: row.share_slug ? `/share/${row.share_slug}` : "",
    }));

    return res.status(200).json({ ok: true, items, limit, offset });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
