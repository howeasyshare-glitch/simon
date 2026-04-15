// pages/api/product-search.js
// Low-cost MVP: search Google Shopping result pages, extract product URLs,
// then fetch each product page to get og:title / og:image metadata.
// Fragile by nature; intended as a cost-saving MVP, not a permanent architecture.

function json(res, status, obj) {
  res.status(status).json(obj);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function decodeGoogleRedirect(href) {
  try {
    const m = href.match(/\/url\?q=([^&]+)/);
    if (!m) return "";
    const url = decodeURIComponent(m[1]);
    if (!/^https?:\/\//i.test(url)) return "";
    if (/google\./i.test(url)) return "";
    return url;
  } catch {
    return "";
  }
}

function stripHtml(html) {
  return normalizeText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
  );
}

function extractProductUrlsFromGoogleHtml(html) {
  const urls = [];
  const seen = new Set();

  const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1] || "";
    const decoded = decodeGoogleRedirect(href);
    if (!decoded) continue;

    if (
      /accounts\.google|support\.google|policies\.google|maps\.google|youtube\.com/i.test(decoded)
    ) {
      continue;
    }

    if (seen.has(decoded)) continue;
    seen.add(decoded);

    urls.push({
      url: decoded,
      anchor_text: stripHtml(match[2] || ""),
    });
  }

  return urls;
}

function extractMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return normalizeText(m[1]);
  }
  return "";
}

function extractTitle(html) {
  const ogTitle = extractMeta(html, "og:title");
  if (ogTitle) return ogTitle;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? stripHtml(titleMatch[1]) : "";
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: String(error?.message || error) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchProductPages({ query, maxResults = 3 }) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const searchUrl =
    "https://www.google.com/search?tbm=shop&hl=en&gl=tw&q=" +
    encodeURIComponent(normalizedQuery);

  const searchResp = await fetchTextWithTimeout(
    searchUrl,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "accept-language": "en-US,en;q=0.9,zh-TW;q=0.8",
        "cache-control": "no-cache",
      },
    },
    9000
  );

  if (!searchResp.ok || !searchResp.text) return [];

  const rawUrls = extractProductUrlsFromGoogleHtml(searchResp.text).slice(0, 12);
  if (!rawUrls.length) return [];

  const candidates = [];
  const seen = new Set();

  for (const item of rawUrls) {
    if (candidates.length >= maxResults) break;
    if (!item?.url || seen.has(item.url)) continue;
    seen.add(item.url);

    const pageResp = await fetchTextWithTimeout(
      item.url,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
          "accept-language": "en-US,en;q=0.9,zh-TW;q=0.8",
        },
        redirect: "follow",
      },
      9000
    );

    if (!pageResp.ok || !pageResp.text) continue;

    const title = extractTitle(pageResp.text) || item.anchor_text || hostnameFromUrl(item.url);
    const image_url = extractMeta(pageResp.text, "og:image") || extractMeta(pageResp.text, "twitter:image");
    const product_url = item.url;
    const merchant = hostnameFromUrl(product_url);

    candidates.push({
      title: normalizeText(title).slice(0, 160),
      image_url,
      product_url,
      url: product_url,
      merchant,
      source: "scrape_google_shopping",
    });
  }

  return candidates.slice(0, maxResults);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = req.body || {};
    const query = normalizeText(body.query || body.shopping_query || body.description || body.label || "");
    const maxResults = Math.max(1, Math.min(Number(body.maxResults || 3), 6));

    const items = await searchProductPages({ query, maxResults });
    return json(res, 200, { ok: true, query, items });
  } catch (error) {
    return json(res, 500, { ok: false, error: String(error?.message || error) });
  }
}
