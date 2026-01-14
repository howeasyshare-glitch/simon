// pages/api/search-products-from-spec.js
// 用 SerpAPI（Google Shopping）依 outfit spec items 搜尋商品

export default async function handler(req, res) {
  console.log("[search-products-from-spec] called", new Date().toISOString());

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    if (!SERPAPI_KEY) return res.status(500).json({ error: "SERPAPI_KEY not set" });

    const { items, gl, hl, maxPerSlot } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing items[]" });
    }

    // 預設台灣
    const _gl = gl || "tw";
    const _hl = hl || "zh-tw";
    const _max = Number.isFinite(maxPerSlot) ? maxPerSlot : 3;

    // 只處理我們允許的 slot
    const allowedSlots = new Set(["top", "bottom", "shoes", "outer", "bag", "hat"]);

    // 產 query：用 color + generic_name + 額外輔助詞（避免太飄）
    const buildQuery = (it) => {
      const color = it.color ? String(it.color) : "";
      const name = it.generic_name ? String(it.generic_name) : "";
      const slot = it.slot ? String(it.slot) : "";
      const helper =
        slot === "shoes" ? "sneakers shoes" :
        slot === "bag" ? "bag" :
        slot === "hat" ? "cap hat" :
        slot === "outer" ? "jacket coat" : "";
      return [color, name, helper].filter(Boolean).join(" ").trim();
    };

    // 依 slot 分組（每個 slot 只用第一個 item 做搜尋，避免重複/雜訊）
    const slotToItem = {};
    for (const it of items) {
      const slot = String(it?.slot || "").toLowerCase();
      if (!allowedSlots.has(slot)) continue;
      if (!slotToItem[slot]) slotToItem[slot] = it;
    }

    const slots = Object.keys(slotToItem);

    const fetchShopping = async (q) => {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_shopping");
      url.searchParams.set("q", q);
      url.searchParams.set("api_key", SERPAPI_KEY);
      url.searchParams.set("gl", _gl);
      url.searchParams.set("hl", _hl);

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`SerpAPI error ${resp.status}: ${t}`);
      }
      return resp.json();
    };

    // 逐個 slot 搜（簡單、好 debug）
    const results = {};
    for (const slot of slots) {
      const it = slotToItem[slot];
      const q = buildQuery(it);

      const data = await fetchShopping(q);

      const arr = Array.isArray(data.shopping_results) ? data.shopping_results : [];
      results[slot] = arr.slice(0, _max).map((p) => ({
        title: p.title || "",
        price: p.price || "",
        source: p.source || "",
        link: p.link || "",
        thumbnail: p.thumbnail || "",
        query: q
      }));
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error("search-products-from-spec error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
