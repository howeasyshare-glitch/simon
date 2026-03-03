// pages/api/outfits.js
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

async function getSupabaseServer() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      ok: false,
      error: "Missing env vars",
      detail: { SUPABASE_URL: !SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: !SERVICE_KEY },
    };
  }

  // dynamic import to avoid crash at module load time
  const mod = await import("../../lib/supabaseServer.js");
  const supabaseServer = mod.supabaseServer;
  if (!supabaseServer) {
    return { ok: false, error: "supabaseServer export not found", detail: "Check lib/supabaseServer.js export name" };
  }

  return { ok: true, supabaseServer, SUPABASE_URL, SERVICE_KEY };
}

export default async function handler(req, res) {
  const { op, id } = req.query;

  try {
    // --- auth (required for create/update) ---
    const auth = req.headers.authorization || "";
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    const supa = await getSupabaseServer();
    if (!supa.ok) return res.status(500).json({ error: supa.error, detail: supa.detail });

    const { supabaseServer, SUPABASE_URL, SERVICE_KEY } = supa;

    // list can be public (optional auth) — 你要鎖也可以
    if (req.method === "GET" && op === "list") {
      const { data, error } = await supabaseServer
        .from("outfits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) return res.status(500).json({ error: "supabase list failed", detail: error.message });
      return res.status(200).json({ ok: true, items: data || [] });
    }

    // create/update require bearer
    if (!accessToken) return res.status(401).json({ error: "Missing bearer token" });

    const userRes = await getUserFromSupabase({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, accessToken });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid token", detail: userRes.detail });

    const userId = userRes.user?.id;

    // --- CREATE ---
    if (req.method === "POST" && op === "create") {
      const body = req.body || {};
      const row = {
        user_id: userId,
        image_url: body.image_url ?? null,
        image_bucket: body.image_bucket ?? null,
        image_path: body.image_path ?? null,
        style: body.style ?? null,
        spec: body.spec ?? null,
        summary: body.summary ?? "",
        is_public: body.is_public ?? false,
        share_slug: body.share_slug ?? null,
        products: body.products ?? null,
      };

      const { data, error } = await supabaseServer.from("outfits").insert(row).select("*").single();
      if (error) return res.status(500).json({ error: "supabase insert failed", detail: error.message, hint: error.hint });

      return res.status(200).json({ ok: true, item: data });
    }

    // --- UPDATE ---
    if (req.method === "POST" && op === "update") {
      if (!id) return res.status(400).json({ error: "Missing id" });

      const body = req.body || {};
      const patch = {};
      if (body.is_public !== undefined) patch.is_public = body.is_public;
      if (body.share_slug !== undefined) patch.share_slug = body.share_slug;
      if (body.products !== undefined) patch.products = body.products;

      if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });

      const { data, error } = await supabaseServer
        .from("outfits")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId) // ✅ 避免更新別人的
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: "supabase update failed", detail: error.message, hint: error.hint });

      return res.status(200).json({ ok: true, item: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Outfits API crashed", detail: String(e?.message || e) });
  }
}
