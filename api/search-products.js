// /api/search-products.js
export const config = { runtime: "nodejs" };

function buildQueriesFromItems(items = []) {
  // 避免一次搜太多：最多取 6 個（top/bottom/shoes/outer/bag/hat）
  const priority = ["top", "bottom", "shoes", "outer", "bag", "hat"];
  const sorted = [...items].sort((a, b) => priority.indexOf(a.slot) - priority.indexOf(b.slot));
  const picked = sorted.slice(0, 6);

  return picked
    .map((it) => {
      const name = (it.display_name_zh || "").trim() || (it.generic_name || "").trim();
      if (!name) return null;
      const color = (it.color || "").trim();
      const slot = (it.slot || "").trim();
      // query 用「中文名 + 顏色 + 類別」會比較有結果
      const q = `${color ? color + " " : ""}${name} ${slot ? slot : ""}`.trim();
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
    if (!apiKey) {
      return res.status(500).json({ error: "SERPAPI_API_KEY not set" });
    }

    const { items = [], locale = "tw" } = req.body || {};
    const queries = buildQueriesFromItems(items);

    if (!queries.length) {
      return res.status(200).json({ ok: true, products: [] });
    }

    // locale 對應 serpapi 的 gl/hl
    const gl = locale === "tw" ? "tw" : "us";
    const hl = locale === "tw" ? "zh-tw" : "en";

    // 逐個 query 搜（避免被 SerpAPI 限制，先不並發太多）
    const all = [];
    for (const { slot, q } of queries) {
      const s = await serpapiShoppingSearch({ apiKey, q, gl, hl });
      if (s.ok) {
        // 每個 slot 只取前 4 個，避免爆量
        const top = s.results.slice(0, 4).map((p) => ({
          slot,
          title: p.title,
          price: p.price,
          extracted_price: p.extracted_price,
          source: p.source,
          link: p.link,
          thumbnail: p.thumbnail,
        }));
        all.push(...top);
      }
    }

    return res.status(200).json({ ok: true, products: all });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
