// api/admin.js
import { supabaseServer } from "../lib/supabaseServer";
import { requireAdmin } from "../lib/adminAuth";

export const config = { runtime: "nodejs" };

// ---------- helpers ----------
function parseIsActive(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}

function tagsToArray(x) {
  if (Array.isArray(x)) return x.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof x === "string") return x.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function jsonObjectOrEmpty(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
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

function pickOnlyKeys(obj = {}, keys = []) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    // 支援 action=... 或 op=...
    const action = String(req.query.action || req.query.op || "").trim();

    // =====================================================================
    // RULES: get_rules / save_rules  (stored in admin_kv, key = display_rules)
    // =====================================================================
    if (action === "get_rules") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

      const { data, error } = await supabaseServer
        .from("admin_kv")
        .select("value,updated_at")
        .eq("key", "display_rules")
        .maybeSingle();

      if (error) return res.status(500).json({ error: "Supabase query failed", detail: error });

      return res.status(200).json({
        ok: true,
        rules: data?.value || null,
        updated_at: data?.updated_at || null,
        adminEmail: admin?.email || null,
      });
    }

    if (action === "save_rules") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const rules = req.body?.rules || null;
      if (!rules || typeof rules !== "object") {
        return res.status(400).json({ error: "Missing rules (object)" });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabaseServer
        .from("admin_kv")
        .upsert({ key: "display_rules", value: rules, updated_at: now }, { onConflict: "key" })
        .select("value,updated_at")
        .single();

      if (error) return res.status(500).json({ error: "Supabase upsert failed", detail: error });

      return res.status(200).json({
        ok: true,
        saved: { rules: data?.value || null, updated_at: data?.updated_at || null },
        adminEmail: admin?.email || null,
      });
    }

    /**
 * Add these actions into your existing /api/admin.js
 * (same token + whitelist flow):
 *   - homepage_copy.get
 *   - homepage_copy.save
 *
 * Storage: admin_kv table
 *   key: "homepage_copy"
 *   value: JSON object
 */

// ---------- homepage_copy.get ----------
if (action === "homepage_copy.get") {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { data, error } = await supabaseServer
    .from("admin_kv")
    .select("value,updated_at")
    .eq("key", "homepage_copy")
    .maybeSingle();

  if (error) return res.status(500).json({ error: "Supabase query failed", detail: error });

  return res.status(200).json({
    ok: true,
    value: data?.value || {},
    updated_at: data?.updated_at || null,
  });
}

// ---------- homepage_copy.save ----------
if (action === "homepage_copy.save") {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const value = req.body?.value;
  if (!value || typeof value !== "object") {
    return res.status(400).json({ error: "Missing value (object)" });
  }

  const { data, error } = await supabaseServer
    .from("admin_kv")
    .upsert(
      { key: "homepage_copy", value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    )
    .select("updated_at")
    .single();

  if (error) return res.status(500).json({ error: "Supabase upsert failed", detail: error });

  return res.status(200).json({ ok: true, updated_at: data?.updated_at || null });
}


    // =====================================================================
    // CUSTOM PRODUCTS
    // =====================================================================
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
        .range(offset, offset + limit - 1);

      // 不用 created_at（你表沒有）
      // 如果你有 priority_boost 可排序也行，但先不要假設欄位存在
      // query = query.order("priority_boost", { ascending: false });

      if (q) query = query.ilike("title", `%${q}%`);
      if (tag) query = query.filter("tags", "cs", JSON.stringify([tag]));
      if (isActive !== null) query = query.eq("is_active", isActive);

      const { data, error, count } = await query;
      if (error) return res.status(500).json({ error: "Supabase query failed", detail: error });

      return res.status(200).json({ ok: true, items: data || [], count: count ?? 0, limit, offset });
    }

    if (action === "custom_products.create") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const item = normalizeItem(req.body?.item || {});
      if (!item.title || !item.image_url || !item.product_url) {
        return res.status(400).json({ error: "Missing required fields: title, image_url, product_url" });
      }

      // 允許 merchant/badge/tracking 空白，tags 可空但建議要有 item_top / adult 等
      const { data, error } = await supabaseServer
        .from("custom_products")
        .insert(item)
        .select("*")
        .single();

      if (error) return res.status(500).json({ error: "Supabase insert failed", detail: error });

      return res.status(200).json({ ok: true, item: data });
    }

    if (action === "custom_products.update") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const id = req.body?.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      // 只更新你真的傳來的欄位，避免覆蓋成空字串
      const raw = req.body?.patch || {};
      const normalized = normalizeItem(raw);

      const allowedKeys = [
        "title",
        "image_url",
        "product_url",
        "merchant",
        "priority_boost",
        "tags",
        "badge_text",
        "discount_type",
        "discount_code",
        "tracking_params",
        "is_active",
      ];
      const safePatch = pickOnlyKeys(normalized, allowedKeys);

      // 只保留 raw 有傳的 key
      for (const k of Object.keys(safePatch)) {
        if (!(k in raw)) delete safePatch[k];
      }

      if (Object.keys(safePatch).length === 0) {
        return res.status(400).json({ error: "Empty patch" });
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

    if (action === "custom_products.delete") {
      // soft delete = is_active=false
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

    if (action === "custom_products.import") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const items = req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items must be a non-empty array" });
      }

      const rows = items.map(normalizeItem);
      const bad = rows.findIndex((r) => !r.title || !r.image_url || !r.product_url);
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

    return res.status(400).json({ error: "Unknown action", action });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error", stack: String(e?.stack || "") });
  }
}
