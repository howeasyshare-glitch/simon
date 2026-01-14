import { supabaseServer } from "../lib/supabaseServer";

// 你的既有 helper（假設在同檔或可用）
// - buildQueriesFromItems(items, { locale, gender })
// - serpapiShoppingSearch({ apiKey, q, gl, hl })
// - isOppositeGenderTitle(title, gender)

// slot -> itemTag（固定五類；若你 slot 名稱不同，可在這裡調整）
const SLOT_TO_ITEMTAG = {
  outerwear: "item_outerwear",
  top: "item_top",
  bottom: "item_bottom",
  shoes: "item_shoes",
  bag: "item_bag",

  // 兼容你現有 slot 可能的命名
  coat: "item_outerwear",
  jacket: "item_outerwear",
  tops: "item_top",
  pants: "item_bottom",
  trousers: "item_bottom",
  footwear: "item_shoes",
  bags: "item_bag",
};

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

// 自訂商品：最小可行的加權（MVP）
function scoreCustomProduct(row, { gender, ageGroup, styleTag }) {
  let score = 0;
  const tags = Array.isArray(row?.tags) ? row.tags : [];

  // 類別命中（如果有提供 ageGroup 才加分）
  if (ageGroup && tags.includes(ageGroup)) score += 6;

  // 性別命中（只有商品有設性別 tag 才算）
  if (gender && (tags.includes("male") || tags.includes("female") || tags.includes("neutral"))) {
    if (tags.includes(gender)) score += 3;
  }

  // 風格命中（scene_x / celeb_x）
  if (styleTag && tags.includes(styleTag)) score += 3;

  // priority_boost
  score += Number(row?.priority_boost || 0);

  return score;
}

async function fetchCustomForSlot({ slot, gender, ageGroup, styleTag }) {
  const itemTag = SLOT_TO_ITEMTAG[slot] || null;
  if (!itemTag) return [];

  // 基本過濾：is_active + tags 包含 itemTag
  // 若有 ageGroup（adult/kids）就一起過濾；沒有就不限制
  const baseContains = [itemTag];
  if (ageGroup === "adult" || ageGroup === "kids") baseContains.push(ageGroup);

  const containsJson = JSON.stringify(baseContains);

  const { data, error } = await supabaseServer
    .from("custom_products")
    .select(
      "id,is_active,title,image_url,product_url,merchant,tags,priority_boost,badge_text,discount_type,discount_code,tracking_params"
    )
    .eq("is_active", true)
    .filter("tags", "cs", containsJson);

  if (error) {
    // 不要中斷整個流程：回空即可
    return [];
  }

  const cleaned = (data || [])
    .map((row) => ({
      row,
      score: scoreCustomProduct(row, { gender, ageGroup, styleTag }),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ row, score }) => {
      // 過濾必要欄位（避免前端卡片壞）
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

        // 自訂專用資訊（前端可顯示 badge/折扣）
        badge_text: row.badge_text || "本站推薦",
        discount_type: row.discount_type || "none",
        discount_code: row.discount_code || null,

        // debug 可用（若你前端有 debug 模式）
        _custom_score: score,
        _merchant: row.merchant || null,
        _tags: Array.isArray(row.tags) ? row.tags : [],
      };
    })
    .filter((p) => p.title && p.link && p.thumbnail); // 你目前資料 title/link/thumbnail 是 null，所以會先被過濾掉

  // 自訂最多 2
  return cleaned.slice(0, 2);
}

export default async function handler(req, res) {
  console.log("[search-products] called", new Date().toISOString());

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.SERPAPI_API_KEY;

    // ✅ 沒 key 就回空（保留你原邏輯）
    if (!apiKey) return res.status(200).json({ ok: true, products: [], warning: "SERPAPI_API_KEY not set" });

    // 你原本只有 items/locale/gender；我額外支援 ageGroup/styleTag（可選）
    const { items = [], locale = "tw", gender = "neutral", ageGroup = null, styleTag = null } = req.body || {};

    const queries = buildQueriesFromItems(items, { locale, gender });
    if (!queries.length) return res.status(200).json({ ok: true, products: [] });

    const gl = locale === "tw" ? "tw" : "us";
    const hl = locale === "tw" ? "zh-tw" : "en";

    const debug = [];
    const all = [];

    // 每個 slot：先自訂2，再 SerpApi 補2
    for (const { slot, q } of queries) {
      const custom = await fetchCustomForSlot({ slot, gender, ageGroup, styleTag });

      // 記錄 debug
      debug.push({
        slot,
        stage: "custom",
        count: custom.length,
        ageGroup,
        styleTag,
      });

      // SerpApi（補到 2）
      const needGoogle = Math.max(0, 2 - custom.length);

      let googleProducts = [];
      if (needGoogle > 0) {
        const s = await serpapiShoppingSearch({ apiKey, q, gl, hl });

        debug.push({ slot, stage: "serpapi", q, ok: s.ok, count: s.ok ? s.results.length : 0, status: s.status });

        if (s.ok) {
          googleProducts = (s.results || [])
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
        }

        // 去重：避免 google 回到同一個 link（或跟自訂重複）
        const customLinks = new Set(custom.map((x) => x.link));
        googleProducts = googleProducts.filter((p) => !customLinks.has(p.link));
        googleProducts = uniqBy(googleProducts, (p) => p.link).slice(0, needGoogle);
      }

      // 合併：每個 slot 最多 4，但來源上限固定 custom2 + google2
      all.push(...custom, ...googleProducts);
    }

    return res.status(200).json({ ok: true, products: all, debug });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
