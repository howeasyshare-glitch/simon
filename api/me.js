// pages/api/me.js

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({
        error: "Supabase env not set",
        has: {
          SUPABASE_URL: !!SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_ROLE,
        },
      });
    }

    // 1) Bearer token
    const auth = req.headers.authorization || "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = match?.[1];

    if (!accessToken) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    // 2) 驗證 token（用 GoTrue REST，不用 SDK）
    let user;
    try {
      const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SERVICE_ROLE,
        },
      });

      const text = await userResp.text();
      if (!userResp.ok) {
        return res.status(401).json({
          error: "Invalid token",
          status: userResp.status,
          detail: text,
        });
      }

      user = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "Auth fetch failed",
        detail: String(e),
      });
    }

    if (!user?.id) {
      return res.status(401).json({ error: "Invalid user payload", user });
    }

    // 3) 查 profiles（service role）
    let rows;
    try {
      const profResp = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=credits_left`,
        {
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            Accept: "application/json",
          },
        }
      );

      const text = await profResp.text();
      if (!profResp.ok) {
        return res.status(500).json({
          error: "Profile query failed",
          status: profResp.status,
          detail: text,
        });
      }

      rows = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "Profile fetch failed",
        detail: String(e),
      });
    }

    return res.status(200).json({
      ok: true,
      user: { id: user.id, email: user.email || null },
      credits_left: rows?.[0]?.credits_left ?? 0,
    });
  } catch (err) {
    // 保險用：理論上不會進到這
    return res.status(500).json({
      error: "Unhandled error",
      detail: String(err),
    });
  }
}
