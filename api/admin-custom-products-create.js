import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "./lib/adminAuth";
export const config = { runtime: "nodejs" };

function normalize(input) {
  const x = input && typeof input === "object" ? input : {};
  const tags = Array.isArray(x.tags) ? x.tags.map(String).map(s => s.trim()).filter(Boolean) : [];
  return {
    title: String(x.title || "").trim(),
    image_url: String(x.image_url || "").trim(),
    product_url: String(x.product_url || "").trim(),
    merchant: String(x.merchant || "").trim() || null,
    tags,
    priority_boost: Number.isFinite(Number(x.priority_boost)) ? Number(x.priority_boost) : 0,
    badge_text: x.badge_text == null ? null : String(x.badge_text),
    discount_type: x.discount_type || "none",
    discount_code: x.discount_code == null ? null : String(x.discount_code),
    tracking_params: (x.tracking_params && typeof x.tracking_params === "object") ? x.tracking_params : {},
    is_active: typeof x.is_active === "boolean" ? x.is_active : true,
  };
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const row = normalize(req.body?.item);

  if (!row.title || !row.image_url || !row.product_url) {
    return res.status(400).json({ error: "Missing required fields: title, image_url, product_url" });
  }

  const { data, error } = await supabaseServer
    .from("custom_products")
    .insert(row)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: "DB error", detail: error.message });

  return res.status(200).json({ ok: true, item: data });
}
