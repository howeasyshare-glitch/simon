// pages/api/outfits/create.js
export const config = { runtime: "nodejs" };

async function getUserByAccessToken(SUPABASE_URL, SERVICE_ROLE, accessToken) {
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SERVICE_ROLE,
    },
  });
  const userText = await userResp.text();
  if (!userResp.ok) throw new Error(`Invalid token: ${userResp.status} ${userText}`);
  const user = JSON.parse(userText);
  if (!user?.id) throw new Error("Invalid user payload");
  return user;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).json({ error: "Supabase env not set" });

    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) return res.status(401).json({ error: "Missing bearer token" });

    const user = await getUserByAccessToken(SUPABASE_URL, SERVICE_ROLE, accessToken);

    // 前端要傳：spec/style/summary/products/image_path/is_public
    const body = req.body || {};
    const payload = {
      user_id: user.id,
      spec: body.spec ?? null,
      style: body.style ?? null,
      summary: body.summary ?? null,
      products: body.products ?? null,
      image_path: body.image_path ?? null,
      is_public: body.is_public === true,
    };

    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/outfits?select=share_slug,id`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const insertText = await insertResp.text();
    if (!insertResp.ok) {
      return res.status(500).json({ error: "Insert failed", status: insertResp.status, detail: insertText });
    }

    const rows = JSON.parse(insertText);
    const row = rows?.[0];
    return res.status(200).json({ ok: true, id: row.id, share_slug: row.share_slug });
  } catch (e) {
    return res.status(500).json({ error: "Unhandled", detail: String(e) });
  }
}
