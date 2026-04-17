// pages/api/search-products.js
// V2 ranking edition
// 特色：
// 1) Google Shopping + custom_products 雙來源
// 2) 依 slot / gender / ageGroup / styleTag 強化 query
// 3) ranking score：文字命中 + 顏色 + style + 來源權重 + custom boost
// 4) 依 slot 分組回傳，前端更容易直接渲染
//
// 注意：
// - 需要環境變數 SERPAPI_API_KEY 或 SERPAPI_KEY
// - 需要 lib/supabaseServer 可用
// - 若你的專案不是 pages/api 結構，請自行調整 import 路徑

import { supabaseServer } from "../../lib/supabaseServer";

export const config = { runtime: "nodejs" };

const DEFAULT_RULES = {
  perSlot: { top: 3, bottom: 3, shoes: 3, outer: 3, bag: 2, hat: 2 },
  customMax: 2,
  fallback: true,
  sourceMix: {
    googleMaxRatio: 0.7,
    customMinKeep: 1,
  },
};

let _rulesCache = { at: 0, value: DEFAULT_RULES };
const RULES_TTL_MS = 60 * 1000;

async function getDisplayRules() {
  const now = Date.now();
  if (_rulesCache.value && now - _rulesCache.at < RULES_TTL_MS) return _rulesCache.value;

  try {
    const { data, error } = await supabaseServer
      .from("admin_kv")
      .select("value,updated_at")
      .eq("key", "display_rules")
      .maybeSingle();

    if (error) {
      _rulesCache = { at: now, value: DEFAULT_RULES };
      return DEFAULT_RULES;
    }

    const raw = data?.value && typeof data.value === "object" ? data.value : {};
    const merged = {
      ...DEFAULT_RULES,
      ...raw,
      perSlot: { ...DEFAULT_RULES.perSlot, ...(raw.perSlot || {}) },
      sourceMix: { ...DEFAULT_RULES.sourceMix, ...(raw.sourceMix || {}) },
    };

    _rulesCache = { at: now, value: merged };
    return merged;
  } catch {
    _rulesCache = { at: now, value: DEFAULT_RULES };
    return DEFAULT_RULES;
  }
}

function safeStr(v) {
  return String(v || "").trim();
}

function norm(v) {
  return safeStr(v).toLowerCase();
}

function tokenize(v) {
  return norm(v)
    .split(/[\s,./\-_"'()]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function slotToKeywords(slot, locale) {
  if (locale === "tw") {
    switch (slot) {
      case "top": return ["上衣", "衣服"];
      case "bottom": return ["褲子", "下身"];
      case "shoes": return ["鞋", "鞋子"];
      case "outer": return ["外套", "大衣"];
      case "bag": return ["包包", "側背包"];
      case "hat": return ["帽子", "帽"];
      default: return [];
    }
  }
  switch (slot) {
    case "top": return ["top", "shirt", "tee", "blouse"];
    case "bottom": return ["pants", "trousers", "jeans", "skirt"];
    case "shoes": return ["shoes", "sneakers", "boots"];
    case "outer": return ["jacket", "coat", "outerwear"];
    case "bag": return ["bag", "crossbody", "tote"];
    case "hat": return ["hat", "cap", "beanie"];
    default: return [];
  }
}

function genderHint(locale, gender) {
  if (locale === "tw") {
    if (gender === "male") return "男";
    if (gender === "female") return "女";
    return "";
  }
  if (gender === "male") return "men";
  if (gender === "female") return "women";
  return "";
}

function ageHint(locale, ageGroup) {
  if (!ageGroup) return "";
  if (locale === "tw") {
    if (ageGroup === "kids") return "童裝";
    if (ageGroup === "adult") return "";
  } else {
    if (ageGroup === "kids") return "kids";
    if (ageGroup === "adult") return "";
  }
  return "";
}

function styleHint(locale, styleTag) {
  const s = safeStr(styleTag);
  if (!s) return "";
  const map = {
    scene_casual: locale === "tw" ? "休閒" : "casual",
    scene_commute: locale === "tw" ? "通勤" : "commute",
    scene_date: locale === "tw" ? "約會" : "date outfit",
    scene_sport: locale === "tw" ? "運動" : "sporty",
    scene_travel: locale === "tw" ? "旅行" : "travel outfit",
    scene_formal: locale === "tw" ? "正式" : "smart casual",
    celeb_gd: locale === "tw" ? "韓系街頭" : "korean streetwear",
    celeb_iu: locale === "tw" ? "韓系清新" : "soft korean casual",
    celeb_jennie: locale === "tw" ? "極簡辣" : "minimal chic",
    celeb_lisa: locale === "tw" ? "運動機能" : "athleisure",
  };
  return map[s] || "";
}

function isOppositeGenderTitle(title, gender) {
  if (!gender || gender === "neutral") return false;
  const t = norm(title);
  const femaleKw = ["女款", "女裝", "women", "womens", "woman", "lady", "ladies", "girls", "girl"];
  const maleKw = ["男款", "男裝", "men", "mens", "man", "boys", "boy"];
  if (gender === "male") return femaleKw.some((k) => t.includes(k));
  if (gender === "female") return maleKw.some((k) => t.includes(k));
  return false;
}

function isWrongAgeGroupTitle(title, ageGroup, { hl = "zh-tw" } = {}) {
  if (!ageGroup) return false;
  const t = norm(title);
  const kidsKwZh = ["童", "女童", "男童", "兒童"];
  const kidsKwEn = ["kids", "kid", "toddler", "youth", "junior"];
  const adultKw = ["女裝", "男裝", "women", "womens", "men", "mens"];
  if (ageGroup === "adult") {
    return kidsKwZh.some((k) => t.includes(k)) ||
      (String(hl).startsWith("en") && kidsKwEn.some((k) => t.includes(k)));
  }
  if (ageGroup === "kids") {
    return adultKw.some((k) => t.includes(k));
  }
  return false;
}

function buildQueriesFromItems(items = [], { locale = "tw", gender = "neutral", ageGroup = null, styleTag = null } = {}) {
  const priority = ["top", "bottom", "shoes", "outer", "bag", "hat"];
  const sorted = [...items].sort((a, b) => priority.indexOf(a.slot) - priority.indexOf(b.slot));

  return sorted
    .map((it) => {
      const slot = safeStr(it.slot);
      if (!slot) return null;

      const zhName = safeStr(it.display_name_zh);
      const enName = safeStr(it.generic_name);
      const explicitQuery = safeStr(it.shopping_query || it.searchable_query || it.query);

      const g = genderHint(locale, gender);
      const age = ageHint(locale, ageGroup);
      const slotKw = slotToKeywords(slot, locale)[0] || "";
      const style = styleHint(locale, styleTag);
      const color = safeStr(it.color);

      const mainName =
        explicitQuery ||
        (locale === "tw" ? (zhName || enName) : (enName || zhName));

      if (!mainName) return null;

      const strongQuery = [g, age, slotKw, color, mainName, style]
        .filter(Boolean)
        .join(" ")
        .trim();

      const fallbackQuery = [g, age, slotKw, color, zhName || enName]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        slot,
        q: strongQuery,
        fallbackQ: fallbackQuery,
        item: it,
      };
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
  return { ok: true, results: j.shopping_results || [] };
}

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
    if (gender && tags.includes(gender)) score += 2;

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
        merchant: row.merchant || "",
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

function scoreByTextMatch(title, tokens) {
  const t = norm(title);
  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (t.includes(token)) score += token.length >= 5 ? 1.8 : 1.0;
  }
  return score;
}

function scoreByColor(title, item) {
  const titleNorm = norm(title);
  const color = norm(item?.color);
  if (!color) return 0;
  return titleNorm.includes(color) ? 2 : 0;
}

function scoreBySlotKeywords(title, slot, locale) {
  const kw = slotToKeywords(slot, locale);
  const t = norm(title);
  return kw.some((x) => t.includes(norm(x))) ? 2 : 0;
}

function scoreByStyle(title, styleTag) {
  const t = norm(title);
  if (!styleTag) return 0;

  const styleMap = {
    scene_casual: ["casual", "daily", "basic", "relaxed", "休閒"],
    scene_commute: ["office", "commute", "formal", "smart", "通勤", "正式"],
    scene_date: ["date", "romantic", "minimal", "約會"],
    scene_sport: ["sport", "athletic", "running", "sporty", "運動"],
    scene_travel: ["travel", "comfortable", "relaxed", "旅行"],
    scene_formal: ["formal", "blazer", "smart", "tailored", "正式"],
    celeb_gd: ["street", "oversized", "korean", "街頭"],
    celeb_iu: ["soft", "clean", "feminine", "韓系"],
    celeb_jennie: ["minimal", "chic", "cropped", "極簡"],
    celeb_lisa: ["sporty", "athleisure", "dance", "機能"],
  };

  const words = styleMap[styleTag] || [];
  let score = 0;
  for (const w of words) if (t.includes(norm(w))) score += 0.8;
  return score;
}

function scoreBySource(product) {
  return product.source === "custom" ? 3.5 : 1.2;
}

function rankProducts(products, { item, slot, locale, styleTag }) {
  const queryTokens = uniqBy(
    [
      ...tokenize(item?.shopping_query),
      ...tokenize(item?.display_name_zh),
      ...tokenize(item?.generic_name),
      ...tokenize(item?.color),
    ],
    (x) => x
  );

  return products
    .map((p) => {
      const score =
        scoreBySource(p) +
        scoreByTextMatch(p.title, queryTokens) +
        scoreByColor(p.title, item) +
        scoreBySlotKeywords(p.title, slot, locale) +
        scoreByStyle(p.title, styleTag) +
        Number(p._custom_score || 0) * 0.3;

      return { ...p, _rank_score: Number(score.toFixed(2)) };
    })
    .sort((a, b) => b._rank_score - a._rank_score);
}

function mixAndTrimRanked({ rankedCustom, rankedGoogle, targetCount, rules }) {
  const customMinKeep = Number(rules?.sourceMix?.customMinKeep ?? 1);
  const googleMaxRatio = Number(rules?.sourceMix?.googleMaxRatio ?? 0.7);

  const maxGoogle = Math.max(0, Math.ceil(targetCount * googleMaxRatio));
  const keepCustom = Math.min(rankedCustom.length, Math.max(customMinKeep, targetCount - maxGoogle));
  const keepGoogle = Math.max(0, targetCount - keepCustom);

  const picked = [
    ...rankedCustom.slice(0, keepCustom),
    ...rankedGoogle.slice(0, keepGoogle),
  ];

  return uniqBy(picked, (p) => p.link).slice(0, targetCount);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
    if (!apiKey) {
      return res.status(200).json({
        ok: true,
        grouped: {},
        flat: [],
        warning: "SERPAPI_API_KEY / SERPAPI_KEY not set",
      });
    }

    const rules = await getDisplayRules();

    const {
      items = [],
      locale = "tw",
      gender = "neutral",
      ageGroup = null,
      styleTag = null,
    } = req.body || {};

    const queries = buildQueriesFromItems(items, { locale, gender, ageGroup, styleTag });
    if (!queries.length) {
      return res.status(200).json({ ok: true, grouped: {}, flat: [], debug: [], rules });
    }

    const gl = locale === "tw" ? "tw" : "us";
    const hl = locale === "tw" ? "zh-tw" : "en";

    const grouped = {};
    const debug = [];

    for (const { slot, q, fallbackQ, item } of queries) {
      const targetCount = Number(rules?.perSlot?.[slot] ?? DEFAULT_RULES.perSlot[slot] ?? 3);
      const customMax = Number(rules?.customMax ?? DEFAULT_RULES.customMax);

      const custom = await fetchCustomForSlot({ slot, gender, ageGroup, styleTag, customMax });
      debug.push({ slot, stage: "custom", count: custom.length, targetCount, customMax });

      const googleSearch = await serpapiShoppingSearch({ apiKey, q, gl, hl });
      debug.push({ slot, stage: "google_primary", q, ok: googleSearch.ok, count: googleSearch.ok ? googleSearch.results.length : 0 });

      let google = [];
      if (googleSearch.ok) {
        google = (googleSearch.results || [])
          .filter((p) => !isOppositeGenderTitle(p.title, gender))
          .filter((p) => !isWrongAgeGroupTitle(p.title, ageGroup, { hl }))
          .map((p) => ({
            slot,
            title: p.title || "",
            price: p.price || "",
            extracted_price: p.extracted_price || null,
            source: "google",
            merchant: p.source || "",
            link: p.product_link || p.link || "",
            thumbnail: p.thumbnail || "",
            query: q,
          }))
          .filter((p) => p.title && p.link && p.thumbnail);
      }

      if (rules?.fallback && google.length < targetCount && fallbackQ && fallbackQ !== q) {
        const fallbackSearch = await serpapiShoppingSearch({ apiKey, q: fallbackQ, gl, hl });
        debug.push({
          slot,
          stage: "google_fallback",
          q: fallbackQ,
          ok: fallbackSearch.ok,
          count: fallbackSearch.ok ? fallbackSearch.results.length : 0,
        });

        if (fallbackSearch.ok) {
          const more = (fallbackSearch.results || [])
            .filter((p) => !isOppositeGenderTitle(p.title, gender))
            .filter((p) => !isWrongAgeGroupTitle(p.title, ageGroup, { hl }))
            .map((p) => ({
              slot,
              title: p.title || "",
              price: p.price || "",
              extracted_price: p.extracted_price || null,
              source: "google",
              merchant: p.source || "",
              link: p.product_link || p.link || "",
              thumbnail: p.thumbnail || "",
              query: fallbackQ,
            }))
            .filter((p) => p.title && p.link && p.thumbnail);

          google = uniqBy([...google, ...more], (p) => p.link);
        }
      }

      const customLinks = new Set(custom.map((x) => x.link));
      google = google.filter((p) => !customLinks.has(p.link));

      const rankedCustom = rankProducts(custom, { item, slot, locale, styleTag });
      const rankedGoogle = rankProducts(google, { item, slot, locale, styleTag });

      const finalList = mixAndTrimRanked({
        rankedCustom,
        rankedGoogle,
        targetCount,
        rules,
      });

      grouped[slot] = finalList;
      debug.push({
        slot,
        stage: "final",
        targetCount,
        customCount: custom.length,
        googleCount: google.length,
        resultCount: finalList.length,
        resultScores: finalList.map((x) => ({ title: x.title, score: x._rank_score, source: x.source })),
      });
    }

    const flat = Object.entries(grouped)
      .flatMap(([slot, list]) => (list || []).map((x) => ({ ...x, slot })));

    return res.status(200).json({
      ok: true,
      grouped,
      flat,
      debug,
      rules,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
