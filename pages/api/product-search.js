// pages/api/product-search.js
function json(res, status, obj) {
  res.status(status).json(obj);
}

function cleanupText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function absGoogleUrl(href) {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return `https://www.google.com${href}`;
  return href;
}

function decodeGoogleRedirect(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get("q") || u.searchParams.get("url") || u.searchParams.get("adurl") || url;
  } catch {
    return url;
  }
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text, finalUrl: r.url };
}

function extractGoogleShoppingDetailUrls(html) {
  const out = [];
  const regexes = [
    /href="(\/search\?[^"]*udm=28[^"]*)"/g,
    /href="(\/shopping\/product\/[^"]*)"/g,
    /"(\/search\?[^"]*udm=28[^"]*)"/g,
    /"(\/shopping\/product\/[^"]*)"/g,
  ];

  for (const re of regexes) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = absGoogleUrl(String(m[1]).replace(/&amp;/g, "&"));
      if (u.includes("/search?") || u.includes("/shopping/product/")) out.push(u);
    }
  }
  return uniqBy(out, (x) => x);
}

function extractMeta(html, property) {
  const m = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"));
  return m ? cleanupText(m[1]) : "";
}

function extractTitle(html) {
  return extractMeta(html, "og:title") || cleanupText((html.match(/<title[^>]*>(.*?)<\/title>/i) || [])[1] || "");
}

function extractImage(html) {
  return extractMeta(html, "og:image");
}

function extractMerchant(html) {
  const patterns = [
    /"sellerName":"([^"]+)"/i,
    /Go to site<\/span>.*?<span[^>]*>(.*?)<\/span>/is,
    /前往網站<\/span>.*?<span[^>]*>(.*?)<\/span>/is,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return cleanupText(m[1]);
  }
  return "";
}

function extractOutboundUrl(html) {
  const patterns = [
    /href="(https:\/\/www\.google\.com\/url\?[^"]+)"/i,
    /href="(\/url\?[^"]+)"/i,
    /"webUrl":"([^"]+)"/i,
    /"offerUrl":"([^"]+)"/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const raw = absGoogleUrl(String(m[1]).replace(/\\u0026/g, "&").replace(/&amp;/g, "&"));
      return decodeGoogleRedirect(raw);
    }
  }
  return "";
}

async function searchProductPages(query, limit = 3) {
  const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
  const searchResp = await fetchText(searchUrl);
  if (!searchResp.ok) {
    return { ok: false, query, items: [], debug: { step: "search", status: searchResp.status } };
  }

  const detailUrls = extractGoogleShoppingDetailUrls(searchResp.text).slice(0, 8);
  const items = [];

  for (const detailUrl of detailUrls) {
    if (items.length >= limit) break;
    try {
      const detailResp = await fetchText(detailUrl);
      if (!detailResp.ok) continue;

      const outboundUrl = extractOutboundUrl(detailResp.text);
      const title = extractTitle(detailResp.text) || cleanupText(query);
      const imageUrl = extractImage(detailResp.text);
      const merchant = extractMerchant(detailResp.text) || "Google Shopping";

      items.push({
        title,
        image_url: imageUrl,
        product_url: outboundUrl || detailUrl,
        google_detail_url: detailUrl,
        merchant,
        source: outboundUrl ? "google_detail_to_merchant" : "google_detail",
      });
    } catch {}
  }

  return {
    ok: true,
    query,
    items: uniqBy(items, (x) => x.product_url || x.google_detail_url).slice(0, limit),
    debug: { detailUrlsFound: detailUrls.length },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed", items: [] });

  try {
    const query = cleanupText(req.body?.query || "");
    const limit = Math.max(1, Math.min(Number(req.body?.limit || 3), 6));
    if (!query) return json(res, 400, { ok: false, error: "query required", items: [] });

    const result = await searchProductPages(query, limit);
    return json(res, 200, result);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "Unhandled product-search error",
      detail: String(e?.message || e),
      items: [],
    });
  }
}
