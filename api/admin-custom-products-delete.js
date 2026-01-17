import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "./lib/adminAuth";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = req.body?.id;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const { data, error } = await supabaseServer
    .from("custom_products")
    .update({ is_active: false })
    .eq("id", id)
    .select("id,is_active,updated_at")
    .single();

  if (error) return res.status(500).json({ error: "DB error", detail: error.message });

  return res.status(200).json({ ok: true, item: data });
}
