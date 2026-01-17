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
    tags: Array.isArray(item.tags) ? item.tags.map(x => String(x).trim()).filter(Boolean) : [],
    badge_text: item.badge_text ? String(item.badge_text).trim() : null,
    discount_type: item.discount_type ? String(item.discount_type).trim() : "none",
    discount_code: item.discount_code ? String(item.discount_code).trim() : null,
    tracking_params: item.tracking_params && typeof item.tracking_params === "object" ? item.tracking_params : {},
    is_active: "is_active" in item ? !!item.is_active : true,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const rows = items.map(normalizeItem);

    // 基本必填檢查
    const bad = rows.findIndex(r => !r.title || !r.image_url || !r.product_url);
    if (bad >= 0) {
      return res.status(400).json({
        error: "Missing required fields in one item",
        detail: { index: bad, required: ["title", "image_url", "product_url"] },
      });
    }

    const { data, error } = await supabaseServer
      .from("custom_products")
      .insert(rows)
      .select("id,title,is_active");

    if (error) return res.status(500).json({ error: "Supabase insert failed", detail: error.message || error });

    return res.status(200).json({ ok: true, inserted: data || [], count: (data || []).length });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error", stack: String(e?.stack || "") });
  }
}
