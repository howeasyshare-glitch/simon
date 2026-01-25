import { supabaseServer } from "../lib/supabaseServer";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabaseServer
      .from("admin_kv")
      .select("value,updated_at")
      .eq("key", "homepage_copy")
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: "Supabase query failed", detail: error });
    }

    return res.status(200).json({
      ok: true,
      copy: data?.value || null,
      updated_at: data?.updated_at || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
