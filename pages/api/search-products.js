// pages/api/search-products.js

import { supabaseServer } from "../../lib/supabaseServer";

export const config = { runtime: "nodejs" };

// ====== 基本設定 ======
const DEFAULT_RULES = {
  perSlot: { top: 3, bottom: 3, shoes: 3 },
  customMax: 2,
  fallback: true,
};

// ====== 工具 ======
const safe = (v) => String(v || "").trim();
const norm = (v) => safe(v).toLowerCase();

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const tokenize = (v) =>
  norm(v).split(/[\s,./\-_"'()]+/).filter(Boolean);

// ====== Query 清理（V2.1 核心）======
function buildQuery(item, { locale, gender, styleTag }) {
  const zh = safe(item.display_name_zh);
  const en = safe(item.generic_name);
  const color = safe(item.color);
  const slot = safe(item.slot);

  const useZH = locale === "tw";

  const base = useZH ? zh || en : en || zh;

  const genderWord =
    gender === "male" ? (useZH ? "男" : "men") :
    gender === "female" ? (useZH ? "女" : "women") : "";

  const style =
    styleTag === "scene_commute"
      ? (useZH ? "通勤" : "smart casual")
      : "";

  const tokens = uniq([
    genderWord,
    color,
    base,
    slot,
    style
  ]);

  return tokens.join(" ");
}

// ====== Google 搜尋 ======
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

// ====== 排序（V2.1 核心）======

// 價格降權
function scorePrice(p, slot) {
  const price = Number(p.extracted_price || 0);
  if (!price) return 0;

  const cap = {
    top: 2000,
    bottom: 2500,
    shoes: 3000
  }[slot] || 2500;

  if (price < cap * 0.6) return +1;
  if (price < cap) return +0.5;
  if (price < cap * 1.5) return -0.5;
  return -2;
}

// 精品降權
function scoreLuxury(title) {
  const t = norm(title);
  const bad = ["off-white", "balenciaga", "gucci", "prada"];
  return bad.some(x => t.includes(x)) ? -2 : 0;
}

// 台灣加權
function scoreTW(p) {
  const t = norm(p.title + p.link);
  const hints = ["蝦皮", "momo", "pchome", "yahoo"];
  return hints.some(h => t.includes(h)) ? +1 : 0;
}

// 文字匹配
function scoreText(p, item) {
  const tokens = tokenize(item.generic_name || item.display_name_zh);
  let s = 0;
  tokens.forEach(t => {
    if (norm(p.title).includes(t)) s += 1;
  });
  return s;
}

// 總分
function rank(list, item, slot) {
  return list.map(p => {
    const score =
      scoreText(p, item) +
      scorePrice(p, slot) +
      scoreLuxury(p.title) +
      scoreTW(p);

    return { ...p, _score: score };
  }).sort((a, b) => b._score - a._score);
}

// ====== 主 API ======
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.SERPAPI_API_KEY;

  const { items = [], locale = "tw", gender = "neutral", styleTag } = req.body;

  const grouped = {};
  const debug = [];

  for (const item of items) {
    const slot = item.slot;

    const q = buildQuery(item, { locale, gender, styleTag });

    const raw = await searchGoogle(apiKey, q);

    let list = raw.map(p => ({
      title: p.title,
      link: p.product_link,
      thumbnail: p.thumbnail,
      price: p.price,
      extracted_price: p.extracted_price,
      source: "google"
    }));

    list = list.filter(x => x.title && x.link && x.thumbnail);

    const ranked = rank(list, item, slot);

    grouped[slot] = ranked.slice(0, 3);

    debug.push({
      slot,
      query: q,
      count: list.length,
      top: grouped[slot].map(x => ({
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
}
