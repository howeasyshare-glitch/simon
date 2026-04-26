// pages/api/search-products.js
// V3.6 DEBUG + Taiwan Boost

export const config = { runtime: "nodejs" };

// ===== utils =====
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

// ===== zh dictionaries =====
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
  red: "紅色",
};

const ZH_MATERIAL_MAP = {
  knit: "針織",
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

const ZH_CATEGORY_MAP = [
  ["graphic long sleeve t-shirt", "長袖圖案T恤"],
  ["graphic t-shirt", "圖案T恤"],
  ["short-sleeve t-shirt", "短袖T恤"],
  ["short sleeve t-shirt", "短袖T恤"],
  ["long sleeve t-shirt", "長袖T恤"],
  ["crew neck t-shirt", "圓領T恤"],
  ["t-shirt", "T恤"],
  ["tee", "T恤"],
  ["knit polo", "針織Polo衫"],
  ["polo shirt", "Polo衫"],
  ["button-up shirt", "襯衫"],
  ["button up shirt", "襯衫"],
  ["ribbed knit", "羅紋針織上衣"],
  ["fine-gauge knit", "細針織上衣"],
  ["knit top", "針織上衣"],
  ["sweater", "針織衫"],
  ["corduroy overshirt", "燈芯絨襯衫外套"],
  ["overshirt", "襯衫外套"],
  ["zip-up hoodie", "拉鍊連帽外套"],
  ["hoodie", "連帽外套"],
  ["nylon bomber jacket", "尼龍飛行外套"],
  ["bomber jacket", "飛行外套"],
  ["utility jacket", "機能外套"],
  ["fleece jacket", "刷毛外套"],
  ["cardigan", "針織外套"],
  ["blazer", "西裝外套"],
  ["jacket", "外套"],
  ["straight leg jeans", "直筒牛仔褲"],
  ["straight-leg jeans", "直筒牛仔褲"],
  ["jeans", "牛仔褲"],
  ["denim shorts", "丹寧短褲"],
  ["chino shorts", "卡其短褲"],
  ["shorts", "短褲"],
  ["straight leg chinos", "直筒休閒褲"],
  ["chino", "卡其褲"],
  ["cargo pants", "工裝褲"],
  ["cargo", "工裝褲"],
  ["joggers", "慢跑褲"],
  ["wide leg trousers", "寬褲"],
  ["trousers", "長褲"],
  ["trail running shoes", "越野跑鞋"],
  ["trail", "越野鞋"],
  ["leather sneakers", "皮革休閒鞋"],
  ["canvas sneakers", "帆布休閒鞋"],
  ["sneaker", "休閒鞋"],
  ["loafers", "樂福鞋"],
  ["loafer", "樂福鞋"],
  ["boot", "靴子"],
  ["backpack", "後背包"],
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
  const s = norm(styleTag);
  if (s.includes("commute")) return "通勤 穿搭";
  if (s.includes("casual")) return "休閒 穿搭";
  if (s.includes("date")) return "約會 穿搭";
  if (s.includes("outdoor")) return "戶外 穿搭";
  if (s.includes("school")) return "上學 穿搭";
  if (s.includes("birthday")) return "生日 穿搭";
  if (s.includes("party")) return "派對 穿搭";
  return "";
}

function slotZhWords(slot, item = {}) {
  const cat = norm(item.category || item.generic_name || item.display_name_zh || "");
  if (slot === "top") {
    if (cat.includes("polo")) return "Polo衫 上衣";
    if (cat.includes("knit")) return "針織上衣 長袖上衣";
    if (cat.includes("graphic")) return "圖案T恤 上衣";
    if (cat.includes("long")) return "長袖T恤 上衣";
    if (cat.includes("short")) return "短袖T恤 上衣";
    return "上衣 T恤";
  }
  if (slot === "outer") {
    if (cat.includes("hoodie")) return "連帽外套 拉鍊外套";
    if (cat.includes("bomber")) return "飛行外套 夾克";
    if (cat.includes("overshirt")) return "襯衫外套 外套";
    if (cat.includes("blazer")) return "西裝外套 外套";
    return "外套 夾克";
  }
  if (slot === "bottom") {
    if (cat.includes("cargo")) return "工裝褲 機能褲 長褲";
    if (cat.includes("jogger")) return "慢跑褲 束口褲 長褲";
    if (cat.includes("jeans") || cat.includes("denim")) return "牛仔褲 長褲";
    if (cat.includes("shorts")) return "短褲";
    if (cat.includes("wide")) return "寬褲 長褲";
    return "長褲 褲子";
  }
  if (slot === "shoes") {
    if (cat.includes("trail")) return "越野跑鞋 運動鞋 戶外鞋";
    if (cat.includes("canvas")) return "帆布鞋 休閒鞋";
    if (cat.includes("loafer")) return "樂福鞋";
    if (cat.includes("boot")) return "靴子 厚底靴";
    return "休閒鞋 運動鞋";
  }
  if (slot === "bag") {
    if (cat.includes("backpack")) return "後背包 書包";
    if (cat.includes("tote")) return "托特包 帆布包";
    if (cat.includes("messenger")) return "郵差包 斜背包";
    return "斜背包 側背包 小包";
  }
  return "";
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
  if (s.includes("commute")) return "通勤 百搭 休閒";
  if (s.includes("party")) return "派對 質感 俐落";
  if (s.includes("school")) return "上學 舒適 耐穿";
  if (s.includes("birthday")) return "生日 活潑 舒適";
  return "";
}

function buildZhQuery(item, { gender, audience, styleTag, domainHint = false }) {
  const slot = norm(item.slot);
  const tokens = uniq([
    audienceGenderWord(gender, audience),
    zhTerm(item.color, ZH_COLOR_MAP),
    zhTerm(item.fit, ZH_FIT_MAP),
    zhTerm(item.material, ZH_MATERIAL_MAP),
    zhTerm(item.sleeve_length, ZH_SLEEVE_MAP),
    zhTerm(item.neckline, ZH_NECKLINE_MAP),
    categoryZh(item),
    slotZhWords(slot, item),
    styleZh(styleTag || item.style),
    styleBoostWords(styleTag || item.style, slot),
    domainHint
      ? "蝦皮 momo PChome Yahoo購物 Pinkoi 酷澎 台灣 現貨"
      : "台灣 現貨 蝦皮 momo PChome Yahoo購物 Pinkoi 酷澎",
  ]);
  return tokens.filter(Boolean).join(" ");
}

function buildTaiwanBoostQuery(item, { gender, audience, styleTag }) {
  const slot = norm(item.slot);
  const tokens = uniq([
    audienceGenderWord(gender, audience),
    zhTerm(item.color, ZH_COLOR_MAP),
    slotZhWords(slot, item),
    categoryZh(item),
    styleBoostWords(styleTag || item.style, slot),
    "台灣 現貨 蝦皮 momo PChome Yahoo購物 Pinkoi 酷澎",
  ]);
  return tokens.filter(Boolean).join(" ");
}

function buildQuery(item, { locale, gender, styleTag }) {
  const useZH = locale === "tw";
  const genderWord = gender === "male" ? (useZH ? "男裝" : "men") : gender === "female" ? (useZH ? "女裝" : "women") : "";
  const style = styleZh(styleTag || item.style);
  const core = uniq([item.color, item.fit, item.material, item.sleeve_length, item.neckline, item.category || item.generic_name || item.display_name_zh]);
  return uniq([genderWord, ...core, style]).filter(Boolean).join(" ");
}

function buildTaiwanFirstQuery(q) {
  return `${q} 台灣 現貨 蝦皮 momo PChome Yahoo購物 Pinkoi 酷澎`;
}

// ===== search =====
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

function dedupeProducts(lists = []) {
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

// ===== category synonyms =====
function getCategorySynonyms(item) {
  const cat = norm(item.category || item.generic_name || item.display_name_zh);
  const slot = norm(item.slot);

  if (cat.includes("knit polo") || cat.includes("polo shirt")) return ["polo", "polo shirt", "knit polo", "polo衫"];
  if (cat.includes("button-up shirt") || cat.includes("button up shirt")) return ["button-up shirt", "button down shirt", "shirt", "oxford shirt", "襯衫"];
  if (cat.includes("graphic long sleeve")) return ["graphic long sleeve", "long sleeve t-shirt", "graphic tee", "t-shirt", "長袖", "T恤"];
  if (cat.includes("graphic t-shirt")) return ["graphic t-shirt", "graphic tee", "t-shirt", "tee", "圖案", "T恤"];
  if (cat.includes("long-sleeve t-shirt") || cat.includes("long sleeve t-shirt")) return ["long sleeve t-shirt", "long-sleeve tee", "t-shirt", "tee", "長袖", "T恤"];
  if (cat.includes("short-sleeve t-shirt") || cat.includes("short sleeve t-shirt")) return ["short sleeve t-shirt", "short-sleeve tee", "t-shirt", "tee", "短袖", "T恤"];
  if (cat.includes("t-shirt") || cat.includes("tee")) return ["t-shirt", "tee", "T恤"];
  if (cat.includes("knit top") || cat.includes("fine-gauge knit") || cat.includes("ribbed knit")) return ["knit top", "knit", "ribbed", "針織", "針織上衣"];
  if (cat.includes("shirt")) return ["shirt", "button-up shirt", "button down shirt", "襯衫"];
  if (cat.includes("sweater")) return ["sweater", "knit sweater", "pullover", "針織"];

  if (cat.includes("overshirt")) return ["overshirt", "shirt jacket", "jacket", "outerwear", "襯衫外套", "外套"];
  if (cat.includes("bomber")) return ["bomber jacket", "flight jacket", "jacket", "outerwear", "飛行外套", "夾克"];
  if (cat.includes("blazer")) return ["blazer", "jacket", "suit jacket", "西裝外套"];
  if (cat.includes("cardigan")) return ["cardigan", "knit cardigan", "sweater cardigan", "針織外套"];
  if (cat.includes("hoodie")) return ["hoodie", "hooded sweatshirt", "zip hoodie", "連帽", "外套"];
  if (cat.includes("utility jacket")) return ["utility jacket", "jacket", "outerwear", "機能外套"];
  if (cat.includes("fleece jacket")) return ["fleece jacket", "jacket", "outerwear", "fleece", "刷毛"];
  if (cat.includes("jacket") || cat.includes("outer")) return ["jacket", "outerwear", "coat", "外套", "夾克"];

  if (cat.includes("jeans") || cat.includes("denim")) return ["jeans", "denim", "straight jeans", "denim pants", "牛仔褲"];
  if (cat.includes("chino")) return ["chinos", "chino", "trousers", "pants", "卡其褲", "休閒褲"];
  if (cat.includes("shorts")) return ["shorts", "短褲"];
  if (cat.includes("jogger")) return ["joggers", "jogger", "sweatpants", "pants", "慢跑褲", "束口褲"];
  if (cat.includes("cargo")) return ["cargo pants", "cargo", "utility pants", "pants", "工裝褲"];
  if (cat.includes("wide leg") || cat.includes("trousers")) return ["trousers", "pants", "wide leg", "長褲", "寬褲"];

  if (cat.includes("loafer")) return ["loafer", "loafers", "slip-on", "樂福鞋"];
  if (cat.includes("trail")) return ["trail shoes", "trail running", "running shoes", "越野", "運動鞋"];
  if (cat.includes("sneaker")) return ["sneaker", "sneakers", "trainer", "casual shoes", "休閒鞋", "運動鞋"];
  if (cat.includes("boot")) return ["boot", "boots", "靴"];

  if (cat.includes("backpack")) return ["backpack", "school bag", "後背包", "書包"];
  if (cat.includes("crossbody")) return ["crossbody", "crossbody bag", "shoulder bag", "斜背包", "側背包"];
  if (cat.includes("messenger")) return ["messenger bag", "crossbody", "shoulder bag", "郵差包"];
  if (cat.includes("tote")) return ["tote", "tote bag", "托特包", "帆布包"];
  if (cat.includes("bag")) return ["bag", "crossbody", "tote", "messenger", "包"];

  if (slot === "top") return ["shirt", "tee", "polo", "sweater", "上衣", "T恤"];
  if (slot === "outer") return ["jacket", "outerwear", "coat", "cardigan", "hoodie", "外套"];
  if (slot === "bottom") return ["pants", "trousers", "jeans", "shorts", "chino", "褲"];
  if (slot === "shoes") return ["shoes", "sneaker", "trainer", "loafer", "boot", "鞋"];
  if (slot === "bag") return ["bag", "crossbody", "tote", "messenger", "shoulder", "包"];
  return [];
}

function slotStrictKeywords(slot, item) {
  return getCategorySynonyms(item);
}

function slotSoftKeywords(slot, item) {
  const cat = norm(item.category || "");
  if (slot === "top") {
    if (cat.includes("polo")) return ["polo", "shirt", "knit", "上衣"];
    if (cat.includes("shirt")) return ["shirt", "button", "襯衫", "上衣"];
    if (cat.includes("t-shirt") || cat.includes("tee")) return ["t-shirt", "tee", "T恤", "上衣"];
    if (cat.includes("knit") || cat.includes("sweater")) return ["sweater", "knit", "針織", "上衣"];
    return ["shirt", "tee", "polo", "sweater", "上衣", "T恤"];
  }
  if (slot === "outer") {
    if (cat.includes("cardigan")) return ["cardigan", "knit", "外套"];
    if (cat.includes("hoodie")) return ["hoodie", "連帽", "外套"];
    if (cat.includes("jacket") || cat.includes("bomber") || cat.includes("overshirt")) return ["jacket", "outerwear", "外套", "夾克"];
    if (cat.includes("blazer")) return ["blazer", "jacket", "西裝外套"];
    return ["jacket", "outerwear", "coat", "cardigan", "hoodie", "外套"];
  }
  if (slot === "bottom") {
    if (cat.includes("jeans") || cat.includes("denim")) return ["jeans", "denim", "牛仔褲"];
    if (cat.includes("shorts")) return ["shorts", "短褲"];
    if (cat.includes("cargo")) return ["cargo", "pants", "工裝褲", "褲"];
    if (cat.includes("jogger")) return ["jogger", "pants", "慢跑褲", "褲"];
    return ["pants", "trousers", "chino", "jeans", "shorts", "褲"];
  }
  if (slot === "shoes") return ["sneaker", "shoe", "trainer", "loafer", "boot", "鞋"];
  if (slot === "bag") return ["bag", "crossbody", "messenger", "tote", "shoulder", "包"];
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
    if (m.includes("cotton linen")) return containsAny(hay, ["cotton", "linen", "棉麻"]);
    if (m.includes("cotton blend")) return containsAny(hay, ["cotton", "blend", "棉"]);
    if (m.includes("knit cotton")) return containsAny(hay, ["knit", "cotton", "針織", "棉"]);
    if (m.includes("cotton twill")) return containsAny(hay, ["cotton", "twill", "棉", "斜紋"]);
    if (m.includes("denim")) return containsAny(hay, ["denim", "jeans", "牛仔"]);
    if (m.includes("fleece")) return containsAny(hay, ["fleece", "刷毛", "搖粒絨"]);
    if (m.includes("corduroy")) return containsAny(hay, ["corduroy", "燈芯絨"]);
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
  if (n === "polo collar") return containsAny(hay, ["polo", "polo shirt"]);
  if (n === "shirt collar") return containsAny(hay, ["shirt", "button-up", "button down", "collar", "襯衫"]);
  if (n === "hooded") return containsAny(hay, ["hoodie", "hooded", "連帽"]);
  if (n === "lapel collar") return containsAny(hay, ["lapel", "blazer", "西裝"]);
  return true;
}

// ===== product filters =====
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
    if (slot === "top") return passesSleeveFilter(p, item) && passesNecklineFilter(p, item);
    if (["outer", "bottom", "shoes", "bag"].includes(slot)) return passesMaterialFilter(p, item, slot);
    return true;
  });
}

function softFallbackFilter(list, item, slot, gender, audience) {
  return list.filter((p) => {
    if (isOppositeGenderProduct(p, gender)) return false;
    if (isWrongAudienceProduct(p, audience)) return false;
    if (isForbiddenForSlot(p.title, slot, gender)) return false;
    if (!passesCategoryFilter(p, item, slot, "soft")) return false;
    if (slot === "top") return passesSleeveFilter(p, item);
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
  const strongTW = ["shopee.tw", "蝦皮", "momo", "momoshop", "momo購物", "pchome", "24h", "tw.mall.yahoo", "tw.buy.yahoo", "yahoo購物", "yahoo奇摩", "pinkoi", "coupang", "酷澎", "next taiwan", "hay taiwan", "packup.com.tw", "媽咪愛", "oneshoe", "馬拉松世界", "hillmalaya", ".tw/", ".com.tw"];
  const okAsia = ["rakuten", "uniqlo", "gu", "zara", "muji", "淘寶", "韓國", "日本", "wconcept", "lewkin", "tudoholic"];
  const weakForeign = ["ebay", "etsy", "poshmark", "mercari", "depop", "vestiaire", "farfetch", "ssense", "made-in-china"];
  if (strongTW.some((h) => t.includes(norm(h)))) return 16;
  if (okAsia.some((h) => t.includes(norm(h)))) return 2;
  if (weakForeign.some((h) => t.includes(norm(h)))) return -10;
  return 0;
}

function isLikelyTaiwanProduct(p) {
  return getLocalityScore(p) >= 16;
}

function scoreText(p, item) {
  const tokens = uniq([
    ...tokenize(item.generic_name || ""),
    ...tokenize(item.display_name_zh || ""),
    ...tokenize(item.category || ""),
    ...tokenize(item.color || ""),
    ...tokenize(item.fit || ""),
    ...tokenize(item.material || ""),
  ]);
  return tokens.reduce((s, t) => (norm(p.title).includes(t) ? s + 1 : s), 0);
}

function scoreCategory(p, item) {
  return countMatches(norm(`${p.title || ""} ${p.merchant || ""}`), getCategorySynonyms(item)) * 1.6;
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
  if (item.material && passesMaterialFilter(p, item, slot)) s += ["shoes", "bag", "outer"].includes(slot) ? 1.2 : 0.8;
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

// ===== main API =====
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
      const zhBoostQuery = buildTaiwanBoostQuery(item, { gender: itemGender, audience: itemAudience, styleTag });
      const zhDomainQuery = buildZhQuery(item, { gender: itemGender, audience: itemAudience, styleTag, domainHint: true });
      const q = buildQuery(item, { locale, gender: itemGender, styleTag });
      const globalTaiwanQuery = buildTaiwanFirstQuery(q);

      const rawZh = await searchGoogle(apiKey, zhQuery, "tw", "zh-tw");
      const rawTWBoost = await searchGoogle(apiKey, zhBoostQuery, "tw", "zh-tw");
      const rawZhDomain = await searchGoogle(apiKey, zhDomainQuery, "tw", "zh-tw");
      const rawGlobalTaiwan = await searchGoogle(apiKey, globalTaiwanQuery, "tw", "zh-tw");
      const rawGlobal = await searchGoogle(apiKey, q, "tw", "zh-tw");

      const raw = dedupeProducts([rawZh, rawTWBoost, rawZhDomain, rawGlobalTaiwan, rawGlobal]);
      const baseList = raw.map(normalizeGoogleProduct).filter((x) => x.title && x.link && x.thumbnail);
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
        version: "V3.6 DEBUG + Taiwan Boost",
        slot,
        label: item.display_name_zh || item.generic_name || item.category || "",
        category: item.category || "",
        originalGender: item.gender || gender,
        normalizedGender: itemGender,
        originalAudience: item.audience || audience,
        normalizedAudience: itemAudience,
        query: q,
        globalTaiwanQuery,
        zhQuery,
        zhBoostQuery,
        zhDomainQuery,
        counts: {
          rawZh: rawZh.length,
          rawTWBoost: rawTWBoost.length,
          rawZhDomain: rawZhDomain.length,
          rawGlobalTaiwan: rawGlobalTaiwan.length,
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
          fallbackUsed,
          emergencyFallbackUsed,
          taiwanSupplementUsed,
          fillerUsed,
        },
        finalTop3: grouped[slot].map(productDebug),
        rawTop5: baseList.slice(0, 5).map((x) => ({ title: x.title, merchant: x.merchant, isTaiwan: isLikelyTaiwanProduct(x) })),
      };

      console.log("[search-products V3.6 debug]", JSON.stringify(debugEntry));
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
