// pages/api/me.js
import { createClient } from "@supabase/supabase-js";

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

    // 1) Bearer token
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];

    if (!accessToken) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    // 2) 建立 admin client
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SERVICE_ROLE,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 3) 用官方 API 驗證 JWT（⭐關鍵）
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      return res.status(401).json({
        error: "Invalid token",
        detail: userError?.message,
      });
    }

    const user = userData.user;
    const uid = user.id;
    const email = user.email || null;

    // 4) 查 profiles（service role 自動 bypass RLS）
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("credits_left")
        .eq("id", uid)
        .single();

    if (profileError) {
      return res.status(500).json({
        error: "Read profile failed",
        detail: profileError.message,
      });
    }

    return res.status(200).json({
      ok: true,
      user: { id: uid, email },
      credits_left: profile?.credits_left ?? 0,
    });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
