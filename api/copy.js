import { supabaseServer } from "../lib/supabaseServer";

export const config = { runtime: "nodejs" };

/**
 * GET /api/copy?name=homepage|public
 * - homepage => key = "homepage_copy"
 * - public   => key = "home_copy"   (公開讀取，會加 cache header)
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = String(req.query.name || "").toLowerCase();
  const map = {
    homepage: { key: "homepage_copy", cache: false },
    public: { key: "home_copy", cache: true },
  };

  const cfg = map[name];
  if (!cfg) {
    return res.status(400).json({ error: "Missing/invalid name. Use ?name=homepage or ?name=public" });
  }

  try {
    const { data, error } = await supabaseServer
      .from("admin_kv")
      .select("value,updated_at")
      .eq("key", cfg.key)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: "Supabase query failed", detail: error });
    }

    // public 版沿用你原本的 cache 策略
    if (cfg.cache) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    }

    return res.status(200).json({
      ok: true,
      name,
      key: cfg.key,
      copy: data?.value || null,
      updated_at: data?.updated_at || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
