import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "../lib/adminAuth";

export const config = { runtime: "nodejs" };

function parseIsActive(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}

function tagsToArray(x) {
  if (Array.isArray(x)) return x.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof x === "string") return x.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function jsonObjectOrEmpty(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}

function normalizeItem(item = {}) {
  return {
    title: String(item.title || "").trim(),
    image_url: String(item.image_url || "").trim(),
    product_url: String(item.product_url || "").trim(),
    merchant: item.merchant ? String(item.merchant).trim() : null,
    priority_boost: Number(item.priority_boost || 0),
    tags: tagsToArray(item.tags),
    badge_text: item.badge_text ? String(item.badge_text).trim() : null,
    discount_type: item.discount_type ? String(item.discount_type).trim() : "none",
    discount_code: item.discount_code ? String(item.discount_code).trim() : null,
    tracking_params: jsonObjectOrEmpty(item.tracking_params),
    is_active: ("is_active" in item) ? !!item.is_active : true,
  };
}

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const action = String(req.query.action || "").trim();

    // ---------- custom_products.list ----------
    if (action === "custom_products.list") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

      const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
      const offset = Math.max(0, Number(req.query.offset || 0));
      const q = String(req.query.q || "").trim();
      const tag = String(req.query.tag || "").trim();
      const isActive = parseIsActive(req.query.is_active);

      let query = supabaseServer
        .from("custom_products")
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (q) query = query.ilike("title", `%${q}%`);
      if (tag) query = query.filter("tags", "cs", JSON.stringify([tag]));
      if (isActive !== null) query = query.eq("is_active", isActive);

      const { data, error, count } = await query;
      if (error) return res.status(500).json({ error: "Supabase query failed", detail: error });

      return res.status(200).json({ ok: true, items: data || [], count: count ?? 0, limit, offset });
    }

    // ---------- custom_products.create ----------
    if (action === "custom_products.create") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const item = normalizeItem(req.body?.item || {});
      if (!item.title || !item.image_url || !item.product_url) {
        return res.status(400).json({ error: "Missing required fields: title, image_url, product_url" });
      }

      const { data, error } = await supabaseServer
        .from("custom_products")
        .insert(item)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: "Supabase insert failed", detail: error });

      return res.status(200).json({ ok: true, item: data });
    }

    // ---------- custom_products.update ----------
    if (action === "custom_products.update") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const id = req.body?.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const patch = normalizeItem(req.body?.patch || {});
      // update 不一定每欄都要，這裡只取你傳入的欄位（避免覆蓋成空字串）
      const raw = req.body?.patch || {};
      const safePatch = {};
      for (const k of Object.keys(patch)) {
        if (k in raw) safePatch[k] = patch[k];
      }

      const { data, error } = await supabaseServer
        .from("custom_products")
        .update(safePatch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: "Supabase update failed", detail: error });

      return res.status(200).json({ ok: true, item: data });
    }

    // ---------- custom_products.delete (soft) ----------
    if (action === "custom_products.delete") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const id = req.body?.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const { data, error } = await supabaseServer
        .from("custom_products")
        .update({ is_active: false })
        .eq("id", id)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: "Supabase delete(soft) failed", detail: error });

      return res.status(200).json({ ok: true, item: data });
    }

    // ---------- custom_products.import ----------
    if (action === "custom_products.import") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const items = req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items must be a non-empty array" });
      }

      const rows = items.map(normalizeItem);
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

      if (error) return res.status(500).json({ error: "Supabase import failed", detail: error });

      return res.status(200).json({ ok: true, inserted: data || [], count: (data || []).length });
    }

    // ---------- rules.get / rules.save ----------
    // 這兩個如果你已經有獨立表與邏輯，照搬原本內容進來即可（同樣用 action 分流）

    return res.status(400).json({ error: "Unknown action", action });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error", stack: String(e?.stack || "") });
  }
}
