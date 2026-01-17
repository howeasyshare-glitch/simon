// /api/admin-custom-products-delete.js
import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "../lib/adminAuth";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });

    const { data, error } = await supabaseServer
      .from("custom_products")
      .update({ is_active: false })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: "Supabase update failed", detail: error.message || error });

    return res.status(200).json({ ok: true, item: data, adminEmail: admin.email });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error", stack: String(e?.stack || "") });
  }
}
