import { supabaseServer } from "./lib/supabaseServer";
import { requireAdmin } from "./lib/adminAuth";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return; // ✅ 超重要：避免 null 繼續跑造成 500

    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // ✅ 建議先不要亂 order 不存在的欄位；用 created_at 最安全（你表若沒有 created_at 再改）
    const q = supabaseServer
      .from("custom_products")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    const { data, error, count } = await q;

    if (error) {
      return res.status(500).json({
        error: "Supabase query failed",
        detail: error,
        hint: "Check table columns / RLS / env SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    return res.status(200).json({
      ok: true,
      rows: data || [],
      count: count ?? null,
      limit,
      offset,
      adminEmail: admin.email,
      warning: admin.warning || null,
    });
  } catch (e) {
    return res.status(500).json({
      error: e?.message || "Unknown error",
      stack: process.env.NODE_ENV === "development" ? String(e?.stack || "") : undefined,
    });
  }
}
