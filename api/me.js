// pages/api/me.js
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({
        error: "Supabase env not set",
        missing: {
          SUPABASE_URL: !SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !SERVICE_ROLE,
        },
      });
    }

    // 1) bearer
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) return res.status(401).json({ error: "Missing bearer token" });

    // 2) verify user token via GoTrue user endpoint
    // apikey 用 anon 或 service_role 都行，但這裡用 service_role 保守
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const userText = await userResp.text();
    if (!userResp.ok) {
      return res.status(401).json({
        error: "Invalid token (auth/v1/user failed)",
        status: userResp.status,
        detail: userText,
      });
    }

    let user;
    try {
      user = JSON.parse(userText);
    } catch {
      return res.status(401).json({ error: "Invalid user payload (non-JSON)", detail: userText });
    }

    const uid = user?.id;
    const email = user?.email || null;
    if (!uid) return res.status(401).json({ error: "Invalid user payload (missing id)", detail: user });

    // 3) read credits from profiles (service role bypasses RLS)
    const profUrl =
      `${SUPABASE_URL}/rest/v1/profiles` +
      `?id=eq.${encodeURIComponent(uid)}` +
      `&select=id,credits_left,email`;

    const profResp = await fetch(profUrl, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Accept: "application/json",
      },
    });

    const profText = await profResp.text();
    if (!profResp.ok) {
      return res.status(500).json({
        error: "Read profile failed",
        status: profResp.status,
        detail: profText,
        url: profUrl,
      });
    }

    let rows;
    try {
      rows = JSON.parse(profText);
    } catch {
      return res.status(500).json({ error: "Profile payload is not JSON", detail: profText });
    }

    const credits_left = rows?.[0]?.credits_left ?? 0;

    return res.status(200).json({
      ok: true,
      user: { id: uid, email },
      credits_left,
    });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
