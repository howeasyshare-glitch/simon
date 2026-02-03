// api/explore/list.js
// GET  /explore/list?limit=30&offset=0&sort=like
// POST /explore/list?action=like|share|apply  { outfit_id, toggle?: true, anon_id?: "..." }  (Authorization optional)

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: "Supabase env not set" });

    const safeParse = (text, fallback) => {
      if (text == null) return fallback;
      const t = String(text);
      if (!t.trim()) return fallback;
      try { return JSON.parse(t); } catch { return fallback; }
    };

    if (req.method === "POST" && typeof req.body === "string") {
      try { req.body = JSON.parse(req.body); } catch {}
    }

    if (req.method === "POST") {
      const action = String(req.query.action || req.body?.action || "").toLowerCase();
      const outfit_id = String(req.body?.outfit_id || req.query.outfit_id || "").trim();
      const anon_id = String(req.body?.anon_id || req.headers["x-anon-id"] || "").trim();
      const toggle = Boolean(req.body?.toggle);

      if (!action) return res.status(400).json({ error: "Missing action" });
      if (!outfit_id) return res.status(400).json({ error: "Missing outfit_id" });

      const auth = String(req.headers.authorization || "");
      const m = auth.match(/^Bearer\s+(.+)$/i);
      const accessToken = m?.[1] || "";
      let userId = null;

      if (accessToken) {
        try {
          const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
          });
          if (u.ok) {
            const uj = await u.json().catch(() => ({}));
            userId = uj?.id || null;
          }
        } catch (_) {}
      }

      async function inc(field, delta) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_outfit_counter`, {
          method: "POST",
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ p_outfit_id: outfit_id, p_field: field, p_delta: delta }),
        });
        const text = await r.text(); // might be empty
        return { ok: r.ok, status: r.status, text };
      }

      async function db(url, init = {}) {
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

      if (action === "share" || action === "apply") {
        const field = action === "share" ? "share_count" : "apply_count";
        const out = await inc(field, +1);
        if (!out.ok) return res.status(500).json({ error: "Counter update failed", status: out.status, detail: out.text });

        const arr = safeParse(out.text, []);
        const row = Array.isArray(arr) ? (arr[0] || null) : arr;

        return res.status(200).json({ ok: true, action, outfit_id, counts: row });
      }

      if (action === "like") {
        const canDedup = Boolean(userId || anon_id);

        if (!toggle || !canDedup) {
          const out = await inc("like_count", +1);
          if (!out.ok) return res.status(500).json({ error: "Counter update failed", status: out.status, detail: out.text });

          const arr = safeParse(out.text, []);
          const row = Array.isArray(arr) ? (arr[0] || null) : arr;

          return res.status(200).json({ ok: true, action: "like", toggled: false, outfit_id, counts: row });
        }

        const where = userId
          ? `outfit_id=eq.${encodeURIComponent(outfit_id)}&user_id=eq.${encodeURIComponent(userId)}`
          : `outfit_id=eq.${encodeURIComponent(outfit_id)}&anon_id=eq.${encodeURIComponent(anon_id)}&user_id=is.null`;

        const q = await db(`${SUPABASE_URL}/rest/v1/outfit_likes?select=id&${where}&limit=1`);
        if (!q.ok) return res.status(500).json({ error: "Like lookup failed", status: q.status, detail: q.text });

        const qArr = safeParse(q.text, []);
        const exists = Array.isArray(qArr) && qArr.length > 0;

        if (exists) {
          const del = await db(`${SUPABASE_URL}/rest/v1/outfit_likes?${where}`, { method: "DELETE" });
          if (!del.ok) return res.status(500).json({ error: "Unlike failed", status: del.status, detail: del.text });

          const out = await inc("like_count", -1);
          if (!out.ok) return res.status(500).json({ error: "Counter update failed", status: out.status, detail: out.text });

          const arr = safeParse(out.text, []);
          const row = Array.isArray(arr) ? (arr[0] || null) : arr;

          return res.status(200).json({ ok: true, action: "like", toggled: true, liked: false, outfit_id, counts: row });
        }

        const payload = { outfit_id, user_id: userId, anon_id: userId ? null : (anon_id || null) };
        const ins = await db(`${SUPABASE_URL}/rest/v1/outfit_likes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });

        if (!ins.ok) {
          const t = String(ins.text || "").toLowerCase();
          const isDup = ins.status === 409 || t.includes("duplicate") || t.includes("unique");
          if (!isDup) return res.status(500).json({ error: "Like insert failed", status: ins.status, detail: ins.text });
          return res.status(200).json({ ok: true, action: "like", toggled: true, liked: true, outfit_id, counts: null });
        }

        const out = await inc("like_count", +1);
        if (!out.ok) return res.status(500).json({ error: "Counter update failed", status: out.status, detail: out.text });

        const arr = safeParse(out.text, []);
        const row = Array.isArray(arr) ? (arr[0] || null) : arr;

        return res.status(200).json({ ok: true, action: "like", toggled: true, liked: true, outfit_id, counts: row });
      }

      return res.status(400).json({ error: "Unknown action", action });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");

    const limit = Math.min(parseInt(req.query.limit || "30", 10) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
    const sort = String(req.query.sort || "like").toLowerCase();

    const base =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?is_public=eq.true` +
      `&share_slug=not.is.null`;

    const selectV2 = `id,created_at,share_slug,image_path,style,spec,summary,like_count,share_count,apply_count`;
    const selectV1 = `id,created_at,share_slug,image_path,style,spec,summary`;

    const orderLike = `&order=like_count.desc,created_at.desc`;
    const orderNew = `&order=created_at.desc`;

    function buildUrl({ v2, forceNewOrder } = {}) {
      const select = v2 ? selectV2 : selectV1;
      const order =
        forceNewOrder
          ? orderNew
          : (sort === "new" ? orderNew : orderLike);
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

    let used = { schema: "v2", sort: sort === "new" ? "new" : "like" };
    let r = await fetchRows(buildUrl({ v2: true, forceNewOrder: false }));

    if (!r.ok) {
      const t = String(r.text || "").toLowerCase();
      const looksLikeMissingCols =
        r.status === 400 &&
        (t.includes("does not exist") ||
         t.includes("like_count") ||
         t.includes("share_count") ||
         t.includes("apply_count"));

      if (looksLikeMissingCols) {
        used = { schema: "v1", sort: "new" };
        r = await fetchRows(buildUrl({ v2: false, forceNewOrder: true }));
      }
    }

    if (!r.ok) return res.status(500).json({ error: "Query failed", status: r.status, detail: r.text });

    const rows = safeParse(r.text, []);

    const items = (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
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
