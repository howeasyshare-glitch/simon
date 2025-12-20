// pages/api/me.js

export const config = {
  runtime: "nodejs",
};

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

    const auth = req.headers.authorization || "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = match?.[1];

    if (!accessToken) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    // 1) 驗證使用者 token
    let user;
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SERVICE_ROLE,
      },
    });

    const userText = await userResp.text();
    if (!userResp.ok) {
      return res.status(401).json({
        error: "Invalid token",
        status: userResp.status,
        detail: userText,
      });
    }

    user = JSON.parse(userText);
    if (!user?.id) {
      return res.status(401).json({ error: "Invalid user payload", user });
    }

    // 2) 讀取 credits
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

    const profText = await profResp.text();
    if (!profResp.ok) {
      return res.status(500).json({
        error: "Profile query failed",
        status: profResp.status,
        detail: profText,
      });
    }

    const rows = JSON.parse(profText);

    return res.status(200).json({
      ok: true,
      user: { id: user.id, email: user.email || null },
      credits_left: rows?.[0]?.credits_left ?? 0,
    });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({
      error: "Unhandled error",
      detail: String(err),
    });
  }
}
