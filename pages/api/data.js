// pages/api/data.js
// Unified API router

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

function getBearer(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function buildPublicImageUrl(SUPABASE_URL, image_path) {
  return image_path ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${image_path}` : "";
}

function makeShareSlug() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

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
      : "like_count.desc";

  const url =
    `${SUPABASE_URL}/rest/v1/outfits` +
    `?is_public=eq.true` +
    `&share_slug=not.is.null` +
    `&select=id,created_at,share_slug,image_path,style,spec,summary,products,like_count,share_count,apply_count` +
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
    `&select=id,created_at,spec,style,summary,products,image_path,share_slug,like_count,share_count,apply_count` +
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
  if (!row) return json(res, 404, { error: "Not found" });

  const image_url = buildPublicImageUrl(SUPABASE_URL, row.image_path);
  return json(res, 200, { ok: true, outfit: { ...row, image_url } });
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
  const image_path = body.image_path || "";
  const image_url = body.image_url || "";
  let share_slug = body.share_slug || null;
  const is_public = body.is_public ?? true;

  const spec = body.spec ?? body.specObj ?? null;
  const style = body.style ?? null;
  const summary = body.summary ?? null;
  const products = body.products ?? null;

  if (!image_path && !image_url) {
    return json(res, 400, { error: "Missing image_path (or image_url)" });
  }

  if (!share_slug) {
    share_slug = makeShareSlug();
  }

  const insertRow = {
    user_id: u.user.id,
    image_path: image_path || null,
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
const FAVORITES_TABLE = "outfit_likes";

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
    return json(res, 500, {
      error: "Outfits query failed",
      status: or.status,
      detail: oText,
    });
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

/** ===================== Products ===================== */
async function handleProducts(req, res) {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const limitPerSlot = Math.min(parseInt(body.limitPerSlot || "4", 10) || 4, 12);

  // 暫時先保留空結果；等你把 custom_products 的 tags 對應清楚後再補。
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
        "products",
      ],
    });
  } catch (e) {
    return json(res, 500, { error: "Unhandled", detail: String(e?.message || e) });
  }
}
