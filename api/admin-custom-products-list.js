// /api/admin-custom-products-list.js
import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "../lib/adminAuth";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return; // requireAdmin 已回應 401/403，這裡要 return 掉

    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const q = String(req.query.q || "").trim();
    const isActiveStr = String(req.query.is_active || "").trim(); // "true" / "false"
    const tag = String(req.query.tag || "").trim();

    let query = supabaseServer
      .from("custom_products")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1);

    // 有 created_at 就用 created_at，沒有就不要 order（避免因欄位不存在直接報錯）
    query = query.order("created_at", { ascending: false });

    if (isActiveStr === "true") query = query.eq("is_active", true);
    if (isActiveStr === "false") query = query.eq("is_active", false);

    // title 搜尋（用 ilike）
    if (q) query = query.ilike("title", `%${q}%`);

    // tags 包含（tags 是 text[] 的情況可用 cs）
    if (tag) query = query.contains("tags", [tag]);

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({
        error: "Supabase query failed",
        detail: error.message || error,
      });
    }

    return res.status(200).json({
      ok: true,
      items: data || [],
      count: count ?? 0,
      limit,
      offset,
      adminEmail: admin.email,
    });
  } catch (e) {
    // 這裡很重要：把 crash 變成可讀的錯誤
    return res.status(500).json({
      error: e?.message || "Unknown error",
      stack: String(e?.stack || ""),
    });
  }
}
