// pages/api/search-products.js
// V3.8 Precision Ranking
// Part 1 / 2

export const config = { runtime: "nodejs" };

const safe = (v) => String(v || "").trim();
const norm = (v) => safe(v).toLowerCase();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const tokenize = (v) => norm(v).split(/[\s,./\-_"'()]+/).filter(Boolean);

const TARGET_PER_SLOT = 3;
const MIN_TW_PER_SLOT = 2;

// ==============================
// 基本工具
// ==============================

function containsAny(text, words = []) {
  const t = norm(text);
  return words.some((w) => t.includes(norm(w)));
}

function countMatches(text, words = []) {
  const t = norm(text);
  return words.reduce((n, w) => (t.includes(norm(w)) ? n + 1 : n), 0);
}

function normalizeGender(input) {
  const g = norm(input);
  if (["male", "man", "men", "男性", "男"].includes(g)) return "male";
  if (["female", "woman", "women", "女性", "女"].includes(g)) return "female";
  return "neutral";
}

function normalizeAudience(input) {
  const a = norm(input);
  if (["kids", "kid", "child", "children", "兒童", "童裝"].includes(a)) return "kids";
  return "adult";
}

// ==============================
// 中文詞庫
// ==============================

function genderWord(gender, audience) {
  if (audience === "kids") {
    if (gender === "male") return "男童 童裝";
    if (gender === "female") return "女童 童裝";
    return "兒童 童裝";
  }

  if (gender === "male") return "男裝";
  if (gender === "female") return "女裝";
  return "中性";
}

function styleZh(styleTag) {
  const s = norm(styleTag);
  if (s.includes("outdoor")) return "戶外";
  if (s.includes("party")) return "派對";
  if (s.includes("date")) return "約會";
  if (s.includes("commute")) return "通勤";
  if (s.includes("casual")) return "休閒";
  return "";
}

function categoryZh(item) {
  const slot = norm(item.slot);
  const cat = norm(item.category || item.generic_name || "");

  if (slot === "top") {
    if (cat.includes("ribbed knit")) return "羅紋針織上衣 長袖針織上衣";
    if (cat.includes("knit polo")) return "針織Polo衫 長袖Polo衫";
    if (cat.includes("polo")) return "Polo衫";
    if (cat.includes("shirt")) return "襯衫";
    if (cat.includes("tee")) return "T恤";
    return "上衣";
  }

  if (slot === "outer") {
    if (cat.includes("cardigan")) return "開襟衫 針織外套";
    if (cat.includes("blazer")) return "西裝外套";
    if (cat.includes("hoodie")) return "連帽外套";
    return "外套";
  }

  if (slot === "bottom") {
    if (cat.includes("wide leg")) return "寬褲 西裝褲";
    if (cat.includes("jeans")) return "牛仔褲";
    if (cat.includes("cargo")) return "工裝褲";
    return "長褲";
  }

  if (slot === "shoes") {
    if (cat.includes("low-top leather")) return "小白鞋 真皮 低筒休閒鞋";
    if (cat.includes("loafer")) return "樂福鞋";
    if (cat.includes("boot")) return "短靴";
    return "鞋子";
  }

  if (slot === "bag") {
    if (cat.includes("crossbody")) return "斜背包 小包";
    return "包包";
  }

  return "服裝";
}

function buildTaiwanQuery(item, { gender, audience, styleTag }) {
  return uniq([
    genderWord(gender, audience),
    item.color || "",
    categoryZh(item),
    styleZh(styleTag),
    "台灣 現貨 蝦皮 momo PChome Yahoo購物 Pinkoi 酷澎",
  ]).join(" ");
}

function buildFallbackQuery(item, { gender, styleTag }) {
  return uniq([
    gender === "male" ? "men" : gender === "female" ? "women" : "",
    item.color || "",
    item.category || item.generic_name || "",
    styleZh(styleTag),
  ]).join(" ");
}

// ==============================
// SERP API
// ==============================

async function searchGoogle(apiKey, q, gl = "tw", hl = "zh-tw") {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", q);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("api_key", apiKey);

  const r = await fetch(url.toString());
  const j = await r.json();
  return j.shopping_results || [];
}

function normalizeGoogleProduct(p) {
  return {
    title: p.title,
    link: p.product_link || p.link,
    thumbnail: p.thumbnail,
    merchant: p.source || "",
    price: p.price,
    extracted_price: p.extracted_price,
    source: "google",
  };
}

function dedupe(list = []) {
  const seen = new Set();

  return list.filter((p) => {
    const key = p.link || p.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ==============================
// 台灣站判斷
// ==============================

function getLocalityScore(p) {
  const t = norm(`${p.title} ${p.merchant} ${p.link}`);

  const tw = [
    "蝦皮",
    "shopee",
    "momo",
    "pchome",
    "pinkoi",
    "yahoo",
    ".tw",
    "酷澎",
  ];

  if (tw.some((x) => t.includes(norm(x)))) return 20;
  return 0;
}

function isTaiwan(p) {
  return getLocalityScore(p) >= 20;
}

// ==============================
// 類別過濾
// ==============================

function slotKeywords(slot) {
  if (slot === "top") return ["上衣", "shirt", "tee", "knit", "針織", "polo"];
  if (slot === "outer") return ["外套", "jacket", "cardigan", "blazer"];
  if (slot === "bottom") return ["褲", "pants", "jeans", "trousers"];
  if (slot === "shoes") return ["鞋", "shoe", "sneaker", "loafer", "boot"];
  if (slot === "bag") return ["包", "bag", "crossbody"];
  return [];
}

function passesCategory(p, slot) {
  const hay = norm(`${p.title} ${p.merchant}`);
  return slotKeywords(slot).some((k) => hay.includes(norm(k)));
}

// ==============================
// custom_products 精準過濾
// ==============================

function customMatchScore(p, item) {
  const title = norm(p.title || "");
  const slot = norm(item.slot);

  let s = 0;

  if (slot === "outer" && containsAny(title, ["外套", "jacket", "cardigan", "blazer"])) s += 5;
  if (slot === "top" && containsAny(title, ["上衣", "shirt", "tee", "針織"])) s += 5;
  if (slot === "bottom" && containsAny(title, ["褲", "pants", "jeans"])) s += 5;
  if (slot === "shoes" && containsAny(title, ["鞋", "shoe"])) s += 5;
  if (slot === "bag" && containsAny(title, ["包", "bag"])) s += 5;

  return s;
}

// pages/api/search-products.js
// V3.8 Precision Ranking
// Part 2 / 2

// ==============================
// 精準排序
// ==============================

function precisionBoost(p, item, slot) {
  const t = norm(`${p.title || ""} ${p.merchant || ""}`);
  let s = 0;

  // top：羅紋針織、slim、clean
  if (slot === "top") {
    if (containsAny(t, ["羅紋", "ribbed"])) s += 4;
    if (containsAny(t, ["針織", "knit"])) s += 3;
    if (containsAny(t, ["合身", "slim"])) s += 2;
    if (containsAny(t, ["簡約", "minimal"])) s += 1;
  }

  // outer：cardigan 優先
  if (slot === "outer") {
    if (containsAny(t, ["cardigan", "開襟衫"])) s += 5;
    if (containsAny(t, ["針織外套"])) s += 3;
    if (containsAny(t, ["羊毛", "wool"])) s += 2;
  }

  // bottom：寬褲 / 牛仔褲
  if (slot === "bottom") {
    if (containsAny(t, ["寬褲", "wide leg"])) s += 4;
    if (containsAny(t, ["直筒", "straight"])) s += 3;
    if (containsAny(t, ["牛仔", "denim", "jeans"])) s += 2;
  }

  // shoes：白皮革低筒小白鞋
  if (slot === "shoes") {
    if (containsAny(t, ["小白鞋"])) s += 5;
    if (containsAny(t, ["真皮", "皮革", "leather"])) s += 3;
    if (containsAny(t, ["低筒", "low-top"])) s += 2;
  }

  // bag：小包 / 斜背包
  if (slot === "bag") {
    if (containsAny(t, ["斜背包", "crossbody"])) s += 4;
    if (containsAny(t, ["小包"])) s += 2;
  }

  return s;
}

function priceScore(p) {
  const price = Number(p.extracted_price || 0);
  if (!price) return 0;
  if (price < 800) return 1;
  if (price < 2500) return 0.5;
  if (price > 8000) return -2;
  return 0;
}

function rank(list, item, slot) {
  return list
    .map((p) => ({
      ...p,
      _score:
        getLocalityScore(p) +
        precisionBoost(p, item, slot) +
        priceScore(p),
    }))
    .sort((a, b) => b._score - a._score);
}

// ==============================
// 主 API
// ==============================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  try {
    const apiKey = process.env.SERPAPI_API_KEY;

    const {
      items = [],
      gender = "neutral",
      audience = "adult",
      styleTag = "",
    } = req.body;

    const g = normalizeGender(gender);
    const a = normalizeAudience(audience);

    const grouped = {};
    const debug = [];

    for (const item of items) {
      const slot = item.slot;

      const twQuery = buildTaiwanQuery(item, {
        gender: g,
        audience: a,
        styleTag,
      });

      const fallbackQuery = buildFallbackQuery(item, {
        gender: g,
        styleTag,
      });

      // V3.8：先台灣查詢，若不足再 fallback
      const rawTW = await searchGoogle(apiKey, twQuery, "tw", "zh-tw");

      let rawGlobal = [];
      if (rawTW.length < 6) {
        rawGlobal = await searchGoogle(apiKey, fallbackQuery, "tw", "zh-tw");
      }

      let products = dedupe([
        ...rawTW.map(normalizeGoogleProduct),
        ...rawGlobal.map(normalizeGoogleProduct),
      ]);

      // 類別過濾
      products = products.filter((p) => passesCategory(p, slot));

      // custom 商品額外排序
      products = products
        .map((p) => ({
          ...p,
          _customBoost:
            p.source === "custom" ? customMatchScore(p, item) : 0,
        }))
        .sort((a, b) => b._customBoost - a._customBoost);

      // 正式排序
      products = rank(products, item, slot);

      // 台灣優先
      const tw = products.filter(isTaiwan);
      const foreign = products.filter((p) => !isTaiwan(p));

      let final = [...tw, ...foreign].slice(0, TARGET_PER_SLOT);

      grouped[slot] = final;

      debug.push({
        slot,
        query: twQuery,
        fallbackQuery,
        rawTW: rawTW.length,
        rawGlobal: rawGlobal.length,
        finalTaiwan: final.filter(isTaiwan).length,
        top3: final.map((x) => ({
          title: x.title,
          merchant: x.merchant,
          score: x._score,
        })),
      });
    }

    return res.json({
      ok: true,
      grouped,
      flat: Object.values(grouped).flat(),
      debug,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || "search failed",
    });
  }
}
