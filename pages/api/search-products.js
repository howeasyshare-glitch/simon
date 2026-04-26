// pages/api/search-products.js
// V3.7 - Taiwan Query Pack + Faster Search + Better Debug
// 重點：
// 1. 台灣中文商品詞庫 2.0
// 2. bottom / top / outer 搜尋詞精準化
// 3. 每 slot 搜尋次數從 5 次降到 2~3 次
// 4. debug 直接回傳，方便從 data?op=products 檢查

export const config = { runtime: "nodejs" };

// ===== 基礎工具 =====
const safe = (v) => String(v || "").trim();
const norm = (v) => safe(v).toLowerCase();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const tokenize = (v) => norm(v).split(/[\s,./\-_"'()]+/).filter(Boolean);

const TARGET_PER_SLOT = 3;
const MIN_TW_PER_SLOT = 2;

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
  if (["male", "man", "men", "男性", "男", "boy", "boys", "男童"].includes(g)) return "male";
  if (["female", "woman", "women", "女性", "女", "girl", "girls", "女童"].includes(g)) return "female";
  if (["neutral", "unisex", "中性", "男女皆可"].includes(g)) return "neutral";
  return "neutral";
}

function normalizeAudience(input) {
  const a = norm(input);
  if (["kids", "kid", "child", "children", "boy", "girl", "兒童", "童裝", "小孩", "小童", "男童", "女童"].includes(a)) return "kids";
  return "adult";
}

// ===== 中文詞庫 =====
const ZH_COLOR_MAP = {
  navy: "海軍藍",
  "navy blue": "海軍藍",
  blue: "藍色",
  beige: "米色",
  khaki: "卡其色",
  cream: "米白色",
  white: "白色",
  black: "黑色",
  gray: "灰色",
  grey: "灰色",
  brown: "棕色",
  olive: "橄欖綠",
  "olive green": "橄欖綠",
  "dark olive green": "深橄欖綠",
  green: "綠色",
  "dark green": "深綠色",
  "forest green": "森林綠",
  "coffee brown": "咖啡色",
  "caramel brown": "焦糖棕",
  taupe: "灰褐色",
  "off-white": "米白色",
  "dark blue": "深藍色",
  "dark indigo": "深靛藍",
  "light blue": "淺藍色",
  "charcoal gray": "炭灰色",
  "charcoal grey": "炭灰色",
  burgundy: "酒紅色",
  red: "紅色",
};

const ZH_MATERIAL_MAP = {
  knit: "針織",
  "fine knit": "細針織",
  cotton: "棉質",
  "knit cotton": "針織棉",
  "cotton blend": "棉混紡",
  "cotton twill": "棉質斜紋",
  "cotton jersey": "棉質",
  "cotton blend fleece": "刷毛棉",
  "fleece cotton": "刷毛棉",
  denim: "牛仔",
  leather: "皮革",
  "faux leather": "皮革",
  canvas: "帆布",
  nylon: "尼龍",
  fleece: "刷毛",
  corduroy: "燈芯絨",
  polyester: "聚酯纖維",
  "polyester blend": "聚酯混紡",
  "mesh and synthetic": "網布 運動",
  "wool blend": "羊毛混紡",
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

function zhTerm(v, map) {
  const key = norm(v);
  return map[key] || safe(v);
}

function genderWord(gender, audience) {
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
  const s = norm(styleTag);
  if (s.includes("commute")) return "通勤";
  if (s.includes("casual")) return "休閒";
  if (s.includes("date")) return "約會";
  if (s.includes("outdoor")) return "戶外";
  if (s.includes("school")) return "上學";
  if (s.includes("birthday")) return "生日";
  if (s.includes("party")) return "派對";
  if (s.includes("coffee")) return "咖啡廳";
  return "";
}

function categoryZh(item) {
  const cat = norm(item.category || item.generic_name || item.display_name_zh || item.label || "");
  const slot = norm(item.slot || "");

  if (slot === "top") {
    if (cat.includes("knit polo")) return "針織Polo衫 長袖針織Polo衫 質感上衣";
    if (cat.includes("polo")) return "Polo衫 長袖Polo衫 上衣";
    if (cat.includes("fine-gauge knit")) return "細針織上衣 針織長袖上衣";
    if (cat.includes("ribbed knit")) return "羅紋針織上衣 長袖上衣";
    if (cat.includes("knit top")) return "針織上衣 長袖針織上衣";
    if (cat.includes("graphic long sleeve")) return "長袖圖案T恤 長袖上衣";
    if (cat.includes("graphic t-shirt")) return "圖案T恤 短袖上衣";
    if (cat.includes("short-sleeve") || cat.includes("short sleeve")) return "短袖T恤 短袖上衣";
    if (cat.includes("long-sleeve") || cat.includes("long sleeve")) return "長袖T恤 長袖上衣";
    if (cat.includes("t-shirt") || cat.includes("tee")) return "T恤 上衣";
    if (cat.includes("shirt")) return "襯衫 上衣";
    if (cat.includes("sweater")) return "針織衫 毛衣";
    return "上衣 T恤";
  }

  if (slot === "outer") {
    if (cat.includes("corduroy blazer")) return "燈芯絨西裝外套 女西外 西裝外套";
    if (cat.includes("blazer")) return "西裝外套 女西外 外套";
    if (cat.includes("corduroy overshirt")) return "燈芯絨襯衫外套 外套";
    if (cat.includes("overshirt")) return "襯衫外套 外套";
    if (cat.includes("bomber")) return "飛行外套 夾克 外套";
    if (cat.includes("hoodie")) return "連帽外套 拉鍊外套";
    if (cat.includes("cardigan")) return "針織外套 外套";
    if (cat.includes("fleece")) return "刷毛外套 外套";
    if (cat.includes("utility")) return "機能外套 工裝外套";
    return "外套 夾克";
  }

  if (slot === "bottom") {
    if (cat.includes("wide leg")) return "寬褲 打褶寬褲 西裝寬褲 長褲";
    if (cat.includes("pleated")) return "打褶寬褲 西裝褲 長褲";
    if (cat.includes("trousers")) return "長褲 西裝褲 寬褲";
    if (cat.includes("cargo")) return "工裝褲 機能褲 長褲";
    if (cat.includes("jogger")) return "慢跑褲 束口褲 長褲";
    if (cat.includes("jeans") || cat.includes("denim")) return "牛仔褲 直筒牛仔褲";
    if (cat.includes("shorts")) return "短褲";
    if (cat.includes("chino")) return "卡其褲 休閒褲 長褲";
    return "長褲 褲子";
  }

  if (slot === "shoes") {
    if (cat.includes("chelsea")) return "切爾西靴 短靴 皮靴";
    if (cat.includes("boot")) return "短靴 皮靴 靴子";
    if (cat.includes("loafer")) return "樂福鞋 皮鞋";
    if (cat.includes("trail")) return "越野跑鞋 戶外鞋 運動鞋";
    if (cat.includes("canvas")) return "帆布鞋 休閒鞋";
    if (cat.includes("sneaker")) return "休閒鞋 運動鞋";
    return "鞋子";
  }

  if (slot === "bag") {
    if (cat.includes("backpack")) return "後背包 書包";
    if (cat.includes("tote")) return "托特包 帆布包";
    if (cat.includes("messenger")) return "郵差包 斜背包";
    if (cat.includes("crossbody")) return "斜背包 側背包 小包";
    return "包包 斜背包";
  }

  return safe(item.display_name_zh || item.category || item.generic_name || "服裝");
}

function styleBoostWords(styleTag, slot) {
  const s = norm(styleTag);
  if (s.includes("outdoor")) {
    if (slot === "top") return "戶外 排汗 透氣 機能 休閒";
    if (slot === "bottom") return "戶外 工裝 機能 防潑水 休閒";
    if (slot === "outer") return "戶外 機能 防風 防潑水 輕量";
    if (slot === "shoes") return "戶外 越野 登山 防滑";
    if (slot === "bag") return "戶外 防潑水 機能 輕量";
  }
  if (s.includes("party")) {
    if (slot === "top") return "質感 俐落 派對";
    if (slot === "bottom") return "質感 寬褲 西裝褲 派對";
    if (slot === "outer") return "質感 西裝外套 派對";
    return "質感 派對";
  }
  if (s.includes("commute")) return "通勤 百搭 休閒";
  if (s.includes("school")) return "上學 舒適 耐穿";
  if (s.includes("birthday")) return "生日 活潑 舒適";
  return "";
}

function buildTaiwanQuery(item, { gender, audience, styleTag }) {
  const slot = norm(item.slot);
  const tokens = uniq([
    genderWord(gender, audience),
    zhTerm(item.color, ZH_COLOR_MAP),
    zhTerm(item.fit, ZH_FIT_MAP),
    zhTerm(item.material, ZH_MATERIAL_MAP),
    zhTerm(item.sleeve_length, ZH_SLEEVE_MAP),
    zhTerm(item.neckline, ZH_NECKLINE_MAP),
    categoryZh(item),
    styleZh(styleTag || item.style),
    styleBoostWords(styleTag || item.style, slot),
    "台灣 現貨 蝦皮 momo PChome Yahoo購物 Pinkoi 酷澎",
  ]);
  return tokens.join(" ");
}

function buildTaiwanShortQuery(item, { gender, audience, styleTag }) {
  const slot = norm(item.slot);
  const tokens = uniq([
    genderWord(gender, audience),
    zhTerm(item.color, ZH_COLOR_MAP),
    categoryZh(item),
    styleBoostWords(styleTag || item.style, slot),
    "台灣 蝦皮 momo PChome Yahoo購物 Pinkoi",
  ]);
  return tokens.join(" ");
}

function buildGlobalFallbackQuery(item, { locale, gender, styleTag }) {
  const useZH = locale === "tw";
  const g = gender === "male" ? (useZH ? "男裝" : "men") : gender === "female" ? (useZH ? "女裝" : "women") : "";
  const core = uniq([
    item.color,
    item.fit,
    item.material,
    item.sleeve_length,
    item.neckline,
    item.category || item.generic_name || item.display_name_zh,
    styleZh(styleTag || item.style),
  ]);
  return uniq([g, ...core]).filter(Boolean).join(" ");
}

// ===== SerpAPI =====
async function searchGoogle(apiKey, q, gl = "tw", hl = "zh-tw") {
  if (!apiKey) throw new Error("Missing SERPAPI_API_KEY");
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
    price: p.price,
    extracted_price: p.extracted_price,
    merchant: p.source || p.merchant || "",
    source: "google",
  };
}

function dedupeRawProducts(lists = []) {
  const seen = new Set();
  return lists.flat().filter((p) => {
    const key = p.product_link || p.link || p.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeNormalizedProducts(list = []) {
  const seen = new Set();
  return list.filter((p) => {
    const key = p.link || p.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ===== 類別同義詞 =====
function getCategorySynonyms(item) {
  const cat = norm(item.category || item.generic_name || item.display_name_zh);
  const slot = norm(item.slot);

  if (slot === "top") {
    if (cat.includes("knit polo")) return ["knit polo", "polo", "polo衫", "針織polo", "針織"];
    if (cat.includes("polo")) return ["polo", "polo shirt", "polo衫"];
    if (cat.includes("knit")) return ["knit", "針織", "針織上衣"];
    if (cat.includes("graphic")) return ["graphic", "圖案", "t-shirt", "tee", "t恤"];
    if (cat.includes("t-shirt") || cat.includes("tee")) return ["t-shirt", "tee", "t恤", "上衣"];
    if (cat.includes("shirt")) return ["shirt", "襯衫", "上衣"];
    if (cat.includes("sweater")) return ["sweater", "針織", "毛衣"];
    return ["上衣", "t恤", "shirt", "tee"];
  }

  if (slot === "outer") {
    if (cat.includes("blazer")) return ["blazer", "西裝外套", "西外", "外套"];
    if (cat.includes("corduroy")) return ["corduroy", "燈芯絨", "外套"];
    if (cat.includes("overshirt")) return ["overshirt", "襯衫外套", "外套"];
    if (cat.includes("bomber")) return ["bomber", "飛行外套", "夾克", "外套"];
    if (cat.includes("hoodie")) return ["hoodie", "連帽", "外套"];
    if (cat.includes("cardigan")) return ["cardigan", "針織外套", "外套"];
    return ["jacket", "outerwear", "外套", "夾克"];
  }

  if (slot === "bottom") {
    if (cat.includes("wide leg")) return ["wide leg", "寬褲", "寬腿", "長褲", "西裝褲"];
    if (cat.includes("trousers")) return ["trousers", "pants", "長褲", "褲", "西裝褲"];
    if (cat.includes("cargo")) return ["cargo", "工裝褲", "機能褲", "褲"];
    if (cat.includes("jogger")) return ["jogger", "慢跑褲", "束口褲", "褲"];
    if (cat.includes("jeans") || cat.includes("denim")) return ["jeans", "denim", "牛仔褲"];
    if (cat.includes("shorts")) return ["shorts", "短褲"];
    if (cat.includes("chino")) return ["chino", "卡其褲", "休閒褲", "褲"];
    return ["pants", "trousers", "褲", "長褲"];
  }

  if (slot === "shoes") {
    if (cat.includes("chelsea")) return ["chelsea", "切爾西", "短靴", "靴"];
    if (cat.includes("boot")) return ["boot", "boots", "靴", "短靴"];
    if (cat.includes("loafer")) return ["loafer", "樂福鞋"];
    if (cat.includes("trail")) return ["trail", "越野", "跑鞋", "運動鞋"];
    if (cat.includes("sneaker")) return ["sneaker", "休閒鞋", "運動鞋"];
    return ["shoes", "鞋"];
  }

  if (slot === "bag") {
    if (cat.includes("crossbody")) return ["crossbody", "斜背包", "側背包", "包"];
    if (cat.includes("backpack")) return ["backpack", "後背包", "書包"];
    if (cat.includes("tote")) return ["tote", "托特包", "帆布包"];
    if (cat.includes("messenger")) return ["messenger", "郵差包", "斜背包"];
    return ["bag", "包"];
  }

  return [];
}

function slotSoftKeywords(slot, item) {
  return getCategorySynonyms(item);
}

function passesCategoryFilter(p, item, slot, mode = "strict") {
  const hay = norm(`${p.title || ""} ${p.merchant || ""}`);
  const words = getCategorySynonyms(item);
  if (!words.length) return true;

  if (mode === "soft") {
    return words.some((w) => hay.includes(norm(w)));
  }

  return words.some((w) => hay.includes(norm(w)));
}

function passesSleeveFilter(p, item) {
  const hay = norm(p.title);
  const s = norm(item.sleeve_length);

  if (!s || s === "none") return true;
  if (s === "long sleeve") return containsAny(hay, ["long sleeve", "long-sleeve", "長袖"]);
  if (s === "short sleeve") return containsAny(hay, ["short sleeve", "short-sleeve", "短袖"]);
  if (s === "sleeveless") return containsAny(hay, ["sleeveless", "無袖"]);
  return true;
}

function passesMaterialFilter(p, item, slot) {
  const hay = norm(p.title);
  const m = norm(item.material);

  if (!m || m === "none") return true;

  if (slot === "top" || slot === "bottom" || slot === "outer") {
    if (m.includes("fine knit")) return containsAny(hay, ["knit", "針織", "細針織"]);
    if (m.includes("cotton blend")) return containsAny(hay, ["cotton", "blend", "棉"]);
    if (m.includes("knit cotton")) return containsAny(hay, ["knit", "cotton", "針織", "棉"]);
    if (m.includes("cotton twill")) return containsAny(hay, ["cotton", "twill", "棉", "斜紋"]);
    if (m.includes("denim")) return containsAny(hay, ["denim", "jeans", "牛仔"]);
    if (m.includes("fleece")) return containsAny(hay, ["fleece", "刷毛", "搖粒絨"]);
    if (m.includes("corduroy")) return containsAny(hay, ["corduroy", "燈芯絨"]);
    if (m.includes("polyester")) return true;
    return hay.includes(m) || containsAny(hay, tokenize(m));
  }

  if (m.includes("leather")) return containsAny(hay, ["leather", "皮革", "真皮", "pu"]);
  if (m.includes("canvas")) return containsAny(hay, ["canvas", "帆布"]);
  if (m.includes("nylon")) return containsAny(hay, ["nylon", "尼龍"]);
  return hay.includes(m) || containsAny(hay, tokenize(m));
}

function passesNecklineFilter(p, item) {
  const hay = norm(p.title);
  const n = norm(item.neckline);

  if (!n || n === "none") return true;
  if (n === "crew neck") return containsAny(hay, ["crew neck", "圓領", "round neck"]);
  if (n === "polo collar") return containsAny(hay, ["polo", "polo shirt", "polo衫"]);
  if (n === "shirt collar") return containsAny(hay, ["shirt", "button-up", "button down", "collar", "襯衫"]);
  if (n === "hooded") return containsAny(hay, ["hoodie", "hooded", "連帽"]);
  if (n === "lapel collar") return containsAny(hay, ["lapel", "blazer", "西裝", "翻領"]);
  return true;
}

// ===== 排除規則 =====
function isOppositeGenderProduct(p, gender) {
  const hay = norm(`${p.title || ""} ${p.merchant || ""} ${p.link || ""}`);

  const femaleWords = ["women", "woman", "womens", "ladies", "lady", "girl", "girls", "女裝", "女款", "女生", "婦女", "womenswear"];
  const maleWords = ["men", "man", "mens", "boy", "boys", "男裝", "男款", "男生", "menswear"];

  if (gender === "male") return femaleWords.some((w) => hay.includes(norm(w)));
  if (gender === "female") return maleWords.some((w) => hay.includes(norm(w)));
  return false;
}

function isWrongAudienceProduct(p, audience) {
  const hay = norm(`${p.title || ""} ${p.merchant || ""} ${p.link || ""}`);
  const kidsWords = ["童裝", "兒童", "男童", "女童", "小童", "kids", "kid", "children", "child", "boys", "girls"];

  if (audience === "adult") return kidsWords.some((w) => hay.includes(norm(w)));
  return false;
}

function isForbiddenForSlot(title, slot, gender) {
  const t = norm(title);

  const maleForbidden = ["bra", "bralette", "crop top", "skirt", "dress", "bikini", "panties", "heels", "blouse", "one-piece swimsuit", "swimsuit", "lingerie"];
  if (gender === "male" && maleForbidden.some((w) => t.includes(w))) return true;

  if (slot === "top" && ["skirt", "dress", "panties", "bikini bottom", "bottom"].some((w) => t.includes(w))) return true;
  if (slot === "outer" && ["skirt", "dress", "panties", "bikini", "bra"].some((w) => t.includes(w))) return true;
  if (slot === "bottom" && ["bra", "bralette", "top", "dress", "heel", "shoe", "bikini bottom"].some((w) => t.includes(w))) return true;
  if (slot === "shoes" && ["bra", "shirt", "top", "dress", "bag", "pant", "pants"].some((w) => t.includes(w))) return true;
  if (slot === "bag" && ["shoe", "shirt", "pants", "dress", "bra", "bikini"].some((w) => t.includes(w))) return true;

  return false;
}

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

    if (["outer", "bottom", "shoes", "bag"].includes(slot)) {
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
    return true;
  });
}

// ===== 台灣站判斷與排序 =====
function getLocalityScore(p) {
  const t = norm(`${p.title || ""} ${p.merchant || ""} ${p.link || ""}`);

  const strongTW = [
    "shopee.tw",
    "蝦皮",
    "momo",
    "momoshop",
    "momo購物",
    "pchome",
    "24h",
    "tw.mall.yahoo",
    "tw.buy.yahoo",
    "yahoo購物",
    "yahoo奇摩",
    "pinkoi",
    "coupang",
    "酷澎",
    "next taiwan",
    "hay taiwan",
    "packup.com.tw",
    "媽咪愛",
    "bigsave.com.tw",
    "oneshoe",
    "馬拉松世界",
    "hillmalaya",
    ".tw/",
    ".com.tw",
  ];

  const okAsia = ["rakuten", "uniqlo", "gu", "zara", "muji", "淘寶", "韓國", "日本", "wconcept", "lewkin", "tudoholic"];
  const weakForeign = ["ebay", "etsy", "poshmark", "mercari", "depop", "vestiaire", "farfetch", "ssense", "made-in-china"];

  if (strongTW.some((h) => t.includes(norm(h)))) return 20;
  if (okAsia.some((h) => t.includes(norm(h)))) return 2;
  if (weakForeign.some((h) => t.includes(norm(h)))) return -12;
  return 0;
}

function isLikelyTaiwanProduct(p) {
  return getLocalityScore(p) >= 20;
}

function scorePrice(p, slot) {
  const price = Number(p.extracted_price || 0);
  if (!price) return 0;

  const cap = { top: 2000, outer: 3500, bottom: 2500, shoes: 3500, bag: 2500 }[slot] || 2500;
  if (price < cap * 0.6) return 1;
  if (price < cap) return 0.5;
  if (price < cap * 1.5) return -0.5;
  return -2;
}

function scoreLuxury(title) {
  const t = norm(title);
  return ["off-white", "balenciaga", "gucci", "prada", "ssense"].some((x) => t.includes(x)) ? -3 : 0;
}

function scoreText(p, item) {
  const title = norm(`${p.title || ""} ${p.merchant || ""}`);
  const tokens = uniq([
    ...tokenize(item.generic_name || ""),
    ...tokenize(item.display_name_zh || ""),
    ...tokenize(item.category || ""),
    ...tokenize(item.color || ""),
    ...tokenize(item.fit || ""),
    ...tokenize(item.material || ""),
  ]);

  return tokens.reduce((s, t) => (title.includes(t) ? s + 1 : s), 0);
}

function scoreCategory(p, item) {
  return countMatches(`${p.title || ""} ${p.merchant || ""}`, getCategorySynonyms(item)) * 1.8;
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
    s += ["shoes", "bag", "outer"].includes(slot) ? 1.2 : 0.8;
  }

  return s;
}

function rank(list, item, slot) {
  return list
    .map((p) => ({
      ...p,
      _score:
        scoreText(p, item) +
        scoreCategory(p, item) +
        scoreDetails(p, item, slot) +
        scorePrice(p, slot) +
        scoreLuxury(p.title) +
        getLocalityScore(p),
    }))
    .sort((a, b) => b._score - a._score);
}

function productDebug(p) {
  return {
    title: p.title,
    merchant: p.merchant,
    isTaiwan: isLikelyTaiwanProduct(p),
    localityScore: getLocalityScore(p),
    score: p._score,
  };
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

      const taiwanQuery = buildTaiwanQuery(item, {
        gender: itemGender,
        audience: itemAudience,
        styleTag,
      });

      const taiwanShortQuery = buildTaiwanShortQuery(item, {
        gender: itemGender,
        audience: itemAudience,
        styleTag,
      });

      const globalFallbackQuery = buildGlobalFallbackQuery(item, {
        locale,
        gender: itemGender,
        styleTag,
      });

      // V3.7：先跑 2 組台灣中文 query，只有不足時才補英文/global fallback。
      const [rawTaiwanMain, rawTaiwanShort] = await Promise.all([
        searchGoogle(apiKey, taiwanQuery, "tw", "zh-tw"),
        searchGoogle(apiKey, taiwanShortQuery, "tw", "zh-tw"),
      ]);

      let rawGlobal = [];
      let globalFallbackUsed = false;

      const initialRaw = dedupeRawProducts([rawTaiwanMain, rawTaiwanShort]);
      const initialList = initialRaw
        .map(normalizeGoogleProduct)
        .filter((x) => x.title && x.link && x.thumbnail);

      const initialTaiwanCount = initialList.filter(isLikelyTaiwanProduct).length;

      if (initialList.length < 8 || initialTaiwanCount < MIN_TW_PER_SLOT) {
        rawGlobal = await searchGoogle(apiKey, globalFallbackQuery, "tw", "zh-tw");
        globalFallbackUsed = true;
      }

      const raw = dedupeRawProducts([rawTaiwanMain, rawTaiwanShort, rawGlobal]);
      const baseList = raw
        .map(normalizeGoogleProduct)
        .filter((x) => x.title && x.link && x.thumbnail);

      const beforeCount = baseList.length;
      const rawTaiwanCount = baseList.filter(isLikelyTaiwanProduct).length;

      let list = hardFilter(baseList, item, slot, itemGender, itemAudience);
      const afterHardFilterCount = list.length;
      const afterHardFilterTaiwanCount = list.filter(isLikelyTaiwanProduct).length;

      let fallbackUsed = false;
      if (list.length === 0 && ["top", "outer", "bottom", "shoes", "bag"].includes(slot)) {
        list = softFallbackFilter(baseList, item, slot, itemGender, itemAudience);
        fallbackUsed = true;
      }

      let emergencyFallbackUsed = false;
      if (list.length === 0) {
        list = baseList
          .filter((p) => !isOppositeGenderProduct(p, itemGender))
          .filter((p) => !isWrongAudienceProduct(p, itemAudience))
          .filter((p) => !isForbiddenForSlot(p.title, slot, itemGender))
          .slice(0, 12);
        emergencyFallbackUsed = true;
      }

      const afterFallbackCount = list.length;
      const afterFallbackTaiwanCount = list.filter(isLikelyTaiwanProduct).length;

      let ranked = rank(list, item, slot);
      let localRanked = ranked.filter(isLikelyTaiwanProduct);
      let foreignRanked = ranked.filter((p) => !isLikelyTaiwanProduct(p));
      let finalList = [...localRanked, ...foreignRanked];

      let taiwanSupplementUsed = false;
      if (finalList.filter(isLikelyTaiwanProduct).length < MIN_TW_PER_SLOT) {
        const existing = new Set(finalList.map((p) => p.link || p.title));
        const twFillers = rank(
          baseList
            .filter(isLikelyTaiwanProduct)
            .filter((p) => !existing.has(p.link || p.title))
            .filter((p) => !isOppositeGenderProduct(p, itemGender))
            .filter((p) => !isWrongAudienceProduct(p, itemAudience))
            .filter((p) => !isForbiddenForSlot(p.title, slot, itemGender))
            .filter((p) => passesCategoryFilter(p, item, slot, "soft")),
          item,
          slot
        );

        if (twFillers.length > 0) {
          finalList = [...twFillers, ...finalList];
          taiwanSupplementUsed = true;
        }
      }

      let fillerUsed = false;
      if (finalList.length < TARGET_PER_SLOT) {
        const existing = new Set(finalList.map((p) => p.link || p.title));
        const fillers = rank(
          baseList
            .filter((p) => !existing.has(p.link || p.title))
            .filter((p) => !isOppositeGenderProduct(p, itemGender))
            .filter((p) => !isWrongAudienceProduct(p, itemAudience))
            .filter((p) => !isForbiddenForSlot(p.title, slot, itemGender))
            .filter((p) => passesCategoryFilter(p, item, slot, "soft")),
          item,
          slot
        );

        if (fillers.length > 0) fillerUsed = true;
        finalList = [...finalList, ...fillers];
      }

      grouped[slot] = dedupeNormalizedProducts(finalList)
        .sort((a, b) => {
          const twDelta = Number(isLikelyTaiwanProduct(b)) - Number(isLikelyTaiwanProduct(a));
          if (twDelta !== 0) return twDelta;
          return (b._score || 0) - (a._score || 0);
        })
        .slice(0, TARGET_PER_SLOT);

      const finalTaiwanCount = grouped[slot].filter(isLikelyTaiwanProduct).length;

      const debugEntry = {
        version: "V3.7 Taiwan Query Pack + Faster Search",
        slot,
        label: item.display_name_zh || item.generic_name || item.category || "",
        category: item.category || "",
        originalGender: item.gender || gender,
        normalizedGender: itemGender,
        originalAudience: item.audience || audience,
        normalizedAudience: itemAudience,
        queries: {
          taiwanQuery,
          taiwanShortQuery,
          globalFallbackQuery,
        },
        counts: {
          rawTaiwanMain: rawTaiwanMain.length,
          rawTaiwanShort: rawTaiwanShort.length,
          rawGlobal: rawGlobal.length,
          rawDeduped: raw.length,
          beforeFilter: beforeCount,
          rawTaiwan: rawTaiwanCount,
          afterHardFilter: afterHardFilterCount,
          afterHardFilterTaiwan: afterHardFilterTaiwanCount,
          afterFallback: afterFallbackCount,
          afterFallbackTaiwan: afterFallbackTaiwanCount,
          final: grouped[slot].length,
          finalTaiwan: finalTaiwanCount,
        },
        flags: {
          globalFallbackUsed,
          fallbackUsed,
          emergencyFallbackUsed,
          taiwanSupplementUsed,
          fillerUsed,
        },
        finalTop3: grouped[slot].map(productDebug),
        rawTop5: baseList.slice(0, 5).map((x) => ({
          title: x.title,
          merchant: x.merchant,
          isTaiwan: isLikelyTaiwanProduct(x),
        })),
      };

      console.log("[search-products V3.7 debug]", JSON.stringify(debugEntry));
      debug.push(debugEntry);
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
      error: e?.message || "search-products failed",
    });
  }
}
