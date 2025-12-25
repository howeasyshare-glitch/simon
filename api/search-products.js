// /api/search-products.js
export const config = { runtime: "nodejs" };
function genderHint(locale, gender) {
  // locale: "tw" / "us"
  if (gender === "male") return locale === "tw" ? "男款" : "men";
  if (gender === "female") return locale === "tw" ? "女款" : "women";
  return ""; // neutral
}

function isOppositeGenderTitle(title, gender) {
  if (!gender || gender === "neutral") return false;

  const t = String(title || "").toLowerCase();

  // 注意：中文「男/女」很短，會有誤判風險，但對 Google Shopping 通常有效。
  // 若你覺得誤殺太多，可以把單字 "男"/"女" 拿掉，只留 "男款/女款/男裝/女裝/men/women"。
  const femaleKw = ["女款", "女裝", "women", "womens", "woman", "lady", "ladies", "girls", "girl", "女"];
  const maleKw = ["男款", "男裝", "men", "mens", "man", "boys", "boy", "男"];

  if (gender === "male") return femaleKw.some(k => t.includes(k));
  if (gender === "female") return maleKw.some(k => t.includes(k));
  return false;
}

function buildQueriesFromItems(items = [], { locale = "tw", gender = "neutral" } = {}) {
  // 避免一次搜太多：最多取 6 個（top/bottom/shoes/outer/bag/hat）
  const priority = ["top", "bottom", "shoes", "outer", "bag", "hat"];
  const sorted = [...items].sort(
    (a, b) => priority.indexOf(a.slot) - priority.indexOf(b.slot)
  );
  const picked = sorted.slice(0, 6);

  const g = genderHint(locale, gender);

  return picked
    .map((it) => {
      const name = (it.display_name_zh || "").trim() || (it.generic_name || "").trim();
      if (!name) return null;
      const color = (it.color || "").trim();
      const slot = (it.slot || "").trim();

      // ✅ query：性別 + 顏色 + 名稱（slot 可有可無，保留一點點）
      // 例：男款 白色 寬版棉質圓領上衣 top
      const q = `${g ? g + " " : ""}${color ? color + " " : ""}${name}${slot ? " " + slot : ""}`.trim();
      return { slot: it.slot, q };
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

  const results = j.shopping_results || [];
  return { ok: true, results };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "SERPAPI_API_KEY not set" });

    const { items = [], locale = "tw", gender = "neutral" } = req.body || {};
    const queries = buildQueriesFromItems(items, { locale, gender });

    if (!queries.length) {
      return res.status(200).json({ ok: true, products: [] });
    }

    // locale 對應 serpapi 的 gl/hl
    const gl = locale === "tw" ? "tw" : "us";
    const hl = locale === "tw" ? "zh-tw" : "en";

    const all = [];
    for (const { slot, q } of queries) {
      const s = await serpapiShoppingSearch({ apiKey, q, gl, hl });
      if (!s.ok) continue;

      // ✅ 先過濾掉反向性別商品，再取前 4 個
      const filtered = s.results
        .filter(p => !isOppositeGenderTitle(p.title, gender))
        .slice(0, 4)
        .map((p) => ({
          slot,
          title: p.title,
          price: p.price,
          extracted_price: p.extracted_price,
          source: p.source,
          // ✅ 連結：優先給 product_link（通常是商家頁），再給 link（google shopping 聚合/跳轉）
          product_link: p.product_link,
          link: p.link,
          thumbnail: p.thumbnail,
        }));

      all.push(...filtered);
    }

    return res.status(200).json({ ok: true, products: all });
  } catch (e) {
    showImageSkeleton(false);
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
setLoadingUI(false);
