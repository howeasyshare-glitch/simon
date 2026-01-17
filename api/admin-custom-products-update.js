// /api/admin-custom-products-update.js
import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "../lib/adminAuth";

export const config = { runtime: "nodejs" };

function normalizePatch(patch = {}) {
  const out = {};
  if ("title" in patch) out.title = String(patch.title || "").trim();
  if ("image_url" in patch) out.image_url = String(patch.image_url || "").trim();
  if ("product_url" in patch) out.product_url = String(patch.product_url || "").trim();
  if ("merchant" in patch) out.merchant = patch.merchant ? String(patch.merchant).trim() : null;
  if ("priority_boost" in patch) out.priority_boost = Number(patch.priority_boost || 0);
  if ("tags" in patch) out.tags = Array.isArray(patch.tags) ? patch.tags.map(x => String(x).trim()).filter(Boolean) : [];
  if ("badge_text" in patch) out.badge_text = patch.badge_text ? String(patch.badge_text).trim() : null;
  if ("discount_type" in patch) out.discount_type = patch.discount_type ? String(patch.discount_type).trim() : "none";
  if ("discount_code" in patch) out.discount_code = patch.discount_code ? String(patch.discount_code).trim() : null;
  if ("tracking_params" in patch) out.tracking_params = patch.tracking_params && typeof patch.tracking_params === "object" ? patch.tracking_params : {};
  if ("is_active" in patch) out.is_active = !!patch.is_active;
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { id, patch } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });

    const upd = normalizePatch(patch);

    const { data, error } = await supabaseServer
      .from("custom_products")
      .update(upd)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: "Supabase update failed", detail: error.message || error });

    return res.status(200).json({ ok: true, item: data, adminEmail: admin.email });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error", stack: String(e?.stack || "") });
  }
}
