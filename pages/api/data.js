// pages/api/data.js 

async function json(res, status, obj) {
  res.status(status).json(obj);
}

function getEnv() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return { ok: false, error: "Supabase env not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" };
  }
  return { ok: true, SUPABASE_URL, SERVICE_ROLE };
}

function getBearer(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

async function getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken }) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, detail: text };
  try {
    const user = JSON.parse(text);
    return { ok: true, user };
  } catch {
    return { ok: false, status: 500, detail: "Failed to parse auth user JSON" };
  }
}

function buildPublicImageUrl(SUPABASE_URL, image_path) {
  return image_path ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${image_path}` : "";
}

function makeShareSlug() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

const FAVORITES_TABLE = "outfit_likes";

/** ===================== Explore ===================== */
async function handleExplore(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });

  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const limit = Math.min(parseInt(req.query.limit || "30", 10) || 30, 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
  const sort = String(req.query.sort || "like").toLowerCase();

  const order =
    sort === "share"
      ? "share_count.desc"
      : sort === "apply"
      ? "apply_count.desc"
      : sort === "time"
      ? "created_at.desc"
      : "like_count.desc";

  const url =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?is_public=eq.true` +
    `&share_slug=not.is.null` +
    `&image_path=not.is.null` +
    `&select=id,created_at,share_slug,image_path,style,spec,summary,products,like_count,share_count,apply_count,is_public` +
    `&order=${order}` +
    `&limit=${limit}&offset=${offset}`;

  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const text = await r.text();
  if (!r.ok) return json(res, 500, { error: "Query failed", status: r.status, detail: text });

  const rows = JSON.parse(text || "[]");
  const items = rows.map((row) => ({
    ...row,
    image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
    share_url: row.share_slug ? `/share/${row.share_slug}` : "",
  }));

  return json(res, 200, { ok: true, items, limit, offset });
}

/** ===================== Share ===================== */
async function handleShare(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });

  const { SUPABASE_URL, SERVICE_ROLE } = env;
  const slug = String(req.query.slug || "").trim();
  if (!slug) return json(res, 400, { error: "Missing slug" });

  const url =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?share_slug=eq.${encodeURIComponent(slug)}` +
    `&is_public=eq.true` +
    `&select=id,created_at,spec,style,summary,products,image_path,share_slug,like_count,share_count,apply_count,is_public` +
    `&limit=1`;

  const resp = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const text = await resp.text();
  if (!resp.ok) return json(res, 500, { error: "Query failed", status: resp.status, detail: text });

  const rows = JSON.parse(text || "[]");
  const row = rows?.[0];
  if (!row) {
    return json(res, 404, {
      error: "Not found",
      hint: "slug not found or outfit is not public",
    });
  }

  return json(res, 200, {
    ok: true,
    outfit: {
      ...row,
      image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
    },
  });
}

/** ===================== Outfits: Create ===================== */
async function handleOutfitsCreate(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const accessToken = getBearer(req);
  if (!accessToken) return json(res, 401, { error: "Missing bearer token" });

  const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
  if (!u.ok) return json(res, 401, { error: "Invalid token", detail: u.detail });

  const body = req.body || {};
  const image_path = body.image_path || body.storage_path || "";
  const is_public = typeof body.is_public === "boolean" ? body.is_public : true;
  const spec = body.spec ?? body.specObj ?? null;
  const style = body.style ?? null;
  const summary = body.summary ?? null;
  const products = body.products ?? null;
  const share_slug = body.share_slug || makeShareSlug();

  if (!image_path) {
    return json(res, 400, { error: "Missing image_path (or storage_path)" });
  }

  const insertRow = {
    user_id: u.user.id,
    image_path,
    share_slug,
    is_public,
    spec,
    style,
    summary,
    products,
    updated_at: new Date().toISOString(),
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/outfits`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(insertRow),
  });

  const text = await r.text();
  if (!r.ok) return json(res, 500, { error: "Insert failed", status: r.status, detail: text });

  const rows = JSON.parse(text || "[]");
  const row = rows?.[0];
  if (!row) return json(res, 500, { error: "Insert ok but empty response", raw: text });

  return json(res, 200, {
    ok: true,
    outfit: {
      ...row,
      image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
      share_url: row.share_slug ? `/share/${row.share_slug}` : "",
    },
  });
}

/** ===================== Outfits: Update ===================== */
async function handleOutfitsUpdate(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const accessToken = getBearer(req);
  if (!accessToken) return json(res, 401, { error: "Missing bearer token" });

  const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
  if (!u.ok) return json(res, 401, { error: "Invalid token", detail: u.detail });

  const id = String(req.query.id || "").trim();
  if (!id) return json(res, 400, { error: "Missing id" });

  const body = req.body || {};
  const patch = {
    updated_at: new Date().toISOString(),
  };

  if ("products" in body) patch.products = body.products;
  if ("spec" in body) patch.spec = body.spec;
  if ("style" in body) patch.style = body.style;
  if ("summary" in body) patch.summary = body.summary;
  if ("is_public" in body) patch.is_public = !!body.is_public;
  if ("share_slug" in body) patch.share_slug = body.share_slug || null;
  if ("image_path" in body) patch.image_path = body.image_path || null;

  const url =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&user_id=eq.${encodeURIComponent(u.user.id)}`;

  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await r.text();
  if (!r.ok) return json(res, 500, { error: "Update failed", status: r.status, detail: text });

  const rows = JSON.parse(text || "[]");
  const row = rows?.[0];
  if (!row) return json(res, 404, { error: "Not found or not owner" });

  return json(res, 200, {
    ok: true,
    outfit: {
      ...row,
      image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
      share_url: row.share_slug ? `/share/${row.share_slug}` : "",
    },
  });
}

/** ===================== Outfits: Recent ===================== */
async function handleOutfitsRecent(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const accessToken = getBearer(req);
  if (!accessToken) return json(res, 401, { error: "Missing bearer token" });

  const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
  if (!u.ok) return json(res, 401, { error: "Invalid token", detail: u.detail });

  const limit = Math.min(parseInt(req.query.limit || "10", 10) || 10, 50);

  const url =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?user_id=eq.${encodeURIComponent(u.user.id)}` +
    `&select=id,created_at,share_slug,image_path,style,spec,summary,products,like_count,share_count,apply_count,is_public` +
    `&order=created_at.desc` +
    `&limit=${limit}`;

  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const text = await r.text();
  if (!r.ok) return json(res, 500, { error: "Query failed", status: r.status, detail: text });

  const rows = JSON.parse(text || "[]");
  const items = rows.map((row) => ({
    ...row,
    image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
    share_url: row.share_slug ? `/share/${row.share_slug}` : "",
  }));

  return json(res, 200, { ok: true, items, limit });
}

/** ===================== Outfits: Favorites ===================== */
async function handleOutfitsFavorites(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const limit = Math.min(parseInt(req.query.limit || "10", 10) || 10, 50);
  const anonId = String(req.query.anon_id || "").trim();

  let userId = null;
  const accessToken = getBearer(req);

  if (accessToken) {
    const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
    if (u.ok) userId = u.user?.id || null;
  }

  if (!userId && !anonId) {
    return json(res, 200, { ok: true, items: [], limit });
  }

  const filter = userId
    ? `user_id=eq.${encodeURIComponent(userId)}`
    : `anon_id=eq.${encodeURIComponent(anonId)}`;

  const favUrl =
    `${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}` +
    `?${filter}` +
    `&select=outfit_id,created_at` +
    `&order=created_at.desc` +
    `&limit=${limit}`;

  const fr = await fetch(favUrl, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const favText = await fr.text();
  if (!fr.ok) {
    return json(res, 500, {
      error: "Favorites query failed",
      status: fr.status,
      detail: favText,
      hint: `Check table ${FAVORITES_TABLE}`,
    });
  }

  const favRows = JSON.parse(favText || "[]");
  const ids = favRows.map((x) => x.outfit_id).filter(Boolean);

  if (!ids.length) return json(res, 200, { ok: true, items: [], limit });

  const inList = ids.map((id) => encodeURIComponent(id)).join(",");
  const outfitsUrl =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?id=in.(${inList})` +
    `&select=id,created_at,share_slug,image_path,style,spec,summary,products,like_count,share_count,apply_count,is_public`;

  const or = await fetch(outfitsUrl, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const oText = await or.text();
  if (!or.ok) {
    return json(res, 500, { error: "Outfits query failed", status: or.status, detail: oText });
  }

  const outfitRows = JSON.parse(oText || "[]");
  const map = new Map(outfitRows.map((x) => [x.id, x]));

  const items = ids
    .map((id) => map.get(id))
    .filter(Boolean)
    .map((row) => ({
      ...row,
      image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
      share_url: row.share_slug ? `/share/${row.share_slug}` : "",
    }));

  return json(res, 200, { ok: true, items, limit });
}

/** ===================== Outfits: Like ===================== */
async function handleOutfitsLike(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const body = req.body || {};
  const outfitId = String(body.outfit_id || "").trim();
  const anonId = String(body.anon_id || "").trim();

  if (!outfitId) return json(res, 400, { error: "Missing outfit_id" });

  let userId = null;
  const accessToken = getBearer(req);
  if (accessToken) {
    const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
    if (u.ok) userId = u.user?.id || null;
  }

  if (!userId && !anonId) return json(res, 400, { error: "Need user or anon_id" });

  const outfitCheckUrl =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?id=eq.${encodeURIComponent(outfitId)}` +
    `&select=id,like_count` +
    `&limit=1`;

  const check = await fetch(outfitCheckUrl, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const checkText = await check.text();
  if (!check.ok) return json(res, 500, { error: "Outfit check failed", status: check.status, detail: checkText });

  const checkRows = JSON.parse(checkText || "[]");
  const outfitRow = checkRows?.[0];
  if (!outfitRow) return json(res, 404, { error: "Outfit not found" });

  const existingFilter = userId
    ? `outfit_id=eq.${encodeURIComponent(outfitId)}&user_id=eq.${encodeURIComponent(userId)}`
    : `outfit_id=eq.${encodeURIComponent(outfitId)}&anon_id=eq.${encodeURIComponent(anonId)}`;

  const existingUrl = `${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}?${existingFilter}&select=id&limit=1`;
  const existing = await fetch(existingUrl, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const existingText = await existing.text();
  if (!existing.ok) return json(res, 500, { error: "Like check failed", status: existing.status, detail: existingText });

  const existingRows = JSON.parse(existingText || "[]");
  if (existingRows?.length) {
    return json(res, 200, { ok: true, liked: true, already_exists: true, like_count: Number(outfitRow.like_count || 0) });
  }

  const insertPayload = {
    outfit_id: outfitId,
    user_id: userId || null,
    anon_id: userId ? null : anonId || null,
  };

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(insertPayload),
  });

  const insertText = await insert.text();
  if (!insert.ok) return json(res, 500, { error: "Like insert failed", status: insert.status, detail: insertText });

  const nextLikeCount = Math.max(0, Number(outfitRow.like_count || 0) + 1);
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      like_count: nextLikeCount,
      updated_at: new Date().toISOString(),
    }),
  });

  const updText = await upd.text();
  if (!upd.ok) return json(res, 500, { error: "Like count update failed", status: upd.status, detail: updText });

  return json(res, 200, { ok: true, liked: true, like_count: nextLikeCount });
}

/** ===================== Outfits: Unlike ===================== */
async function handleOutfitsUnlike(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const body = req.body || {};
  const outfitId = String(body.outfit_id || "").trim();
  const anonId = String(body.anon_id || "").trim();

  if (!outfitId) return json(res, 400, { error: "Missing outfit_id" });

  let userId = null;
  const accessToken = getBearer(req);
  if (accessToken) {
    const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
    if (u.ok) userId = u.user?.id || null;
  }

  if (!userId && !anonId) return json(res, 400, { error: "Need user or anon_id" });

  const existingFilter = userId
    ? `outfit_id=eq.${encodeURIComponent(outfitId)}&user_id=eq.${encodeURIComponent(userId)}`
    : `outfit_id=eq.${encodeURIComponent(outfitId)}&anon_id=eq.${encodeURIComponent(anonId)}`;

  const del = await fetch(`${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}?${existingFilter}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Prefer: "return=minimal",
    },
  });

  const delText = await del.text();
  if (!del.ok) return json(res, 500, { error: "Unlike delete failed", status: del.status, detail: delText });

  const getOutfit = await fetch(
    `${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}&select=like_count&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Accept: "application/json",
      },
    }
  );

  const getText = await getOutfit.text();
  if (!getOutfit.ok) return json(res, 500, { error: "Outfit fetch failed", status: getOutfit.status, detail: getText });

  const rows = JSON.parse(getText || "[]");
  const row = rows?.[0];
  const nextLikeCount = Math.max(0, Number(row?.like_count || 0) - 1);

  const upd = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      like_count: nextLikeCount,
      updated_at: new Date().toISOString(),
    }),
  });

  const updText = await upd.text();
  if (!upd.ok) return json(res, 500, { error: "Unlike count update failed", status: upd.status, detail: updText });

  return json(res, 200, { ok: true, liked: false, like_count: nextLikeCount });
}

/** ===================== Outfits: Share ===================== */
async function handleOutfitsShare(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const body = req.body || {};
  const outfitId = String(body.outfit_id || "").trim();
  if (!outfitId) return json(res, 400, { error: "Missing outfit_id" });

  const getUrl =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?id=eq.${encodeURIComponent(outfitId)}` +
    `&select=id,share_count,share_slug,is_public` +
    `&limit=1`;

  const got = await fetch(getUrl, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const gotText = await got.text();
  if (!got.ok) return json(res, 500, { error: "Fetch failed", status: got.status, detail: gotText });

  const rows = JSON.parse(gotText || "[]");
  const row = rows?.[0];
  if (!row) return json(res, 404, { error: "Outfit not found" });

  const nextShareCount = Math.max(0, Number(row.share_count || 0) + 1);

  const upd = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      share_count: nextShareCount,
      updated_at: new Date().toISOString(),
    }),
  });

  const updText = await upd.text();
  if (!upd.ok) return json(res, 500, { error: "Share count update failed", status: upd.status, detail: updText });

  return json(res, 200, {
    ok: true,
    share_count: nextShareCount,
    share_slug: row.share_slug || null,
    is_public: !!row.is_public,
    share_url: row.share_slug ? `/share/${row.share_slug}` : "",
  });
}

/** ===================== Products ===================== */
function normalizeText(value) {
  return String(value || "").trim();
}

function tokenizeForMatch(value) {
  const stop = new Set([
    "the", "and", "with", "for", "look", "style", "daily", "casual", "fashion",
    "item", "outfit", "wear", "single", "piece", "clothing", "woman", "women",
    "man", "men", "unisex", "top", "bottom", "shoes", "shoe", "bag", "hat", "outer"
  ]);

  return Array.from(
    new Set(
      normalizeText(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((x) => x.trim())
        .filter((x) => x && x.length > 2 && !stop.has(x))
    )
  );
}

function slotTags(slot) {
  const s = normalizeText(slot).toLowerCase();
  if (s === "top") return ["item_top", "top", "shirt", "tee", "tshirt", "blouse", "knit", "hoodie", "sweater"];
  if (s === "bottom") return ["item_bottom", "bottom", "pants", "jeans", "trousers", "shorts", "skirt"];
  if (s === "shoes") return ["item_shoes", "shoes", "shoe", "sneaker", "boots", "loafers", "heels"];
  if (s === "outer") return ["item_outerwear", "outer", "jacket", "coat", "cardigan", "blazer", "hoodie"];
  if (s === "bag") return ["item_bag", "bag", "tote", "backpack", "shoulder"];
  if (s === "hat") return ["item_hat", "hat", "cap", "beanie"];
  return [s];
}

function scoreCustomProduct(row, item) {
  const slot = normalizeText(item?.slot).toLowerCase();
  const label = normalizeText(item?.label);
  const description = normalizeText(item?.description);
  const title = normalizeText(row?.title).toLowerCase();
  const tags = Array.isArray(row?.tags) ? row.tags.map((x) => normalizeText(x).toLowerCase()) : [];
  const haystack = [title, ...tags].join(" ");

  let score = 0;

  for (const tag of slotTags(slot)) {
    if (haystack.includes(tag)) {
      score += 24;
      break;
    }
  }

  const strongTokens = tokenizeForMatch(`${label} ${description}`);
  for (const token of strongTokens) {
    if (title.includes(token)) {
      score += 10;
    } else if (tags.some((t) => t.includes(token))) {
      score += 6;
    }
  }

  score += Math.max(0, Number(row?.priority_boost || 0)) * 4;

  return score;
}

async function handleProducts(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });

  const { SUPABASE_URL, SERVICE_ROLE } = env;
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const limitPerSlot = Math.max(1, Math.min(Number(body.limitPerSlot || 3), 3));

  if (!items.length) {
    return json(res, 200, { ok: true, products: [] });
  }

  let pool = [];
  try {
    const poolUrl =
      `${SUPABASE_URL}/rest/v1/custom_products` +
      `?select=id,is_active,title,image_url,product_url,merchant,tags,priority_boost,badge_text` +
      `&is_active=eq.true` +
      `&order=priority_boost.desc.nullslast`;

    const poolResp = await fetch(poolUrl, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Accept: "application/json",
      },
    });

    const poolText = await poolResp.text();
    pool = poolResp.ok ? JSON.parse(poolText || "[]") : [];
  } catch {
    pool = [];
  }

  const results = items.map((item) => {
    const slot = normalizeText(item?.slot);
    const label = normalizeText(item?.label || item?.name || slot || "單品");
    const description = normalizeText(item?.description);

    const ranked = pool
      .map((row) => ({
        ...row,
        _score: scoreCustomProduct(row, { slot, label, description }),
      }))
      .filter((row) => row._score >= 26)
      .sort((a, b) => b._score - a._score)
      .slice(0, limitPerSlot)
      .map((row) => ({
        title: row.title,
        image_url: row.image_url,
        product_url: row.product_url,
        url: row.product_url,
        merchant: row.merchant,
        badge_text: row.badge_text && row.badge_text !== "NULL" ? row.badge_text : "",
      }));

    const fallbackQuery =
      [description, label].filter(Boolean).join(" ").trim() ||
      [label, slot].filter(Boolean).join(" ");

    return {
      slot,
      label,
      description,
      candidates: ranked.length
        ? ranked
        : Array.from({ length: limitPerSlot }).map((_, i) => ({
            title: `${label} 類似商品 ${i + 1}`,
            image_url: "",
            product_url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(fallbackQuery)}`,
            url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(fallbackQuery)}`,
            merchant: "Google Shopping",
            badge_text: "",
          })),
    };
  });

  return json(res, 200, {
    ok: true,
    products: results,
  });
}

/** ===================== User Settings ===================== */
async function handleUserSettingsGet(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const accessToken = getBearer(req);
  if (!accessToken) return json(res, 200, { ok: true, item: null });

  const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
  if (!u.ok) return json(res, 200, { ok: true, item: null });

  const url =
    `${SUPABASE_URL}/rest/v1/user_settings` +
    `?user_id=eq.${encodeURIComponent(u.user.id)}` +
    `&select=id,user_id,gender,audience,system,updated_at` +
    `&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const text = await r.text();
  if (!r.ok) return json(res, 500, { error: "Query failed", status: r.status, detail: text });

  const rows = JSON.parse(text || "[]");
  return json(res, 200, { ok: true, item: rows?.[0] || null });
}

async function handleUserSettingsUpsert(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const accessToken = getBearer(req);
  if (!accessToken) return json(res, 401, { error: "Missing bearer token" });

  const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
  if (!u.ok) return json(res, 401, { error: "Invalid token", detail: u.detail });

  const body = req.body || {};
  const row = {
    user_id: u.user.id,
    updated_at: new Date().toISOString(),
  };

  if ("gender" in body) row.gender = body.gender || null;
  if ("audience" in body) row.audience = body.audience || null;
  if ("system" in body) row.system = body.system || null;

  const r = await fetch(
  `${SUPABASE_URL}/rest/v1/user_settings?on_conflict=user_id`,
  {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  }
);

  const text = await r.text();
  if (!r.ok) return json(res, 500, { error: "Upsert failed", status: r.status, detail: text });

  const rows = JSON.parse(text || "[]");
  return json(res, 200, { ok: true, item: rows?.[0] || null });
}

/** ===================== Router ===================== */
export default async function handler(req, res) {
  try {
    const op = String(req.query.op || "").trim();

    if (op === "explore") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
      return await handleExplore(req, res);
    }

    if (op === "share") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
      return await handleShare(req, res);
    }

    if (op === "outfits.create") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsCreate(req, res);
    }

    if (op === "outfits.update") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsUpdate(req, res);
    }

    if (op === "outfits.recent") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsRecent(req, res);
    }

    if (op === "outfits.favorites") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsFavorites(req, res);
    }

    if (op === "outfits.like") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsLike(req, res);
    }

    if (op === "outfits.unlike") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsUnlike(req, res);
    }

    if (op === "outfits.share") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsShare(req, res);
    }

    if (op === "user.settings.get") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
      return await handleUserSettingsGet(req, res);
    }

    if (op === "user.settings.upsert") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleUserSettingsUpsert(req, res);
    }

    if (op === "products") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleProducts(req, res);
    }

    return json(res, 400, {
      error: "Unknown op",
      allowed: [
        "explore",
        "share",
        "outfits.create",
        "outfits.update",
        "outfits.recent",
        "outfits.favorites",
        "outfits.like",
        "outfits.unlike",
        "outfits.share",
        "user.settings.get",
        "user.settings.upsert",
        "products",
      ],
    });
  } catch (e) {
    return json(res, 500, { error: "Unhandled", detail: String(e?.message || e) });
  }
}
