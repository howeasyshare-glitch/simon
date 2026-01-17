// /api/admin-custom-products-create.js
import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "../lib/adminAuth";

export const config = { runtime: "nodejs" };

function normalizeItem(item = {}) {
  return {
    title: String(item.title || "").trim(),
    image_url: String(item.image_url || "").trim(),
    product_url: String(item.product_url || "").trim(),
    merchant: item.merchant ? String(item.merchant).trim() : null,
    priority_boost: Number(item.priority_boost || 0),
    // tags: 你目前用 jsonb array（跟 search-products 一致）
    tags: Array.isArray(item.tags) ? item.tags.map(x => String(x).trim()).filter(Boolean) : [],
    badge_text: item.badge_text ? String(item.badge_text).trim() : null,
    discount_type: item.discount_type ? String(item.discount_type).trim() : "none",
    discount_code: item.discount_code ? String(item.discount_code).trim() : null,
    tracking_params: item.tracking_params && typeof item.tracking_params === "object" ? item.tracking_params : {},
    is_active: !!item.is_active,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { item } = req.body || {};
    const row = normalizeItem(item);

    if (!row.title || !row.image_url || !row.product_url) {
      return res.status(400).json({ error: "Missing required fields", detail: "title/image_url/product_url are required" });
    }

    const { data, error } = await supabaseServer
      .from("custom_products")
      .insert(row)
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: "Supabase insert failed", detail: error.message || error });

    return res.status(200).json({ ok: true, item: data, adminEmail: admin.email });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error", stack: String(e?.stack || "") });
  }
}
