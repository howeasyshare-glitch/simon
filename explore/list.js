// api/explore/list.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: "Supabase env not set" });

    // public list: allow CDN caching briefly
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");

    const limit = Math.min(parseInt(req.query.limit || "30", 10) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

    // sort=like (default) | new
    const sort = String(req.query.sort || "like").toLowerCase();

    const base =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?is_public=eq.true` +
      `&share_slug=not.is.null`;

    // New schema (Phase 1+): includes counters
    const selectV2 = `id,created_at,share_slug,image_path,style,spec,summary,like_count,share_count,apply_count`;
    const selectV1 = `id,created_at,share_slug,image_path,style,spec,summary`;

    const orderLike = `&order=like_count.desc,created_at.desc`;
    const orderNew = `&order=created_at.desc`;

    function buildUrl({ v2, forceNewOrder } = {}) {
      const select = v2 ? selectV2 : selectV1;
      const order =
        forceNewOrder
          ? orderNew
          : (sort === "new" ? orderNew : orderLike); // default like
      return (
        base +
        `&select=${encodeURIComponent(select)}` +
        order +
        `&limit=${limit}&offset=${offset}`
      );
    }

    async function fetchRows(url) {
      const r = await fetch(url, {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Accept: "application/json",
        },
      });
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    }

    // 1) Try V2 (with counters) + desired order (like/new)
    let used = { schema: "v2", sort: sort === "new" ? "new" : "like" };
    let r = await fetchRows(buildUrl({ v2: true, forceNewOrder: false }));

    // If DB doesn't have like_count/share_count/apply_count yet,
    // PostgREST often returns 400 with "column ... does not exist".
    // Then fallback to V1 select and created_at sorting.
    if (!r.ok) {
      const t = (r.text || "").toLowerCase();
      const looksLikeMissingCols =
        r.status === 400 &&
        (t.includes("does not exist") || t.includes("column") || t.includes("like_count") || t.includes("share_count") || t.includes("apply_count"));

      if (looksLikeMissingCols) {
        used = { schema: "v1", sort: "new" }; // fallback uses created_at desc
        r = await fetchRows(buildUrl({ v2: false, forceNewOrder: true }));
      }
    }

    if (!r.ok) return res.status(500).json({ error: "Query failed", status: r.status, detail: r.text });

    const rows = JSON.parse(r.text || "[]");

    const items = rows.map((row) => ({
      ...row,
      // counters: ensure numbers exist even on v1 schema
      like_count: typeof row.like_count === "number" ? row.like_count : 0,
      share_count: typeof row.share_count === "number" ? row.share_count : 0,
      apply_count: typeof row.apply_count === "number" ? row.apply_count : 0,

      image_url: row.image_path
        ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
        : "",
      share_url: row.share_slug ? `/share/${row.share_slug}` : "",
    }));

    return res.status(200).json({
      ok: true,
      items,
      limit,
      offset,
      sort_requested: sort,
      sort_used: used.sort,
      schema_used: used.schema,
    });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
