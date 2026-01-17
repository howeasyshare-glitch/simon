import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "./lib/adminAuth";
export const config = { runtime: "nodejs" };

function normalizePatch(input) {
  const x = input && typeof input === "object" ? input : {};
  const patch = {};

  const setStr = (k) => { if (k in x) patch[k] = x[k] == null ? null : String(x[k]).trim(); };
  const setNum = (k) => { if (k in x) patch[k] = Number.isFinite(Number(x[k])) ? Number(x[k]) : 0; };
  const setBool = (k) => { if (k in x) patch[k] = !!x[k]; };

  setStr("title");
  setStr("image_url");
  setStr("product_url");
  setStr("merchant");
  if ("tags" in x) patch.tags = Array.isArray(x.tags) ? x.tags.map(String).map(s => s.trim()).filter(Boolean) : [];
  setNum("priority_boost");
  setStr("badge_text");
  setStr("discount_type");
  setStr("discount_code");
  if ("tracking_params" in x) patch.tracking_params = (x.tracking_params && typeof x.tracking_params === "object") ? x.tracking_params : {};
  setBool("is_active");

  return patch;
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = req.body?.id;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const patch = normalizePatch(req.body?.patch);

  const { data, error } = await supabaseServer
    .from("custom_products")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: "DB error", detail: error.message });

  return res.status(200).json({ ok: true, item: data });
}
