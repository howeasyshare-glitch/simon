// pages/api/search-products.js
import { supabaseServer } from "../lib/supabaseServer";
export const config = { runtime: "nodejs" };

// ========= Config from DB (admin rules) =========
const DEFAULT_RULES = {
  perSlot: { top: 4, bottom: 4, shoes: 4, outer: 4, bag: 2, hat: 2 },
  customMax: 2,          // 每個 slot 最多給幾個 custom
  fallback: true,        // SerpApi 不足時要不要用 fallback query 再搜一次
};

async function getDisplayRules() {
  try {
    const { data, error } = await supabaseServer
      .from("display_rules")
      .select("rules")
      .eq("id", 1)
      .maybeSingle();

    if (error) return DEFAULT_RULES;
    const r = data?.rules && typeof data.rules === "object" ? data.rules : {};
    return {
      ...DEFAULT_RULES,
      ...r,
      perSlot: { ...DEFAULT_RULES.perSlot, ...(r.perSlot || {}) },
    };
  } catch {
    return DEFAULT_RULES;
  }
}

// ========= Query helpers =========
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

// ✅ 更精準，避免只用「男/女」誤殺
function isOppositeGenderTitle(title, gender) {
  if (!gender || gender === "neutral") return false;
  const t = String(title || "").toLowerCase();

  const femaleKw = ["女款", "女裝", "women", "womens", "woman", "lady", "ladies", "girls", "girl"];
  const maleKw = ["男款", "男裝", "men", "mens", "man", "boys", "boy"];

  if (gender === "male") return femaleKw.some(k => t.includes(k));
  if (gender === "female") return maleKw.some(k => t.includes(k));
  return false;
}

// ✅ 修正：不要用 girls/boys 判 kid（成人也會出現）
function isWrongAgeGroupTitle(title, ageGroup, { hl = "zh-tw" } = {}) {
  if (!ageGroup) return false;
  const t = String(title || "").toLowerCase();

  const kidsKwZh = ["童", "女童", "男童", "兒童"];
  const kidsKwEn = ["kids", "kid", "toddler", "youth", "junior"]; // ✅ 移除 girls/boys
  const adultKw = ["女裝", "男裝", "women", "womens", "men", "mens"];

  if (ageGroup === "adult") {
    const hitKids = kidsKwZh.some(k => t.includes(k)) || (String(hl).startsWith("en") && kidsKwEn.some(k => t.includes(k)));
    return hitKids;
  }
  if (ageGroup === "kids") {
    // 童裝：排除很像成人（保守）
    return adultKw.some(k => t.includes(k));
  }
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

      // ✅ Query 不要過窄：避免 name 已含「女裝」又再加一堆造成結果太少
      const q = `${g ? g + " " : ""}${cat ? cat + " " : ""}${color ? color + " " : ""}${name}`.trim();
      return { slot: it.slot, q, item: it };
    })
    .filter(Boolean);
}

function buildFallbackQuery({ slot, item, locale = "tw", gender = "neutral" }) {
  const g = genderHint(locale, gender);
  const cat = slotToKeywords(slot, locale);

  const base = String(item?.display_name_zh || item?.generic_name || "").trim();
  const short = base ? base.slice(0, 10) : "";
  // ✅ fallback 不加顏色，縮短關鍵字
  return `${g ? g + " " : ""}${cat ? cat + " " : ""}${short}`.trim();
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
  return { ok: true, results: j.shopping_results || [] };
}

// ========= Custom products (Supabase) =========
const SLOT_TO_ITEMTAG = {
  outer: "item_outerwear",
  top: "item_top",
  bottom: "item_bottom",
  shoes: "item_shoes",
  bag: "item_bag",
  hat: "item_hat",
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

async function fetchCustomForSlot({ slot, gender, ageGroup, styleTag, customMax }) {
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
      const badgeRaw = row.badge_text;
      const badge = badgeRaw && badgeRaw !== "nullable" && badgeRaw !== "NULL" ? badgeRaw : "本站推薦";
      const codeRaw = row.discount_code;
      const discountCode = codeRaw && codeRaw !== "nullable" && codeRaw !== "NULL" ? codeRaw : null;

      return {
        slot,
        title: row.title || "",
        price: null,
        extracted_price: null,
        source: "custom",
        link: buildTrackedUrl(row.product_url, row.tracking_params, row.id),
        thumbnail: row.image_url || "",
        badge_text: badge,
        discount_type: row.discount_type || "none",
        discount_code: discountCode,
        _custom_score: score,
      };
    })
    .filter((p) => p.title && p.link && p.thumbnail)
    .slice(0, Math.max(0, Number(customMax || 0)));
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

// ========= Handler =========
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return res.status(200).json({ ok: true, products: [], warning: "SERPAPI_API_KEY not set" });

    const rules = await getDisplayRules();

    const { items = [], locale = "tw", gender = "neutral", ageGroup = null, styleTag = null } = req.body || {};
    const queries = buildQueriesFromItems(items, { locale, gender });
    if (!queries.length) return res.status(200).json({ ok: true, products: [], debug: [] });

    const gl = locale === "tw" ? "tw" : "us";
    const hl = locale === "tw" ? "zh-tw" : "en";

    const all = [];
    const debug = [];

    for (const { slot, q, item } of queries) {
      const targetCount = Number(rules?.perSlot?.[slot] ?? 4);
      const customMax = Number(rules?.customMax ?? 2);

      const custom = await fetchCustomForSlot({ slot, gender, ageGroup, styleTag, customMax });
      debug.push({ slot, stage: "custom", count: custom.length, targetCount, customMax, ageGroup, styleTag });

      const needGoogle = Math.max(0, targetCount - custom.length);

      let google = [];
      const collectGoogle = async (queryStr, takeN, stage) => {
        if (takeN <= 0) return [];
        const s = await serpapiShoppingSearch({ apiKey, q: queryStr, gl, hl });
        debug.push({ slot, stage, q: queryStr, ok: s.ok, count: s.ok ? s.results.length : 0, status: s.status });

        if (!s.ok) return [];
        let list = (s.results || [])
          .filter((p) => !isOppositeGenderTitle(p.title, gender))
          .filter((p) => !isWrongAgeGroupTitle(p.title, ageGroup, { hl }))
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

        // 去掉與 custom 重複
        const customLinks = new Set(custom.map((x) => x.link));
        list = list.filter((p) => !customLinks.has(p.link));

        return uniqBy(list, (p) => p.link).slice(0, takeN);
      };

      if (needGoogle > 0) {
        google = await collectGoogle(q, needGoogle, "serpapi");
      }

      // ✅ fallback：不夠再用更寬的 query 再搜一次補齊
      const stillNeed = Math.max(0, needGoogle - google.length);
      if (rules?.fallback && stillNeed > 0) {
        const fq = buildFallbackQuery({ slot, item, locale, gender });
        if (fq && fq !== q) {
          const more = await collectGoogle(fq, stillNeed, "serpapi_fallback");
          // 再去重一次（避免 fallback 跟第一輪重複）
          const links = new Set(google.map(x => x.link));
          const add = more.filter(x => !links.has(x.link));
          google = google.concat(add).slice(0, needGoogle);
        }
      }

      all.push(...custom, ...google);
      debug.push({ slot, stage: "final", count: custom.length + google.length, needGoogle, gotGoogle: google.length });
    }

    return res.status(200).json({ ok: true, products: all, debug, rules });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
