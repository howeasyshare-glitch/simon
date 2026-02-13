// api/custom-products.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1) 先檢查環境變數（避免 supabaseServer 在載入時就出事）
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        error: "Missing env vars",
        missing: {
          SUPABASE_URL: !SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !SERVICE_KEY,
        },
      });
    }

    // 2) 用動態 import，並且加上 .js（避免 module resolution crash）
    const mod = await import("../../lib/supabaseServer.js");
    const supabaseServer = mod.supabaseServer;

    if (!supabaseServer) {
      return res.status(500).json({
        error: "supabaseServer export not found",
        hint: "Check lib/supabaseServer.js export name",
      });
    }

    const ITEM_TAG = "item_outerwear";
const containsJson = JSON.stringify([ITEM_TAG]); // '["item_outerwear"]'

const { data, error } = await supabaseServer
  .from("custom_products")
  .select("*")
  .eq("is_active", true)
  .filter("tags", "cs", containsJson) // 用 cs + 明確 JSON 字串，最穩
  .limit(2);


    return res.status(200).json({ items: data || [] });
  } catch (e) {
    // 這裡會把真正 crash 的原因吐出來（例如匯入失敗）
    return res.status(500).json({
      error: "Function crashed",
      detail: String(e?.message || e),
    });
  }
}
