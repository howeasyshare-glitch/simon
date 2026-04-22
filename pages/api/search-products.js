// pages/api/search-products.js
// V2.3.1 - gender 修正 + hard filter + 精準搜尋

export const config = { runtime: "nodejs" };

// ===== 工具 =====
const norm = (v) => String(v || "").toLowerCase();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

function normalizeGender(input) {
  const g = String(input || "").trim().toLowerCase();

  if (["male", "man", "men", "男性", "男", "boy"].includes(g)) return "male";
  if (["female", "woman", "women", "女性", "女", "girl"].includes(g)) return "female";
  if (["neutral", "unisex", "中性"].includes(g)) return "neutral";

  return "neutral";
}

// ===== 類別 mapping =====
function getCategoryKeywords(item) {
  const cat = norm(item.category);

  if (cat.includes("cardigan")) return ["cardigan", "sweater", "knit"];
  if (cat.includes("shirt")) return ["shirt", "button", "oxford"];
  if (cat.includes("t-shirt")) return ["t-shirt", "tee"];
  if (cat.includes("hoodie")) return ["hoodie"];
  if (cat.includes("jeans")) return ["jeans", "denim"];
  if (cat.includes("pants")) return ["pants", "trousers"];
  if (cat.includes("sneaker")) return ["sneaker", "trainer"];
  if (cat.includes("loafer")) return ["loafer"];
  if (cat.includes("bag")) return ["bag"];

  return [];
}

// ===== Query =====
function buildQuery(item, gender) {
  return [
    gender === "male" ? "men" : gender === "female" ? "women" : "",
    item.color,
    item.fit,
    item.material,
    item.sleeve_length,
    item.category
  ]
    .filter(Boolean)
    .join(" ");
}

// ===== Google Shopping =====
async function searchGoogle(apiKey, q) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", q);
  url.searchParams.set("api_key", apiKey);

  const r = await fetch(url.toString());
  const j = await r.json();
  return j.shopping_results || [];
}

// ===== Hard Filter =====
function isOppositeGender(p, gender) {
  const t = norm(p.title);

  if (gender === "male") {
    return /women|ladies|girl|女/.test(t);
  }
  if (gender === "female") {
    return /men|男/.test(t);
  }
  return false;
}

function isForbidden(p, slot, gender) {
  const t = norm(p.title);

  if (gender === "male") {
    if (/bra|bralette|skirt|dress|heels|bikini/.test(t)) return true;
  }

  if (slot === "top" && /skirt|dress/.test(t)) return true;
  if (slot === "bottom" && /bra|top/.test(t)) return true;
  if (slot === "shoes" && /shirt|pants/.test(t)) return true;

  return false;
}

function matchCategory(p, item) {
  const t = norm(p.title);
  const kws = getCategoryKeywords(item);
  if (!kws.length) return true;
  return kws.some((k) => t.includes(k));
}

function hardFilter(list, item, slot, gender) {
  return list.filter((p) => {
    if (isOppositeGender(p, gender)) return false;
    if (isForbidden(p, slot, gender)) return false;
    if (!matchCategory(p, item)) return false;
    return true;
  });
}

// ===== Ranking =====
function score(p, item) {
  const t = norm(p.title);
  let s = 0;

  if (item.color && t.includes(norm(item.color))) s += 2;
  if (item.fit && t.includes(norm(item.fit))) s += 1.5;
  if (item.material && t.includes(norm(item.material))) s += 1.5;

  return s;
}

function rank(list, item) {
  return list
    .map((p) => ({
      ...p,
      _score: score(p, item),
    }))
    .sort((a, b) => b._score - a._score);
}

// ===== 主 API =====
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.SERPAPI_API_KEY;
    const { items = [], gender = "neutral" } = req.body;

    const normalizedGender = normalizeGender(gender);
    const grouped = {};
    const debug = [];

    for (const item of items) {
      const slot = item.slot;

      const itemGender = normalizeGender(item.gender || normalizedGender);

      const q = buildQuery(item, itemGender);
      const raw = await searchGoogle(apiKey, q);

      let list = raw.map((p) => ({
        title: p.title,
        link: p.product_link || p.link,
        thumbnail: p.thumbnail,
        price: p.price,
        extracted_price: p.extracted_price,
      }));

      list = list.filter((x) => x.title && x.link);

      const before = list.length;

      list = hardFilter(list, item, slot, itemGender);

      const after = list.length;

      list = rank(list, item);

      grouped[slot] = list.slice(0, 3);

      debug.push({
        slot,
        originalGender: item.gender || gender,
        normalizedGender: itemGender,
        query: q,
        before,
        after,
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
      error: e.message,
    });
  }
}
