// api/custom-products.js
// GET: debug query by tag
// POST: generate products map by spec.items slots and write-ready structure

export default async function handler(req, res) {
  try {
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

    // dynamic import (avoid module resolution crash)
    const mod = await import("../../lib/supabaseServer.js");
    const supabaseServer = mod.supabaseServer;

    if (!supabaseServer) {
      return res.status(500).json({
        error: "supabaseServer export not found",
        hint: "Check lib/supabaseServer.js export name",
      });
    }

    // -----------------------
    // GET (debug)
    // -----------------------
    if (req.method === "GET") {
      const tag = String(req.query?.tag || "item_outerwear");
      const limit = Math.min(parseInt(String(req.query?.limit || "6"), 10) || 6, 20);

      const containsJson = JSON.stringify([tag]); // e.g. ["item_outerwear"]

      const { data, error } = await supabaseServer
        .from("custom_products")
        .select("*")
        .eq("is_active", true)
        .filter("tags", "cs", containsJson)
        .limit(limit);

      if (error) return res.status(500).json({ error: "supabase query failed", detail: String(error?.message || error) });
      return res.status(200).json({ items: data || [], tag, limit });
    }

    // -----------------------
    // POST (real)
    // body: { items: [{slot:"top"|"bottom"|...}] , limitPerSlot?: number }
    // returns: { ok:true, products:{ top:[...], bottom:[...], ... } }
    // -----------------------
    if (req.method === "POST") {
      const body = req.body || {};
      const items = Array.isArray(body.items) ? body.items : [];
      const limitPerSlot = Math.min(Number(body.limitPerSlot ?? 4) || 4, 12);

      if (!items.length) return res.status(400).json({ error: "Missing items" });

      // slot -> tag mapping (你可依你 DB tags 命名微調)
      const slotToTag = {
        top: "item_top",
        bottom: "item_bottom",
        shoes: "item_shoes",
        outer: "item_outerwear",
        bag: "item_bag",
        hat: "item_hat",
      };

      // decide required slots from spec.items
      const slots = Array.from(
        new Set(
          items
            .map((it) => String(it?.slot || "").toLowerCase())
            .filter((s) => ["top", "bottom", "shoes", "outer", "bag", "hat"].includes(s))
        )
      );

      const products = {};

      // query each slot
      for (const slot of slots) {
        const tag = slotToTag[slot];
        if (!tag) continue;

        const containsJson = JSON.stringify([tag]);

        const { data, error } = await supabaseServer
          .from("custom_products")
          .select("*")
          .eq("is_active", true)
          .filter("tags", "cs", containsJson)
          .limit(limitPerSlot);

        if (error) {
          return res.status(500).json({
            error: "supabase query failed",
            slot,
            tag,
            detail: String(error?.message || error),
          });
        }

        products[slot] = data || [];
      }

      return res.status(200).json({ ok: true, products });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: "Function crashed",
      detail: String(e?.message || e),
    });
  }
}
