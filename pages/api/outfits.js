// pages/api/outfits.js
import { supabaseServer } from "../../lib/supabaseServer";

export default async function handler(req, res) {
  const { op, id } = req.query;

  try {
    // -------------------------
    // CREATE
    // -------------------------
    if (req.method === "POST" && op === "create") {
      const body = req.body || {};

      const { data, error } = await supabaseServer
        .from("outfits")
        .insert({
          image_url: body.image_url || null,
          image_bucket: body.image_bucket || null,
          image_path: body.image_path || null,
          style: body.style || null,
          spec: body.spec || null,
          summary: body.summary || "",
          is_public: body.is_public ?? false,
          share_slug: body.share_slug ?? null,
          products: body.products ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ ok: true, item: data });
    }

    // -------------------------
    // UPDATE
    // -------------------------
    if (req.method === "POST" && op === "update") {
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const body = req.body || {};
      const patch = {};

      if (body.is_public !== undefined) patch.is_public = body.is_public;
      if (body.share_slug !== undefined) patch.share_slug = body.share_slug;
      if (body.products !== undefined) patch.products = body.products;

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "Nothing to update" });
      }

      const { data, error } = await supabaseServer
        .from("outfits")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ ok: true, item: data });
    }

    // -------------------------
    // LIST
    // -------------------------
    if (req.method === "GET" && op === "list") {
      const { data, error } = await supabaseServer
        .from("outfits")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return res.status(200).json({ ok: true, items: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: "Outfits API crashed",
      detail: String(e?.message || e),
    });
  }
}
