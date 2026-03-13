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
    return { ok: true, user: JSON.parse(text) };
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

async function fetchOutfitById({ SUPABASE_URL, SERVICE_ROLE, outfitId, select = "id,like_count,share_count,apply_count,share_slug,is_public,image_path" }) {
  const url = `${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}&select=${select}&limit=1`;
  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, detail: text };
  const rows = JSON.parse(text || "[]");
  return { ok: true, row: rows?.[0] || null };
}

/** ===================== Explore / Featured ===================== */
async function queryExploreRows({ SUPABASE_URL, SERVICE_ROLE, limit, offset, sort }) {
  const order =
    sort === "share"
      ? "share_count.desc"
      : sort === "apply"
      ? "apply_count.desc"
      : sort === "recent"
      ? "created_at.desc"
      : "like_count.desc";

  const url =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?is_public=eq.true` +
    `&share_slug=not.is.null` +
    `&image_path=not.is.null` +
    `&select=id,created_at,share_slug,image_path,style,spec,summary,products,like_count,share_count,apply_count,is_public` +
    `&order=${order},created_at.desc` +
    `&limit=${limit}&offset=${offset}`;

  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, detail: text };
  return { ok: true, rows: JSON.parse(text || "[]") };
}

async function handleExplore(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const limit = Math.min(parseInt(req.query.limit || "30", 10) || 30, 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);
  const sort = String(req.query.sort || "like").toLowerCase();

  const q = await queryExploreRows({ SUPABASE_URL, SERVICE_ROLE, limit, offset, sort });
  if (!q.ok) return json(res, 500, { error: "Query failed", status: q.status, detail: q.detail });

  const items = q.rows.map((row) => ({
    ...row,
    image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
    share_url: row.share_slug ? `/share/${row.share_slug}` : "",
  }));

  return json(res, 200, { ok: true, items, limit, offset, sort });
}

async function handleFeatured(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const limit = Math.min(parseInt(req.query.limit || "10", 10) || 10, 20);
  const q = await queryExploreRows({ SUPABASE_URL, SERVICE_ROLE, limit: 100, offset: 0, sort: "recent" });
  if (!q.ok) return json(res, 500, { error: "Query failed", status: q.status, detail: q.detail });

  const now = Date.now();
  const items = q.rows
    .map((row) => {
      const hours = Math.max((now - new Date(row.created_at).getTime()) / 3600000, 0);
      const recency = 1 / (hours + 2);
      const score = Number(row.like_count || 0) * 3 + Number(row.share_count || 0) * 2 + Number(row.apply_count || 0) * 2 + recency;
      return {
        ...row,
        score,
        image_url: buildPublicImageUrl(SUPABASE_URL, row.image_path),
        share_url: row.share_slug ? `/share/${row.share_slug}` : "",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return json(res, 200, { ok: true, items, limit });
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
    return json(res, 404, { error: "Not found", hint: "slug not found or outfit is not public" });
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
  const patch = { updated_at: new Date().toISOString() };

  if ("products" in body) patch.products = body.products;
  if ("spec" in body) patch.spec = body.spec;
  if ("style" in body) patch.style = body.style;
  if ("summary" in body) patch.summary = body.summary;
  if ("is_public" in body) patch.is_public = !!body.is_public;
  if ("share_slug" in body) patch.share_slug = body.share_slug || null;
  if ("image_path" in body) patch.image_path = body.image_path || null;

  const url = `${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(u.user.id)}`;
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

  if (!userId && !anonId) return json(res, 200, { ok: true, items: [], limit });

  const filter = userId ? `user_id=eq.${encodeURIComponent(userId)}` : `anon_id=eq.${encodeURIComponent(anonId)}`;

  const favUrl = `${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}?${filter}&select=outfit_id,created_at&order=created_at.desc&limit=${limit}`;
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
  const outfitsUrl = `${SUPABASE_URL}/rest/v1/outfits?id=in.(${inList})&select=id,created_at,share_slug,image_path,style,spec,summary,products,like_count,share_count,apply_count,is_public`;
  const or = await fetch(outfitsUrl, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Accept: "application/json",
    },
  });

  const oText = await or.text();
  if (!or.ok) return json(res, 500, { error: "Outfits query failed", status: or.status, detail: oText });

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

  const checked = await fetchOutfitById({ SUPABASE_URL, SERVICE_ROLE, outfitId, select: "id,like_count" });
  if (!checked.ok) return json(res, 500, { error: "Outfit check failed", status: checked.status, detail: checked.detail });
  if (!checked.row) return json(res, 404, { error: "Outfit not found" });

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
  if (existingRows?.length) return json(res, 200, { ok: true, liked: false, already_exists: true, like_count: Number(checked.row.like_count || 0) });

  const insertPayload = { outfit_id: outfitId, user_id: userId || null, anon_id: userId ? null : anonId || null };
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

  const nextLikeCount = Math.max(0, Number(checked.row.like_count || 0) + 1);
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ like_count: nextLikeCount, updated_at: new Date().toISOString() }),
  });
  const updText = await upd.text();
  if (!upd.ok) return json(res, 500, { error: "Like count update failed", status: upd.status, detail: updText });

  return json(res, 200, { ok: true, liked: true, like_count: nextLikeCount });
}

/** ===================== Outfits: Share ===================== */
async function handleOutfitsShare(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const body = req.body || {};
  const outfitId = String(body.outfit_id || "").trim();
  if (!outfitId) return json(res, 400, { error: "Missing outfit_id" });

  const checked = await fetchOutfitById({ SUPABASE_URL, SERVICE_ROLE, outfitId, select: "id,share_count,share_slug,is_public" });
  if (!checked.ok) return json(res, 500, { error: "Fetch failed", status: checked.status, detail: checked.detail });
  if (!checked.row) return json(res, 404, { error: "Outfit not found" });

  const nextShareCount = Math.max(0, Number(checked.row.share_count || 0) + 1);
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ share_count: nextShareCount, updated_at: new Date().toISOString() }),
  });
  const updText = await upd.text();
  if (!upd.ok) return json(res, 500, { error: "Share count update failed", status: upd.status, detail: updText });

  return json(res, 200, {
    ok: true,
    share_count: nextShareCount,
    share_slug: checked.row.share_slug || null,
    is_public: !!checked.row.is_public,
    share_url: checked.row.share_slug ? `/share/${checked.row.share_slug}` : "",
  });
}

/** ===================== Outfits: Apply ===================== */
async function handleOutfitsApply(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });
  const { SUPABASE_URL, SERVICE_ROLE } = env;

  const body = req.body || {};
  const outfitId = String(body.outfit_id || "").trim();
  if (!outfitId) return json(res, 400, { error: "Missing outfit_id" });

  const checked = await fetchOutfitById({ SUPABASE_URL, SERVICE_ROLE, outfitId, select: "id,apply_count,style" });
  if (!checked.ok) return json(res, 500, { error: "Fetch failed", status: checked.status, detail: checked.detail });
  if (!checked.row) return json(res, 404, { error: "Outfit not found" });

  const nextApplyCount = Math.max(0, Number(checked.row.apply_count || 0) + 1);
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/outfits?id=eq.${encodeURIComponent(outfitId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ apply_count: nextApplyCount, updated_at: new Date().toISOString() }),
  });
  const updText = await upd.text();
  if (!upd.ok) return json(res, 500, { error: "Apply count update failed", status: upd.status, detail: updText });

  return json(res, 200, { ok: true, apply_count: nextApplyCount, style: checked.row.style || null });
}

/** ===================== Products ===================== */
async function handleProducts(req, res) {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const limitPerSlot = Math.min(parseInt(body.limitPerSlot || "4", 10) || 4, 12);

  return json(res, 200, {
    ok: true,
    products: null,
    hint: "Wire products mapping from custom_products here",
    received_slots: items.map((x) => x.slot),
    limitPerSlot,
  });
}

/** ===================== Router ===================== */
export default async function handler(req, res) {
  try {
    const op = String(req.query.op || "").trim();

    if (op === "explore") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
      return await handleExplore(req, res);
    }
    if (op === "featured") {
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
      return await handleFeatured(req, res);
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
    if (op === "outfits.share") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsShare(req, res);
    }
    if (op === "outfits.apply") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleOutfitsApply(req, res);
    }
    if (op === "products") {
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      return await handleProducts(req, res);
    }

    return json(res, 400, {
      error: "Unknown op",
      allowed: [
        "explore",
        "featured",
        "share",
        "outfits.create",
        "outfits.update",
        "outfits.recent",
        "outfits.favorites",
        "outfits.like",
        "outfits.share",
        "outfits.apply",
        "products",
      ],
    });
  } catch (e) {
    return json(res, 500, { error: "Unhandled", detail: String(e?.message || e) });
  }
}
