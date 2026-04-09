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
async function handleProducts(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const { items = [], limitPerSlot = 3 } = req.body || {};

  if (!items.length) {
    return json(res, 200, { ok: true, products: [] });
  }

  const results = [];

  for (const item of items) {
    const keyword = item.label || item.slot;

    try {
      // 👉 1. 先抓自訂商品（你後台）
      const url =
        `${SUPABASE_URL}/rest/v1/custom_products` +
        `?keyword=ilike.*${encodeURIComponent(keyword)}*` +
        `&limit=${limitPerSlot}`;

      const r = await fetch(url, {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      });

      const text = await r.text();
      const rows = r.ok ? JSON.parse(text || "[]") : [];

      let candidates = rows.map((row) => ({
        title: row.title,
        url: row.url,
      }));

      // 👉 2. fallback（假資料 / 未來 Google）
      if (!candidates.length) {
        candidates = Array.from({ length: limitPerSlot }).map((_, i) => ({
          title: `${keyword} 類似商品 ${i + 1}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}`,
        }));
      }

      results.push({
        slot: item.slot,
        label: item.label,
        candidates,
      });
    } catch (e) {
      results.push({
        slot: item.slot,
        label: item.label,
        candidates: [],
      });
    }
  }

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
