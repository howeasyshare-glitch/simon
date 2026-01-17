import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "./lib/adminAuth";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const {
    q = "",
    is_active = "",
    tag = "",
    limit = "50",
    offset = "0",
  } = req.query || {};

  let query = supabaseServer
    .from("custom_products")
    .select("id,title,image_url,product_url,merchant,tags,priority_boost,badge_text,discount_type,discount_code,tracking_params,is_active,created_at,updated_at", { count: "exact" })
    .order("priority_boost", { ascending: false })
    .order("updated_at", { ascending: false });

  if (is_active === "true") query = query.eq("is_active", true);
  if (is_active === "false") query = query.eq("is_active", false);

  if (q) query = query.ilike("title", `%${q}%`);

  // tag filter: tags contains "tag"
  if (tag) query = query.contains("tags", [tag]);

  const lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const off = Math.max(0, parseInt(offset, 10) || 0);
  query = query.range(off, off + lim - 1);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: "DB error", detail: error.message });

  return res.status(200).json({ ok: true, items: data || [], count: count || 0, limit: lim, offset: off });
}
