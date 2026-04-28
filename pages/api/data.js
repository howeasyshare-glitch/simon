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

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeTokens(value) {
  return normalizeLower(value)
    .split(/[\s,./\-_"'()|]+/)
    .map((x) => x.trim())
    .filter((x) => x && x.length > 1);
}

function containsAnyProductText(text, words = []) {
  const t = normalizeLower(text);
  return words.some((w) => t.includes(normalizeLower(w)));
}

function slotTagFor(slot) {
  const s = normalizeLower(slot);
  if (s === "outer") return "item_outerwear";
  if (s === "top") return "item_top";
  if (s === "bottom") return "item_bottom";
  if (s === "shoes") return "item_shoes";
  if (s === "bag") return "item_bag";
  if (s === "hat") return "item_hat";
  return "";
}

function rowTags(row) {
  if (Array.isArray(row?.tags)) return row.tags.map((x) => normalizeLower(x));
  if (typeof row?.tags === "string") {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) return parsed.map((x) => normalizeLower(x));
    } catch {}
    return row.tags.split(/[\s,|]+/).map((x) => normalizeLower(x)).filter(Boolean);
  }
  return [];
}

function productCombinedText(row) {
  return normalizeLower([
    row?.title,
    row?.merchant,
    row?.product_url,
    row?.url,
    ...(rowTags(row) || []),
  ].filter(Boolean).join(" "));
}

function getItemText(item) {
  return normalizeLower([
    item?.slot,
    item?.label,
    item?.name,
    item?.display_name_zh,
    item?.generic_name,
    item?.category,
    item?.description,
    item?.shopping_query,
    item?.color,
    item?.fit,
    item?.material,
    item?.sleeve_length,
    item?.neckline,
    ...(Array.isArray(item?.style_keywords) ? item.style_keywords : []),
  ].filter(Boolean).join(" "));
}

function getItemCategoryType(item) {
  const slot = normalizeLower(item?.slot);
  const text = getItemText(item);

  if (slot === "outer") {
    if (text.includes("cardigan") || text.includes("開襟") || text.includes("針織外套") || text.includes("毛衣外套")) return "cardigan";
    if (text.includes("blazer") || text.includes("西裝外套") || text.includes("西外")) return "blazer";
    if (text.includes("corduroy") || text.includes("燈芯絨")) return "corduroy_outer";
    if (text.includes("hoodie") || text.includes("連帽")) return "hoodie";
    if (text.includes("bomber") || text.includes("飛行")) return "bomber";
    return "outer";
  }

  if (slot === "top") {
    if (text.includes("ribbed") || text.includes("羅紋")) return "ribbed_knit_top";
    if (text.includes("knit polo") || text.includes("針織polo")) return "knit_polo";
    if (text.includes("polo")) return "polo";
    if (text.includes("knit") || text.includes("針織")) return "knit_top";
    if (text.includes("shirt") || text.includes("襯衫")) return "shirt";
    if (text.includes("t-shirt") || text.includes("tee") || text.includes("t恤")) return "tee";
    return "top";
  }

  if (slot === "bottom") {
    if (text.includes("wide") || text.includes("寬褲") || text.includes("寬腿")) return "wide_pants";
    if (text.includes("jeans") || text.includes("denim") || text.includes("牛仔")) return "jeans";
    if (text.includes("cargo") || text.includes("工裝")) return "cargo";
    if (text.includes("shorts") || text.includes("短褲")) return "shorts";
    return "bottom";
  }

  if (slot === "shoes") {
    if (text.includes("low-top") || text.includes("小白鞋") || text.includes("white shoes")) return "low_top_leather_sneakers";
    if (text.includes("chelsea") || text.includes("切爾西")) return "chelsea_boots";
    if (text.includes("loafer") || text.includes("樂福")) return "loafers";
    if (text.includes("sneaker") || text.includes("休閒鞋") || text.includes("運動鞋")) return "sneakers";
    return "shoes";
  }

  if (slot === "bag") {
    if (text.includes("crossbody") || text.includes("斜背") || text.includes("側背")) return "crossbody_bag";
    if (text.includes("tote") || text.includes("托特")) return "tote";
    if (text.includes("backpack") || text.includes("後背")) return "backpack";
    return "bag";
  }

  return slot || "unknown";
}

function broadSlotWords(slot) {
  const s = normalizeLower(slot);
  if (s === "outer") return ["外套", "夾克", "jacket", "outer", "cardigan", "blazer", "開襟", "針織外套", "西裝外套", "連帽外套"];
  if (s === "top") return ["上衣", "t恤", "tee", "shirt", "襯衫", "polo", "針織", "毛衣"];
  if (s === "bottom") return ["褲", "pants", "trousers", "jeans", "牛仔", "短褲", "寬褲"];
  if (s === "shoes") return ["鞋", "shoe", "sneaker", "休閒鞋", "運動鞋", "靴", "loafer", "樂福"];
  if (s === "bag") return ["包", "bag", "斜背", "側背", "tote", "托特", "後背"];
  return [];
}

function specificCategoryWords(type) {
  const map = {
    cardigan: ["開襟", "針織外套", "毛衣外套", "cardigan", "knit"],
    blazer: ["西裝外套", "西外", "blazer", "翻領"],
    corduroy_outer: ["燈芯絨", "corduroy", "西裝外套", "襯衫外套", "外套"],
    hoodie: ["連帽", "hoodie", "hooded", "zip hoodie"],
coat: ["coat", "parka", "trench", "大衣"],
jacket: ["jacket", "夾克", "denim", "bomber", "utility", "varsity"],
    
    bomber: ["飛行外套", "bomber", "夾克"],
    ribbed_knit_top: ["羅紋", "ribbed", "針織", "knit", "長袖上衣"],
    knit_polo: ["針織polo", "polo", "針織", "knit"],
    polo: ["polo", "polo衫"],
    knit_top: ["針織", "knit", "毛衣", "上衣"],
    shirt: ["襯衫", "shirt"],
    tee: ["t恤", "t-shirt", "tee"],
    wide_pants: ["寬褲", "寬腿", "wide leg", "西裝褲", "長褲"],
    jeans: ["牛仔", "denim", "jeans", "直筒"],
    cargo: ["工裝", "cargo", "機能褲"],
    shorts: ["短褲", "shorts"],
    low_top_leather_sneakers: ["小白鞋", "真皮", "皮革", "低筒", "休閒鞋", "運動鞋", "sneaker", "leather"],
    chelsea_boots: ["切爾西", "chelsea", "短靴", "靴"],
    loafers: ["樂福", "loafer"],
    sneakers: ["休閒鞋", "運動鞋", "sneaker"],
    crossbody_bag: ["斜背", "側背", "crossbody", "小包"],
    tote: ["托特", "tote"],
    backpack: ["後背", "backpack", "書包"],
  };
  return map[type] || [];
}

function customGuard(row, item) {
  const slot = normalizeLower(item?.slot);
  const tags = rowTags(row);
  const text = productCombinedText(row);
  const slotTag = slotTagFor(slot);
  const existingItemTags = tags.filter((t) => t.startsWith("item_"));

  if (existingItemTags.length > 0 && slotTag && !tags.includes(slotTag)) {
    return { ok: false, reason: `slot tag mismatch: expected ${slotTag}` };
  }

  const broadWords = broadSlotWords(slot);
  const broadMatched = Boolean(slotTag && tags.includes(slotTag)) || containsAnyProductText(text, broadWords);
  if (!broadMatched) {
    return { ok: false, reason: `slot keyword mismatch: ${slot || "unknown"}` };
  }

  const type = getItemCategoryType(item);
  const specificWords = specificCategoryWords(type);
  const specificMatched = !specificWords.length || containsAnyProductText(text, specificWords);

  // Important: when the requested item is a specific subtype, reject broad custom products.
  // Example: cardigan should not accept a leather denim jacket just because both are outerwear.
  const specificTypesThatMustMatch = [
    "cardigan",
  "blazer",
  "hoodie",
  "coat",
  "jacket",
  "corduroy_outer",
  "ribbed_knit_top",
  "knit_polo",
  "wide_pants",
  "jeans",
  "low_top_leather_sneakers",
  "chelsea_boots",
  "crossbody_bag",
  ];

  if (specificTypesThatMustMatch.includes(type) && !specificMatched) {
    return { ok: false, reason: `specific category mismatch: ${type}` };
  }

  const itemText = getItemText(item);
  if ((itemText.includes("female") || itemText.includes("女")) && tags.includes("gender_male")) {
    return { ok: false, reason: "gender mismatch: male custom for female item" };
  }
  if ((itemText.includes("male") || itemText.includes("男")) && tags.includes("gender_female")) {
    return { ok: false, reason: "gender mismatch: female custom for male item" };
  }
  if ((itemText.includes("kids") || itemText.includes("童")) && tags.includes("audience_adult")) {
    return { ok: false, reason: "audience mismatch: adult custom for kids item" };
  }

  return { ok: true, reason: "matched" };
}

function scoreCustomProduct(row, item) {
  const tags = rowTags(row);
  const slotTag = slotTagFor(item?.slot);
  const text = productCombinedText(row);
  const itemText = getItemText(item);
  const tokenSet = Array.from(new Set([
    ...normalizeTokens(item?.label),
    ...normalizeTokens(item?.display_name_zh),
    ...normalizeTokens(item?.generic_name),
    ...normalizeTokens(item?.category),
    ...normalizeTokens(item?.description),
    ...normalizeTokens(item?.shopping_query),
    ...normalizeTokens(item?.color),
    ...normalizeTokens(item?.material),
  ]));

  let category_score = 0;
  let text_score = 0;
  let tag_score = 0;
  let boost_score = Number(row?.priority_boost || 0) * 10;

  if (slotTag && tags.includes(slotTag)) category_score += 80;

  const type = getItemCategoryType(item);
  const specificWords = specificCategoryWords(type);
  for (const w of specificWords) {
    if (text.includes(normalizeLower(w))) category_score += 18;
  }

  for (const token of tokenSet) {
    if (!token || token.length <= 1) continue;
    if (text.includes(token)) text_score += 6;
    if (tags.some((t) => t.includes(token))) tag_score += 8;
  }

  // Penalize known near-miss cases.
  if (type === "cardigan" && containsAnyProductText(text, ["丹寧", "皮革拼接", "牛仔外套"])) category_score -= 60;
  if (type === "low_top_leather_sneakers" && containsAnyProductText(text, ["拖鞋", "涼鞋", "半拖"])) category_score -= 50;
  if (type === "knit_polo" && containsAnyProductText(text, ["工作服", "制服"])) category_score -= 30;
  if (type === "hoodie" && containsAnyProductText(text, ["丹寧外套", "皮革拼接", "blazer"])) {
  category_score -= 70;
}


if (type === "blazer" && containsAnyProductText(text, ["hoodie", "連帽"])) {
  category_score -= 60;
}

  const custom_score = category_score + text_score + tag_score + boost_score;
  const quality_score = Math.max(0, Math.round(custom_score));

  return {
    custom_score,
    quality_score,
    category_score,
    text_score,
    tag_score,
    boost_score,
    item_category_type: type,
  };
}
function brandQualityBoost(product) {
  const text = productCombinedText(product);

  let s = 0;

  if (containsAnyProductText(text, [
    "uniqlo",
    "gu",
    "muji",
    "無印良品",
    "net",
    "lativ",
    "levis",
    "lee",
    "blue way",
    "decathlon",
    "迪卡儂",
    "cos",
    "zara",
    "adidas",
    "nike",
    "fila",
    "new balance",
    "timberland",
    "momo購物網",
    "pchome 24h",
    "pinkoi"
  ])) {
    s += 12;
  }

  return s;
}

function lowQualityTitlePenalty(product) {
  const title = normalizeLower(product?.title || "");
  let p = 0;

  if (title.length > 80) p -= 8;

  if (containsAnyProductText(title, [
    "超取免運290",
    "全店免運",
    "免運券",
    "大碼",
    "爆款",
    "下殺",
    "清倉",
    "直播",
    "批發",
    "淘寶",
    "韓版",
    " ins ",
    "小眾設計"
  ])) {
    p -= 10;
  }

  if (containsAnyProductText(title, [
    "男 女",
    "男女同款",
    "男t 女t",
    "女男",
    "男生女生"
  ])) {
    p -= 6;
  }

  return p;
}
function scoreExternalProduct(product, item) {
  const text = productCombinedText(product);
  const type = getItemCategoryType(item);
  const specificWords = specificCategoryWords(type);
  const slot = normalizeLower(item?.slot);

  let category_score = 0;
  let taiwan_score = isLikelyProductTaiwan(product) ? 30 : 0;
  let text_score = 0;

  if (containsAnyProductText(text, broadSlotWords(slot))) category_score += 20;
  for (const w of specificWords) {
    if (text.includes(normalizeLower(w))) category_score += 10;
  }

  for (const token of [
    ...normalizeTokens(item?.display_name_zh),
    ...normalizeTokens(item?.generic_name),
    ...normalizeTokens(item?.category),
    ...normalizeTokens(item?.color),
    ...normalizeTokens(item?.material),
  ]) {
    if (text.includes(token)) text_score += 3;
  }

  const brand_score = brandQualityBoost(product);
const title_penalty = lowQualityTitlePenalty(product);

const quality_score = Math.max(
  0,
  Math.round(category_score + taiwan_score + text_score + brand_score + title_penalty)
);

return {
  quality_score,
  category_score,
  taiwan_score,
  text_score,
  brand_score,
  title_penalty,
};
}

function productDedupeKey(product) {
  const title = normalizeLower(product?.title).replace(/\s+/g, " ").slice(0, 80);
  const merchant = normalizeLower(product?.merchant).replace(/\s+/g, " ");
  if (title && merchant) return `${title}__${merchant}`;
  return normalizeLower(product?.product_url || product?.url || product?.google_detail_url || title);
}

function isLikelyProductTaiwan(product) {
  const text = productCombinedText(product);
  return containsAnyProductText(text, [
    "shopee.tw",
    "蝦皮",
    "momo",
    "momoshop",
    "momo購物",
    "pchome",
    "tw.buy.yahoo",
    "tw.mall.yahoo",
    "yahoo購物",
    "pinkoi",
    "酷澎",
    "coupang",
    ".tw/",
    ".com.tw",
    "taiwan",
    "台灣",
  ]);
}

async function handleProducts(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });

  const { SUPABASE_URL, SERVICE_ROLE } = env;
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const limitPerSlot = Math.max(1, Math.min(Number(body.limitPerSlot || 3), 3));

  if (!items.length) {
    return json(res, 200, { ok: true, products: [], debug: [] });
  }

  let pool = [];
  try {
    const poolUrl =
      `${SUPABASE_URL}/rest/v1/custom_products` +
      `?select=id,is_active,title,image_url,product_url,merchant,tags,priority_boost,badge_text` +
      `&is_active=eq.true` +
      `&order=priority_boost.desc`;

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

  const SCORE_THRESHOLD = 80;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const results = [];
  const debug = [];

  for (const item of items) {
    const slot = normalizeText(item?.slot);
    const label = normalizeText(
      item?.label ||
      item?.display_name_zh ||
      item?.generic_name ||
      item?.category ||
      item?.name ||
      slot ||
      "單品"
    );
    const description = normalizeText(item?.description);

    const customDebug = [];

    const customRanked = pool
      .map((row) => {
        const guard = customGuard(row, item);
        const scores = scoreCustomProduct(row, item);
        const keep = guard.ok && scores.custom_score >= SCORE_THRESHOLD && normalizeText(row?.product_url);
        customDebug.push({
          id: row.id,
          title: row.title,
          merchant: row.merchant,
          keep,
          reason: guard.reason,
          ...scores,
        });
        return { row, guard, scores, keep };
      })
      .filter((x) => x.keep)
      .sort((a, b) => b.scores.custom_score - a.scores.custom_score)
      .slice(0, limitPerSlot)
      .map(({ row, scores }) => ({
        title: row.title,
        image_url: row.image_url,
        product_url: row.product_url,
        url: row.product_url,
        google_detail_url: "",
        merchant: row.merchant,
        badge_text: row.badge_text && row.badge_text !== "NULL" ? row.badge_text : "",
        source: "custom",
        quality_score: scores.quality_score,
        category_score: scores.category_score,
        custom_score: scores.custom_score,
        taiwan_score: 30,
      }));

    const remaining = Math.max(0, limitPerSlot - customRanked.length);
    let searched = [];
    let searchDebug = null;
    let searchError = "";

    if (remaining > 0) {
      try {
        const r = await fetch(`${baseUrl}/api/search-products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [item],
            locale: "tw",
            gender: item.gender || body.gender || "neutral",
            audience: item.audience || body.audience || "adult",
            styleTag: item.scene || body.styleTag || null,
          }),
        });

        const data = await r.json();
        searchDebug = data?.debug || null;

        const slotProducts = data?.grouped?.[item.slot] || [];

        searched = slotProducts
  .map((p) => {
    const base = {
      title: p.title,
      image_url: p.thumbnail,
      product_url: p.link,
      url: p.link,
      merchant: p.merchant,
      source: p.source || "google",
    };
    const scores = scoreExternalProduct(base, item);
    return { ...base, ...scores };
  })
  .sort((a, b) => Number(b.quality_score || 0) - Number(a.quality_score || 0));
      } catch (e) {
        searchError = String(e?.message || e);
        searched = [];
      }
    }

    const merged = [];
    const seen = new Set();

    for (const c of [...customRanked, ...searched]) {
      const key = productDedupeKey(c);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
      if (merged.length >= limitPerSlot) break;
    }

    results.push({
      slot,
      label,
      description,
      shopping_query: normalizeText(item?.shopping_query),
      candidates: merged,
    });

    debug.push({
      version: "data.js V3.9 Custom Products Guard + Product Quality Score",
      slot,
      label,
      item_category_type: getItemCategoryType(item),
      custom: {
        totalPool: pool.length,
        kept: customRanked.length,
        threshold: SCORE_THRESHOLD,
        topReviewed: customDebug
          .sort((a, b) => Number(b.custom_score || 0) - Number(a.custom_score || 0))
          .slice(0, 8),
      },
      search: {
        requested: remaining > 0,
        returned: searched.length,
        error: searchError,
        debug: searchDebug,
      },
      final: merged.map((x) => ({
        title: x.title,
        merchant: x.merchant,
        source: x.source,
        quality_score: x.quality_score,
        category_score: x.category_score,
        custom_score: x.custom_score,
        taiwan_score: x.taiwan_score,
      })),
    });
  }

  return json(res, 200, { ok: true, products: results, debug });
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
