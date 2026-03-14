
// pages/api/data.js
// Unified API router (patched version)

const FAVORITES_TABLE = "outfit_likes";

function json(res, status, obj) {
  res.status(status).json(obj);
}

function getEnv() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return { ok: false, error: "Supabase env not set" };
  }
  return { ok: true, SUPABASE_URL, SERVICE_ROLE };
}

function getBearer(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

async function getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken }) {
  if (!accessToken) return { ok: false };
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!r.ok) return { ok: false };
  const user = await r.json();
  return { ok: true, user };
}

async function handleLike(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });

  const { SUPABASE_URL, SERVICE_ROLE } = env;
  const { outfit_id, anon_id } = req.body || {};

  if (!outfit_id) return json(res, 400, { error: "Missing outfit_id" });

  let userId = null;
  const accessToken = getBearer(req);

  if (accessToken) {
    const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
    if (u.ok) userId = u.user?.id || null;
  }

  if (!userId && !anon_id) {
    return json(res, 400, { error: "Need user or anon_id" });
  }

  const filter = userId
    ? `outfit_id=eq.${outfit_id}&user_id=eq.${userId}`
    : `outfit_id=eq.${outfit_id}&anon_id=eq.${anon_id}`;

  const check = await fetch(`${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}?${filter}`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });

  const existing = await check.json();
  if (existing.length) {
    return json(res, 200, { ok: true, liked: true });
  }

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      outfit_id,
      user_id: userId,
      anon_id: userId ? null : anon_id,
    }),
  });

  if (!ins.ok) {
    const t = await ins.text();
    return json(res, 500, { error: "Like insert failed", detail: t });
  }

  return json(res, 200, { ok: true, liked: true });
}

async function handleUnlike(req, res) {
  const env = getEnv();
  if (!env.ok) return json(res, 500, { error: env.error });

  const { SUPABASE_URL, SERVICE_ROLE } = env;
  const { outfit_id, anon_id } = req.body || {};

  if (!outfit_id) return json(res, 400, { error: "Missing outfit_id" });

  let userId = null;
  const accessToken = getBearer(req);

  if (accessToken) {
    const u = await getUserFromAccessToken({ SUPABASE_URL, SERVICE_ROLE, accessToken });
    if (u.ok) userId = u.user?.id || null;
  }

  const filter = userId
    ? `outfit_id=eq.${outfit_id}&user_id=eq.${userId}`
    : `outfit_id=eq.${outfit_id}&anon_id=eq.${anon_id}`;

  const del = await fetch(`${SUPABASE_URL}/rest/v1/${FAVORITES_TABLE}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });

  if (!del.ok) {
    const t = await del.text();
    return json(res, 500, { error: "Unlike delete failed", detail: t });
  }

  return json(res, 200, { ok: true, liked: false });
}

export default async function handler(req, res) {
  const op = String(req.query.op || "").toLowerCase();

  if (op === "outfits.like" && req.method === "POST") {
    return handleLike(req, res);
  }

  if (op === "outfits.unlike" && req.method === "POST") {
    return handleUnlike(req, res);
  }

  return json(res, 400, { error: "Unknown op" });
}
