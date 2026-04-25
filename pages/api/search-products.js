// pages/api/search-products.js
// V3.3 - 中文台灣優先 + adult/kids 分流 + top/outer 穩定版

export const config = { runtime: "nodejs" };

// ===== 工具 =====
const safe = (v) => String(v || "").trim();
const norm = (v) => safe(v).toLowerCase();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const tokenize = (v) => norm(v).split(/[\s,./\-_"'()]+/).filter(Boolean);

function containsAny(text, words = []) {
  const t = norm(text);
  return words.some((w) => t.includes(norm(w)));
}

function countMatches(text, words = []) {
  const t = norm(text);
  return words.reduce((n, w) => (t.includes(norm(w)) ? n + 1 : n), 0);
}

function normalizeGender(input) {
  const g = String(input || "").trim().toLowerCase();
  if (["male", "man", "men", "男性", "男", "boy", "boys"].includes(g)) return "male";
  if (["female", "woman", "women", "女性", "女", "girl", "girls"].includes(g)) return "female";
  if (["neutral", "unisex", "中性", "男女皆可"].includes(g)) return "neutral";
  return "neutral";
}


function normalizeAudience(input) {
  const a = String(input || "").trim().toLowerCase();
  if (["kids", "kid", "child", "children", "boy", "girl", "兒童", "童裝", "小孩", "小童", "男童", "女童"].includes(a)) return "kids";
  return "adult";
}

const ZH_COLOR_MAP = {
  navy: "海軍藍",
  "navy blue": "海軍藍",
  blue: "藍色",
  beige: "米色",
  khaki: "卡其色",
  cream: "奶油色",
  white: "白色",
  black: "黑色",
  gray: "灰色",
  grey: "灰色",
  brown: "棕色",
  olive: "橄欖綠",
  "olive green": "橄欖綠",
  green: "綠色",
  red: "紅色",
};

const ZH_MATERIAL_MAP = {
  knit: "針織",
  cotton: "棉質",
  "knit cotton": "針織棉",
  "cotton blend": "棉混紡",
  denim: "牛仔",
  leather: "皮革",
  canvas: "帆布",
  nylon: "尼龍",
  fleece: "刷毛",
};

const ZH_FIT_MAP = {
  slim: "合身",
  regular: "標準版型",
  relaxed: "寬鬆",
  oversized: "寬版",
  straight: "直筒",
};

const ZH_SLEEVE_MAP = {
  "short sleeve": "短袖",
  "long sleeve": "長袖",
  sleeveless: "無袖",
};

const ZH_NECKLINE_MAP = {
  "crew neck": "圓領",
  "polo collar": "Polo領",
  "shirt collar": "襯衫領",
  hooded: "連帽",
  "lapel collar": "翻領",
};

const ZH_CATEGORY_MAP = [
  ["knit polo", "針織 Polo 衫"],
  ["polo shirt", "Polo 衫"],
  ["button-up shirt", "襯衫"],
  ["button up shirt", "襯衫"],
  ["graphic t-shirt", "圖案 T 恤"],
  ["crew neck t-shirt", "圓領 T 恤"],
  ["long sleeve t-shirt", "長袖 T 恤"],
  ["t-shirt", "T 恤"],
  ["tee", "T 恤"],
  ["sweater", "針織衫"],
  ["cardigan", "針織外套"],
  ["hoodie", "連帽外套"],
  ["utility jacket", "機能外套"],
  ["fleece jacket", "刷毛外套"],
  ["jacket", "外套"],
  ["jeans", "牛仔褲"],
  ["chino shorts", "卡其短褲"],
  ["shorts", "短褲"],
  ["chino", "卡其褲"],
  ["trousers", "長褲"],
  ["cargo", "工裝褲"],
  ["loafers", "樂福鞋"],
  ["loafer", "樂福鞋"],
  ["leather sneakers", "皮革休閒鞋"],
  ["canvas sneakers", "帆布休閒鞋"],
  ["sneaker", "休閒鞋"],
  ["boot", "靴子"],
  ["crossbody", "斜背包"],
  ["messenger", "郵差包"],
  ["tote", "托特包"],
  ["bag", "包包"],
];

function zhTerm(v, map) {
  const key = norm(v);
  return map[key] || safe(v);
}

function categoryZh(item) {
  const cat = norm(item.category || item.generic_name || item.display_name_zh || item.label);
  if (item.display_name_zh) return safe(item.display_name_zh);
  for (const [needle, zh] of ZH_CATEGORY_MAP) {
    if (cat.includes(needle)) return zh;
  }
  return safe(item.category || item.generic_name || item.label || "服裝");
}

function audienceGenderWord(gender, audience) {
  if (audience === "kids") {
    if (gender === "male") return "男童 童裝";
    if (gender === "female") return "女童 童裝";
    return "兒童 童裝";
  }
  if (gender === "male") return "男裝";
  if (gender === "female") return "女裝";
  return "中性 服裝";
}

function styleZh(styleTag) {
  if (styleTag === "scene_commute") return "通勤 穿搭";
  if (styleTag === "scene_casual") return "休閒 穿搭";
  if (styleTag === "scene_date") return "約會 穿搭";
  if (styleTag === "scene_outdoor") return "戶外 穿搭";
  return "";
}

function buildZhQuery(item, { gender, audience, styleTag, domainHint = false }) {
  const tokens = uniq([
    audienceGenderWord(gender, audience),
    zhTerm(item.color, ZH_COLOR_MAP),
    zhTerm(item.fit, ZH_FIT_MAP),
    zhTerm(item.material, ZH_MATERIAL_MAP),
    zhTerm(item.sleeve_length, ZH_SLEEVE_MAP),
    zhTerm(item.neckline, ZH_NECKLINE_MAP),
    categoryZh(item),
    styleZh(styleTag),
    domainHint ? "site:shopee.tw OR site:momoshop.com.tw OR site:pchome.com.tw OR site:tw.buy.yahoo.com" : "台灣 購物 蝦皮 momo PChome Yahoo購物",
  ]);
  return tokens.filter(Boolean).join(" ");
}

// ===== 類別 / 同義詞 =====
function getCategorySynonyms(item) {
  const cat = norm(item.category || item.generic_name || item.display_name_zh);
  const slot = norm(item.slot);

  // TOP / 上衣
  if (cat.includes("knit polo") || cat.includes("polo shirt")) return ["polo", "polo shirt", "knit polo"];
  if (cat.includes("button-up shirt") || cat.includes("button up shirt")) return ["button-up shirt", "button down shirt", "shirt", "oxford shirt"];
  if (cat.includes("shirt")) return ["shirt", "button-up shirt", "button down shirt", "oxford shirt"];
  if (cat.includes("graphic t-shirt")) return ["graphic t-shirt", "graphic tee", "t-shirt", "tee"];
  if (cat.includes("crew neck t-shirt")) return ["crew neck t-shirt", "t-shirt", "tee"];
  if (cat.includes("long-sleeve t-shirt") || cat.includes("long sleeve t-shirt")) return ["long sleeve t-shirt", "long-sleeve tee", "t-shirt", "tee"];
  if (cat.includes("t-shirt") || cat.includes("tee")) return ["t-shirt", "tee"];
  if (cat.includes("sweater")) return ["sweater", "knit sweater", "pullover"];

  // OUTER / 外套
  if (cat.includes("cardigan")) return ["cardigan", "knit cardigan", "sweater cardigan", "knitwear"];
  if (cat.includes("hoodie")) return ["hoodie", "hooded sweatshirt", "zip hoodie"];
  if (cat.includes("utility jacket")) return ["utility jacket", "jacket", "outerwear"];
  if (cat.includes("fleece jacket")) return ["fleece jacket", "jacket", "outerwear", "fleece"];
  if (cat.includes("jacket") || cat.includes("outer")) return ["jacket", "outerwear", "coat", "coach jacket"];

  // BOTTOM
  if (cat.includes("straight-leg jeans") || cat.includes("straight leg jeans")) return ["jeans", "denim", "straight jeans", "straight-leg jeans"];
  if (cat.includes("jeans")) return ["jeans", "denim", "denim pants"];
  if (cat.includes("chino shorts")) return ["chino shorts", "shorts"];
  if (cat.includes("shorts")) return ["shorts"];
  if (cat.includes("straight-leg chinos") || cat.includes("straight leg chinos")) return ["chinos", "chino", "trousers", "pants"];
  if (cat.includes("chino trousers")) return ["chino trousers", "chinos", "trousers", "pants"];
  if (cat.includes("chinos")) return ["chinos", "chino", "trousers", "pants"];
  if (cat.includes("trousers")) return ["trousers", "pants"];
  if (cat.includes("cargo")) return ["cargo pants", "cargo", "pants"];

  // SHOES
  if (cat.includes("leather loafers") || cat.includes("loafers")) return ["loafer", "loafers", "slip-on"];
  if (cat.includes("low-top leather sneakers") || cat.includes("leather sneakers")) return ["sneaker", "sneakers", "leather sneakers", "low-top sneakers"];
  if (cat.includes("low-top canvas sneakers") || cat.includes("canvas sneakers")) return ["sneaker", "sneakers", "canvas sneakers", "low-top sneakers"];
  if (cat.includes("trail")) return ["trail shoes", "trail running", "running shoes"];
  if (cat.includes("running")) return ["running shoes", "running sneaker", "trainer"];
  if (cat.includes("sneaker")) return ["sneaker", "sneakers", "trainer", "trainers", "casual shoes"];
  if (cat.includes("boot")) return ["boot", "boots"];

  // BAG
  if (cat.includes("crossbody")) return ["crossbody", "crossbody bag", "shoulder bag"];
  if (cat.includes("messenger")) return ["messenger bag", "crossbody", "shoulder bag"];
  if (cat.includes("tote")) return ["tote", "tote bag"];
  if (cat.includes("bag")) return ["bag", "crossbody", "tote", "messenger"];

  // fallback by slot
  if (slot === "top") return ["shirt", "tee", "polo", "sweater"];
  if (slot === "outer") return ["jacket", "outerwear", "coat", "cardigan", "hoodie"];
  if (slot === "bottom") return ["pants", "trousers", "jeans", "shorts", "chino"];
  if (slot === "shoes") return ["shoes", "sneaker", "trainer", "loafer", "boot"];
  if (slot === "bag") return ["bag", "crossbody", "tote", "messenger", "shoulder"];

  return [];
}

// ===== query =====
function buildQuery(item, { locale, gender, styleTag }) {
  const useZH = locale === "tw";

  const genderWord =
    gender === "male" ? (useZH ? "男裝" : "men") :
    gender === "female" ? (useZH ? "女裝" : "women") : "";

  const style =
    styleTag === "scene_commute" ? (useZH ? "通勤 穿搭" : "smart casual outfit") :
    styleTag === "scene_casual" ? (useZH ? "休閒 穿搭" : "casual outfit") :
    styleTag === "scene_date" ? (useZH ? "約會 穿搭" : "date outfit") :
    styleTag === "scene_outdoor" ? (useZH ? "戶外 穿搭" : "outdoor outfit") : "";

  const core = uniq([
    item.color,
    item.fit,
    item.material,
    item.sleeve_length,
    item.neckline,
    item.category || item.generic_name || item.display_name_zh
  ]);

  return uniq([genderWord, ...core, style]).filter(Boolean).join(" ");
}

// ===== 搜尋 =====
function buildTaiwanFirstQuery(q) {
  return `${q} 台灣 蝦皮 momo PChome Yahoo購物 Pinkoi`;
}

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

// ===== gender / 黑名單 =====
function isOppositeGenderProduct(p, gender) {
  const hay = norm(`${p.title || ""} ${p.merchant || ""} ${p.link || ""}`);

  const femaleWords = [
    "women", "woman", "womens", "ladies", "lady", "girl", "girls",
    "女裝", "女款", "女生", "婦女", "womenswear"
  ];

  const maleWords = [
    "men", "man", "mens", "boy", "boys",
    "男裝", "男款", "男生", "menswear"
  ];

  if (gender === "male") return femaleWords.some((w) => hay.includes(norm(w)));
  if (gender === "female") return maleWords.some((w) => hay.includes(norm(w)));
  return false;
}


function isWrongAudienceProduct(p, audience) {
  const hay = norm(`${p.title || ""} ${p.merchant || ""} ${p.link || ""}`);
  const kidsWords = ["童裝", "兒童", "男童", "女童", "小童", "kids", "kid", "children", "child", "boys", "girls"];

  // 只在成人案例排除明確童裝。兒童案例不在 hard filter 直接排除成人詞，
  // 因為台灣商品標題常不標示童裝/成人，太硬會造成整組推薦被清空。
  if (audience === "adult") {
    return kidsWords.some((w) => hay.includes(norm(w)));
  }

  return false;
}

function isForbiddenForSlot(title, slot, gender) {
  const t = norm(title);

  const maleForbidden = [
    "bra", "bralette", "crop top", "skirt", "dress", "bikini", "panties",
    "heels", "blouse", "one-piece swimsuit", "swimsuit", "lingerie"
  ];

  if (gender === "male" && maleForbidden.some((w) => t.includes(w))) return true;

  if (slot === "top" && ["skirt", "dress", "panties", "bikini bottom", "bottom"].some((w) => t.includes(w))) return true;
  if (slot === "outer" && ["skirt", "dress", "panties", "bikini", "bra"].some((w) => t.includes(w))) return true;
  if (slot === "bottom" && ["bra", "bralette", "top", "dress", "heel", "shoe", "bikini bottom"].some((w) => t.includes(w))) return true;
  if (slot === "shoes" && ["bra", "shirt", "top", "dress", "bag", "pant", "pants"].some((w) => t.includes(w))) return true;
  if (slot === "bag" && ["shoe", "shirt", "pants", "dress", "bra", "bikini"].some((w) => t.includes(w))) return true;

  return false;
}

// ===== slot 規則 =====
function slotStrictKeywords(slot, item) {
  const categoryWords = getCategorySynonyms(item);
  const cat = norm(item.category || "");

  if (slot === "top") {
    const extra = [];
    if (cat.includes("polo")) extra.push("polo");
    if (cat.includes("shirt")) extra.push("shirt");
    if (cat.includes("t-shirt") || cat.includes("tee")) extra.push("t-shirt", "tee");
    if (cat.includes("sweater")) extra.push("sweater");
    return uniq([...categoryWords, ...extra]);
  }

  if (slot === "outer") {
    const extra = [];
    if (cat.includes("cardigan")) extra.push("cardigan");
    if (cat.includes("hoodie")) extra.push("hoodie");
    if (cat.includes("jacket")) extra.push("jacket");
    if (cat.includes("coat")) extra.push("coat");
    return uniq([...categoryWords, ...extra]);
  }

  if (slot === "bottom") {
    const extra = [];
    if (cat.includes("jeans")) extra.push("jeans", "denim");
    if (cat.includes("chino")) extra.push("chino", "chinos", "trousers", "pants");
    if (cat.includes("shorts")) extra.push("shorts");
    return uniq([...categoryWords, ...extra]);
  }

  if (slot === "shoes") {
    const extra = [];
    if (cat.includes("loafer")) extra.push("loafer", "loafers");
    if (cat.includes("sneaker")) extra.push("sneaker", "sneakers");
    if (cat.includes("boot")) extra.push("boot", "boots");
    return uniq([...categoryWords, ...extra]);
  }

  if (slot === "bag") {
    const extra = [];
    if (cat.includes("crossbody")) extra.push("crossbody", "shoulder bag");
    if (cat.includes("messenger")) extra.push("messenger bag", "crossbody");
    if (cat.includes("tote")) extra.push("tote", "tote bag");
    return uniq([...categoryWords, ...extra]);
  }

  return categoryWords;
}

function slotSoftKeywords(slot, item) {
  const cat = norm(item.category || "");

  if (slot === "top") {
    if (cat.includes("polo")) return ["polo", "shirt", "knit"];
    if (cat.includes("shirt")) return ["shirt", "button"];
    if (cat.includes("t-shirt") || cat.includes("tee")) return ["t-shirt", "tee"];
    if (cat.includes("sweater")) return ["sweater", "knit"];
    return ["shirt", "tee", "polo", "sweater"];
  }

  if (slot === "outer") {
    if (cat.includes("cardigan")) return ["cardigan", "knit"];
    if (cat.includes("hoodie")) return ["hoodie"];
    if (cat.includes("jacket")) return ["jacket", "outerwear"];
    return ["jacket", "outerwear", "coat", "cardigan", "hoodie"];
  }

  if (slot === "bottom") {
    if (cat.includes("jeans")) return ["jeans", "denim"];
    if (cat.includes("shorts")) return ["shorts"];
    return ["pants", "trousers", "chino", "jeans", "shorts"];
  }

  if (slot === "shoes") return ["sneaker", "shoe", "trainer", "loafer", "boot"];
  if (slot === "bag") return ["bag", "crossbody", "messenger", "tote", "shoulder"];

  return [];
}

function passesCategoryFilter(p, item, slot, mode = "strict") {
  const hay = norm(`${p.title || ""} ${p.merchant || ""}`);
  const words = mode === "strict" ? slotStrictKeywords(slot, item) : slotSoftKeywords(slot, item);
  if (!words.length) return true;
  return words.some((w) => hay.includes(norm(w)));
}

function passesSleeveFilter(p, item) {
  const hay = norm(p.title);
  const s = norm(item.sleeve_length);

  if (!s || s === "none") return true;
  if (s === "long sleeve") return hay.includes("long sleeve") || hay.includes("長袖");
  if (s === "short sleeve") return hay.includes("short sleeve") || hay.includes("短袖");
  if (s === "sleeveless") return hay.includes("sleeveless") || hay.includes("無袖");
  return true;
}

function passesMaterialFilter(p, item, slot) {
  const hay = norm(p.title);
  const m = norm(item.material);

  if (!m || m === "none") return true;

  if (slot === "top" || slot === "bottom" || slot === "outer") {
    if (m.includes("cotton linen")) return containsAny(hay, ["cotton", "linen", "棉麻"]);
    if (m.includes("cotton blend")) return containsAny(hay, ["cotton", "blend", "棉"]);
    if (m.includes("knit cotton")) return containsAny(hay, ["knit", "cotton", "針織"]);
    if (m.includes("cotton twill")) return containsAny(hay, ["cotton", "twill", "棉"]);
    if (m.includes("cotton canvas")) return containsAny(hay, ["cotton", "canvas", "帆布"]);
    if (m.includes("denim")) return containsAny(hay, ["denim", "jeans", "牛仔"]);
    if (m.includes("fleece")) return containsAny(hay, ["fleece", "刷毛", "搖粒絨"]);
    return hay.includes(m) || containsAny(hay, tokenize(m));
  }

  if (m.includes("faux leather")) return containsAny(hay, ["faux leather", "vegan leather", "pu leather"]);
  if (m.includes("leather")) return containsAny(hay, ["leather", "皮革"]);
  if (m.includes("canvas")) return containsAny(hay, ["canvas", "帆布"]);
  if (m.includes("nylon")) return containsAny(hay, ["nylon", "尼龍"]);

  return hay.includes(m) || containsAny(hay, tokenize(m));
}

function passesNecklineFilter(p, item) {
  const hay = norm(p.title);
  const n = norm(item.neckline);

  if (!n || n === "none") return true;
  if (n === "crew neck") return containsAny(hay, ["crew neck", "圓領"]);
  if (n === "polo collar") return containsAny(hay, ["polo", "polo shirt", "knit polo"]);
  if (n === "shirt collar") return containsAny(hay, ["shirt", "button-up", "button down", "collar", "襯衫"]);
  if (n === "hooded") return containsAny(hay, ["hoodie", "hooded", "連帽"]);
  if (n === "lapel collar") return containsAny(hay, ["lapel", "blazer", "西裝"]);
  return true;
}

// ===== filter =====
function hardFilter(list, item, slot, gender, audience) {
  return list.filter((p) => {
    if (isOppositeGenderProduct(p, gender)) return false;
    if (isWrongAudienceProduct(p, audience)) return false;
    if (isForbiddenForSlot(p.title, slot, gender)) return false;
    if (!passesCategoryFilter(p, item, slot, "strict")) return false;

    if (slot === "top") {
      if (!passesSleeveFilter(p, item)) return false;
      if (!passesNecklineFilter(p, item)) return false;
      return true;
    }

    if (slot === "outer") {
      if (!passesMaterialFilter(p, item, slot)) return false;
      return true;
    }

    if (slot === "bottom") {
      if (!passesMaterialFilter(p, item, slot)) return false;
      return true;
    }

    if (slot === "shoes") {
      if (!passesMaterialFilter(p, item, slot)) return false;
      return true;
    }

    if (slot === "bag") {
      if (!passesMaterialFilter(p, item, slot)) return false;
      return true;
    }

    return true;
  });
}

function softFallbackFilter(list, item, slot, gender, audience) {
  return list.filter((p) => {
    if (isOppositeGenderProduct(p, gender)) return false;
    if (isWrongAudienceProduct(p, audience)) return false;
    if (isForbiddenForSlot(p.title, slot, gender)) return false;
    if (!passesCategoryFilter(p, item, slot, "soft")) return false;

    if (slot === "top") {
      return passesSleeveFilter(p, item);
    }

    return true;
  });
}

// ===== ranking =====
function scorePrice(p, slot) {
  const price = Number(p.extracted_price || 0);
  if (!price) return 0;

  const cap = { top: 2000, outer: 3500, bottom: 2500, shoes: 3000, bag: 2500 }[slot] || 2500;
  if (price < cap * 0.6) return 1;
  if (price < cap) return 0.5;
  if (price < cap * 1.5) return -0.5;
  return -2;
}

function scoreLuxury(title) {
  const t = norm(title);
  return ["off-white", "balenciaga", "gucci", "prada"].some((x) => t.includes(x)) ? -2 : 0;
}

function getLocalityScore(p) {
  const t = norm(`${p.title || ""} ${p.merchant || ""} ${p.link || ""}`);

  const strongTW = [
    "shopee.tw", "蝦皮", "momo", "momoshop", "momo購物",
    "pchome", "24h", "tw.mall.yahoo", "yahoo購物", "yahoo奇摩",
    "pinkoi", ".tw/", ".com.tw"
  ];
  const okAsia = ["rakuten", "uniqlo", "gu", "zara", "muji", "淘寶", "韓國", "日本"];
  const weakForeign = ["ebay", "etsy", "poshmark", "mercari", "depop", "vestiaire", "farfetch", "ssense"];

  if (strongTW.some((h) => t.includes(norm(h)))) return 8;
  if (okAsia.some((h) => t.includes(norm(h)))) return 2;
  if (weakForeign.some((h) => t.includes(norm(h)))) return -4;
  return 0;
}

function isLikelyTaiwanProduct(p) {
  return getLocalityScore(p) >= 8;
}

function scoreTW(p) {
  return getLocalityScore(p);
}

function scoreText(p, item) {
  const tokens = uniq([
    ...tokenize(item.generic_name || ""),
    ...tokenize(item.display_name_zh || ""),
    ...tokenize(item.category || ""),
    ...tokenize(item.color || ""),
    ...tokenize(item.fit || ""),
    ...tokenize(item.material || "")
  ]);

  let s = 0;
  tokens.forEach((t) => {
    if (norm(p.title).includes(t)) s += 1;
  });
  return s;
}

function scoreCategory(p, item) {
  return countMatches(norm(p.title), getCategorySynonyms(item)) * 1.6;
}

function scoreDetails(p, item, slot) {
  const hay = norm(p.title);
  let s = 0;

  if (item.color && hay.includes(norm(item.color))) s += 1.2;
  if (item.fit && hay.includes(norm(item.fit))) s += 0.8;

  if (slot === "top") {
    if (item.sleeve_length && item.sleeve_length !== "none" && passesSleeveFilter(p, item)) s += 1.1;
    if (item.neckline && item.neckline !== "none" && passesNecklineFilter(p, item)) s += 1.1;
  }

  if (item.material && passesMaterialFilter(p, item, slot)) {
    s += (slot === "shoes" || slot === "bag" || slot === "outer") ? 1.2 : 0.8;
  }

  return s;
}

function rank(list, item, slot) {
  return list
    .map((p) => {
      const score =
        scoreText(p, item) +
        scoreCategory(p, item) +
        scoreDetails(p, item, slot) +
        scorePrice(p, slot) +
        scoreLuxury(p.title) +
        scoreTW(p);

      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}

// ===== 主 API =====
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.SERPAPI_API_KEY;
    const { items = [], locale = "tw", gender = "neutral", audience = "adult", styleTag } = req.body;
    const normalizedGender = normalizeGender(gender);
    const normalizedAudience = normalizeAudience(audience);

    const grouped = {};
    const debug = [];

    for (const item of items) {
      const slot = item.slot;
      const itemGender = normalizeGender(item.gender || normalizedGender);
      const itemAudience = normalizeAudience(item.audience || normalizedAudience);

      const zhQuery = buildZhQuery(item, { gender: itemGender, audience: itemAudience, styleTag, domainHint: false });
      const zhDomainQuery = null;
      const q = buildQuery(item, { locale, gender: itemGender, styleTag });

      // 中文台灣搜尋優先，但不再用 domain-hint 強搜，避免結果過少；
      // 英文原 query 永遠作為保底來源，防止 hard filter 後整組清空。
      const rawZh = await searchGoogle(apiKey, zhQuery, "tw", "zh-tw");
      const rawZhDomain = [];
      const rawGlobal = await searchGoogle(apiKey, q, "tw", "zh-tw");

      const seenRaw = new Set();
      const raw = [...rawZh, ...rawGlobal].filter((p) => {
        const key = p.product_link || p.link || p.title;
        if (!key || seenRaw.has(key)) return false;
        seenRaw.add(key);
        return true;
      });

      let list = raw.map((p) => ({
        title: p.title,
        link: p.product_link || p.link,
        thumbnail: p.thumbnail,
        price: p.price,
        extracted_price: p.extracted_price,
        merchant: p.source || p.merchant || "",
        source: "google"
      }));

      list = list.filter((x) => x.title && x.link && x.thumbnail);
      const baseList = [...list];
      const beforeCount = list.length;

      list = hardFilter(list, item, slot, itemGender, itemAudience);
      const afterHardFilterCount = list.length;

      let fallbackUsed = false;
      if (list.length === 0 && ["top", "outer", "bottom", "shoes", "bag"].includes(slot)) {
        list = softFallbackFilter(baseList, item, slot, itemGender, itemAudience);
        fallbackUsed = true;
      }

      let emergencyFallbackUsed = false;
      if (list.length === 0) {
        list = baseList
          .filter((p) => !isOppositeGenderProduct(p, itemGender))
          .filter((p) => !isForbiddenForSlot(p.title, slot, itemGender))
          .slice(0, 12);
        emergencyFallbackUsed = true;
      }

      const afterFallbackCount = list.length;
      const ranked = rank(list, item, slot);
      const localRanked = ranked.filter(isLikelyTaiwanProduct);
      const foreignRanked = ranked.filter((p) => !isLikelyTaiwanProduct(p));
      grouped[slot] = [...localRanked, ...foreignRanked].slice(0, 3);

      debug.push({
        slot,
        originalGender: item.gender || gender,
        normalizedGender: itemGender,
        originalAudience: item.audience || audience,
        normalizedAudience: itemAudience,
        query: q,
        zhQuery,
        zhDomainQuery,
        localCount: grouped[slot].filter(isLikelyTaiwanProduct).length,
        beforeCount,
        afterHardFilterCount,
        fallbackUsed,
        emergencyFallbackUsed,
        afterFallbackCount,
        top: grouped[slot].map((x) => ({
          title: x.title,
          score: x._score
        }))
      });
    }

    return res.json({
      ok: true,
      grouped,
      flat: Object.values(grouped).flat(),
      debug
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "search-products failed"
    });
  }
}
