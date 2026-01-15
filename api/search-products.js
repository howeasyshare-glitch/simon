// pages/api/search-products.js
import { supabaseServer } from "../lib/supabaseServer";
export const config = { runtime: "nodejs" };

// 更像人會搜的「類別詞」
function slotToKeywords(slot, locale) {
  if (locale === "tw") {
    switch (slot) {
      case "top": return "上衣";
      case "bottom": return "褲子";
      case "shoes": return "鞋";
      case "outer": return "外套";
      case "bag": return "包包";
      case "hat": return "帽子";
      default: return "";
    }
  } else {
    switch (slot) {
      case "top": return "top";
      case "bottom": return "pants";
      case "shoes": return "shoes";
      case "outer": return "jacket";
      case "bag": return "bag";
      case "hat": return "hat";
      default: return "";
    }
  }
}

function genderHint(locale, gender) {
  if (locale === "tw") {
    if (gender === "male") return "男";
    if (gender === "female") return "女";
    return "";
  } else {
    if (gender === "male") return "men";
    if (gender === "female") return "women";
    return "";
  }
}

// ✅ 拿掉單字「男/女」避免誤殺，只保留較精準的詞
function isOppositeGenderTitle(title, gender) {
  if (!gender || gender === "neutral") return false;

  const t = String(title || "").toLowerCase();

  const femaleKw = ["女款", "女裝", "women", "womens", "woman", "lady", "ladies", "girls", "girl"];
  const maleKw = ["男款", "男裝", "men", "mens", "man", "boys", "boy"];

  if (gender === "male") return femaleKw.some(k => t.includes(k));
  if (gender === "female") return maleKw.some(k => t.includes(k));
  return false;
}

function buildQueriesFromItems(items = [], { locale = "tw", gender = "neutral" } = {}) {
  const priority = ["top", "bottom", "shoes", "outer", "bag", "hat"];
  const sorted = [...items].sort((a, b) => priority.indexOf(a.slot) - priority.indexOf(b.slot));
  const picked = sorted.slice(0, 6);

  const g = genderHint(locale, gender);

  return picked
    .map((it) => {
      const name = (it.display_name_zh || "").trim() || (it.generic_name || "").trim();
      if (!name) return null;

      const color = (it.color || "").trim();
      const slot = (it.slot || "").trim();
      const cat = slotToKeywords(slot, locale);

      const q = `${g ? g + " " : ""}${cat ? cat + " " : ""}${color ? color + " " : ""}${name}`.trim();
      return { slot: it.slot, q };
    })
    .filter(Boolean);
}

async function serpapiShoppingSearch({ apiKey, q, gl = "tw", hl = "zh-tw" }) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", q);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("api_key", apiKey);

  const r = await fetch(url.toString());
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { j = { raw: text }; }

  if (!r.ok) {
    return { ok: false, status: r.status, error: j?.error || "serpapi failed", detail: j };
  }

  const results = j.shopping_results || [];
  return { ok: true, results };
}

// ---------- Custom products (Supabase) ----------
const SLOT_TO_ITEMTAG = {
  outer: "item_outerwear",
  top: "item_top",
  bottom: "item_bottom",
  shoes: "item_shoes",
  bag: "item_bag",
};

function buildTrackedUrl(productUrl, trackingParams = {}, productId = "") {
  try {
    if (!productUrl) return "";
    const url = new URL(productUrl);
    for (const [k, v] of Object.entries(trackingParams || {})) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
    if (productId) url.searchParams.set("utm_content", String(productId));
    return url.toString();
  } catch {
    return productUrl || "";
  }
}

async function fetchCustomForSlot({ slot, gender, ageGroup, styleTag }) {
  const itemTag = SLOT_TO_ITEMTAG[slot] || null;
  if (!itemTag) return [];

  const baseContains = [itemTag];
  if (ageGroup === "adult" || ageGroup === "kids") baseContains.push(ageGroup);

  const containsJson = JSON.stringify(baseContains);

  const { data, error } = await supabaseServer
    .from("custom_products")
    .select("id,title,image_url,product_url,merchant,tags,priority_boost,badge_text,discount_type,discount_code,tracking_params")
    .eq("is_active", true)
    .filter("tags", "cs", containsJson);

  if (error) return [];

  const scored = (data || []).map((row) => {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    let score = Number(row.priority_boost || 0);

    if (styleTag && tags.includes(styleTag)) score += 3;

    if (tags.includes("male") || tags.includes("female") || tags.includes("neutral")) {
      if (gender && tags.includes(gender)) score += 2;
    }

    return { row, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .map(({ row, score }) => {
      const badge = (row.badge_text && row.badge_text !== "nullable") ? row.badge_text : "本站推薦";
      const discountCode = (row.discount_code && row.discount_code !== "nullable") ? row.discount_code : null;

      const title = row.title || "";
      const thumbnail = row.image_url || "";
      const link = buildTrackedUrl(row.product_url, row.tracking_params, row.id);

      return {
        slot,
        title,
        price: null,
        extracted_price: null,
        source: "custom",
        link,
        thumbnail,
        badge_text: badge,
        discount_type: row.discount_type || "none",
        discount_code: discountCode,
        _custom_score: score,
      };
    })
    .filter((p) => p.title && p.link && p.thumbnail)
    .slice(0, 2);
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

// ---------- Handler ----------
export default async function handler(req, res) {
  console.log("[search-products] called", new Date().toISOString());

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return res.status(200).json({ ok: true, products: [], warning: "SERPAPI_API_KEY not set" });

    const { items = [], locale = "tw", gender = "neutral", ageGroup = null, styleTag = null } = req.body || {};
    const queries = buildQueriesFromItems(items, { locale, gender });
    if (!queries.length) return res.status(200).json({ ok: true, products: [] });

    const gl = locale === "tw" ? "tw" : "us";
    const hl = locale === "tw" ? "zh-tw" : "en";

    const all = [];
    const debug = [];

    for (const { slot, q } of queries) {
      const custom = await fetchCustomForSlot({ slot, gender, ageGroup, styleTag });
      const customCapped = custom.slice(0, 2);

      debug.push({ slot, stage: "custom", count: customCapped.length, ageGroup, styleTag });

      // ✅ 你的規則：補到 4（自訂0→4、自訂1→3、自訂2→2）
      const needGoogle = Math.max(0, 4 - customCapped.length);

      let google = [];
      if (needGoogle > 0) {
        const s = await serpapiShoppingSearch({ apiKey, q, gl, hl });
        debug.push({ slot, stage: "serpapi", q, ok: s.ok, count: s.ok ? s.results.length : 0, status: s.status });

        if (s.ok) {
          google = (s.results || [])
            .filter((p) => !isOppositeGenderTitle(p.title, gender))
            .map((p) => ({
              slot,
              title: p.title,
              price: p.price,
              extracted_price: p.extracted_price,
              source: p.source || "google",
              link: p.product_link || p.link || "",
              thumbnail: p.thumbnail,
            }))
            .filter((p) => p.title && p.link && p.thumbnail);

          const customLinks = new Set(customCapped.map((x) => x.link));
          google = google.filter((p) => !customLinks.has(p.link));
          google = uniqBy(google, (p) => p.link).slice(0, needGoogle);
        }
      }

      all.push(...customCapped, ...google);
    }

    return res.status(200).json({ ok: true, products: all, debug });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
