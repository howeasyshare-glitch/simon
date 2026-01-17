// pages/api/admin-custom-products-list.js
import { supabaseServer } from "./lib/supabaseServer";
import { requireAdmin } from "./lib/adminAuth";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0)));

    const q = String(req.query.q || "").trim();
    const tag = String(req.query.tag || "").trim();
    const status = String(req.query.status || "").trim(); // active / inactive / ""

    let query = supabaseServer
      .from("custom_products")
      .select("*", { count: "exact" });

    // 搜尋 title（不分大小寫）
    if (q) query = query.ilike("title", `%${q}%`);

    // 狀態
    if (status === "active") query = query.eq("is_active", true);
    if (status === "inactive") query = query.eq("is_active", false);

    // tags 包含（cs = contains）
    // 你的 tags 是 text[] 的話，這樣可用：tags cs ["xxx"]
    if (tag) query = query.filter("tags", "cs", JSON.stringify([tag]));

    const { data, error, count } = await query

      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: "Supabase query failed", detail: error });

    // ✅ 回傳 items，前端才會刷新列表
    return res.status(200).json({
      ok: true,
      items: data || [],
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
