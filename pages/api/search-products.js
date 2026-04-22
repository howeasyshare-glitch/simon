// pages/api/search-products.js
// V2.4

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

// ===== 類別 / 同義詞 =====
function getCategorySynonyms(item) {
  const cat = norm(item.category || item.generic_name || item.display_name_zh);
  const slot = norm(item.slot);

  // TOP
  if (cat.includes("knit polo") || cat.includes("polo shirt")) return ["polo", "polo shirt", "knit polo"];
  if (cat.includes("cardigan")) return ["cardigan", "knit cardigan", "sweater cardigan", "knitwear"];
  if (cat.includes("button-up shirt") || cat.includes("button up shirt")) return ["button-up shirt", "button down shirt", "shirt", "oxford shirt"];
  if (cat.includes("shirt")) return ["shirt", "button-up shirt", "button down shirt", "oxford shirt"];
  if (cat.includes("graphic t-shirt")) return ["graphic t-shirt", "graphic tee", "t-shirt", "tee"];
  if (cat.includes("crew neck t-shirt")) return ["crew neck t-shirt", "t-shirt", "tee"];
  if (cat.includes("long-sleeve t-shirt") || cat.includes("long sleeve t-shirt")) return ["long sleeve t-shirt", "long-sleeve tee", "t-shirt", "tee"];
  if (cat.includes("t-shirt") || cat.includes("tee")) return ["t-shirt", "tee"];
  if (cat.includes("hoodie")) return ["hoodie", "hooded sweatshirt", "zip hoodie"];
  if (cat.includes("sweater")) return ["sweater", "knit sweater", "pullover"];
  if (cat.includes("jacket") || cat.includes("outer")) return ["jacket", "outerwear", "coat", "utility jacket", "coach jacket"];

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

  // fallback
  if (slot === "top") return ["shirt", "tee", "polo", "cardigan", "sweater", "hoodie", "jacket"];
  if (slot === "bottom") return ["pants", "trousers", "jeans", "shorts", "chino"];
  if (slot === "shoes") return ["shoes", "sneaker", "trainer", "loafer", "boot"];
  if (slot === "bag") return ["bag", "crossbody", "tote", "messenger", "shoulder"];

  return [];
}

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

// ===== 外部搜尋 =====
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

function isForbiddenForSlot(title, slot, gender) {
  const t = norm(title);

  const maleForbidden = [
    "bra", "bralette", "crop top", "skirt", "dress", "bikini", "panties", "heels", "blouse",
    "one-piece swimsuit", "swimsuit", "lingerie"
  ];

  if (gender === "male" && maleForbidden.some((w) => t.includes(w))) return true;

  if (slot === "top" && ["skirt", "dress", "panties", "bikini bottom", "bottom"].some((w) => t.includes(w))) return true;
  if (slot === "bottom" && ["bra", "bralette", "top", "dress", "heel", "shoe", "bikini bottom"].some((w) => t.includes(w))) return true;
  if (slot === "shoes" && ["bra", "shirt", "top", "dress", "bag", "pant", "pants"].some((w) => t.includes(w))) return true;
  if (slot === "bag" && ["shoe", "shirt", "pants", "dress", "bra", "bikini"].some((w) => t.includes(w))) return true;

  return false;
}

// ===== slot 專屬判斷 =====
function slotStrictKeywords(slot, item) {
  const categoryWords = getCategorySynonyms(item);
  const cat = norm(item.category || "");

  if (slot === "top") {
    const extra = [];
    if (cat.includes("polo")) extra.push("polo");
    if (cat.includes("shirt")) extra.push("shirt");
    if (cat.includes("t-shirt") || cat.includes("tee")) extra.push("t-shirt", "tee");
    if (cat.includes("cardigan")) extra.push("cardigan");
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
    return ["shirt", "tee", "polo", "sweater", "cardigan"];
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

  if (slot === "top" || slot === "bottom") {
    if (m.includes("cotton linen")) return containsAny(hay, ["cotton", "linen", "棉麻"]);
    if (m.includes("cotton blend")) return containsAny(hay, ["cotton", "blend", "棉"]);
    if (m.includes("knit cotton")) return containsAny(hay, ["knit", "cotton", "針織"]);
    if (m.includes("cotton twill")) return containsAny(hay, ["cotton", "twill", "棉"]);
    if (m.includes("denim")) return containsAny(hay, ["denim", "jeans", "牛仔"]);
    return hay.includes(m) || containsAny(hay, tokenize(m));
  }

  if (m.includes("faux leather")) return containsAny(hay, ["faux leather", "vegan leather", "pu leather"]);
  if (m.includes("leather")) return containsAny(hay, ["leather", "皮革"]);
  if (m.includes("canvas")) return containsAny(hay, ["canvas", "帆布"]);
  if (m.includes("nylon")) return containsAny(hay, ["nylon", "尼龍"]);
  if (m.includes("cotton canvas")) return containsAny(hay, ["canvas", "cotton", "帆布"]);

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

// ===== filter pipeline =====
function hardFilter(list, item, slot, gender) {
  return list.filter((p) => {
    if (isOppositeGenderProduct(p, gender)) return false;
    if (isForbiddenForSlot(p.title, slot, gender)) return false;
    if (!passesCategoryFilter(p, item, slot, "strict")) return false;

    if (slot === "top") {
      if (!passesSleeveFilter(p, item)) return false;
      if (!passesNecklineFilter(p, item)) return false;
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

function softFallbackFilter(list, item, slot, gender) {
  return list.filter((p) => {
    if (isOppositeGenderProduct(p, gender)) return false;
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

  const cap = { top: 2000, bottom: 2500, shoes: 3000, bag: 2500 }[slot] || 2500;
  if (price < cap * 0.6) return 1;
  if (price < cap) return 0.5;
  if (price < cap * 1.5) return -0.5;
  return -2;
}

function scoreLuxury(title) {
  const t = norm(title);
  return ["off-white", "balenciaga", "gucci", "prada"].some((x) => t.includes(x)) ? -2 : 0;
}

function scoreTW(p) {
  const t = norm(`${p.title || ""} ${p.link || ""}`);
  return ["蝦皮", "momo", "pchome", "yahoo"].some((h) => t.includes(norm(h))) ? 1 : 0;
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
    s += (slot === "shoes" || slot === "bag") ? 1.2 : 0.8;
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
    const { items = [], locale = "tw", gender = "neutral", styleTag } = req.body;
    const normalizedGender = normalizeGender(gender);

    const grouped = {};
    const debug = [];

    for (const item of items) {
      const slot = item.slot;
      const itemGender = normalizeGender(item.gender || normalizedGender);
      const q = buildQuery(item, { locale, gender: itemGender, styleTag });
      const raw = await searchGoogle(apiKey, q);

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

      list = hardFilter(list, item, slot, itemGender);
      const afterHardFilterCount = list.length;

      let fallbackUsed = false;
      if (list.length === 0 && ["top", "bottom", "shoes", "bag"].includes(slot)) {
        list = softFallbackFilter(baseList, item, slot, itemGender);
        fallbackUsed = true;
      }

      const afterFallbackCount = list.length;
      const ranked = rank(list, item, slot);
      grouped[slot] = ranked.slice(0, 3);

      debug.push({
        slot,
        originalGender: item.gender || gender,
        normalizedGender: itemGender,
        query: q,
        beforeCount,
        afterHardFilterCount,
        fallbackUsed,
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
