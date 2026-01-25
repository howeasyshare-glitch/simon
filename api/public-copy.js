import { supabaseServer } from "../lib/supabaseServer";

export const config = { runtime: "nodejs" };

// ✅ 公開讀取：給前台用（不用 token）
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { data, error } = await supabaseServer
      .from("admin_kv")
      .select("value,updated_at")
      .eq("key", "home_copy")
      .maybeSingle();

    if (error) return res.status(500).json({ error: "Supabase query failed", detail: error });

    // cache：1 分鐘（你要更即時可調小）
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

    return res.status(200).json({ ok: true, copy: data?.value || null, updated_at: data?.updated_at || null });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
