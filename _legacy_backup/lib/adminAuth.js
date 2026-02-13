import { supabaseServer } from "./supabaseServer";

// 用 email 白名單當 admin（建議放 env：ADMIN_EMAILS="a@x.com,b@y.com"）
function getAdminEmailWhitelist() {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function getBearerToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function requireAdmin(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return null;
  }

  // 直接用 supabase auth 驗 token
  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Invalid token", detail: error?.message || "" });
    return null;
  }

  const email = (data.user.email || "").toLowerCase();
  const allow = getAdminEmailWhitelist();

  // 若你還沒設 ADMIN_EMAILS，先暫時放行「所有已登入」以便你把後台跑起來（建議你之後一定要打開白名單）
  if (!allow.length) {
    return { ok: true, user: data.user, email, warning: "ADMIN_EMAILS not set; allowing any logged-in user" };
  }

  if (!allow.includes(email)) {
    res.status(403).json({ error: "Not allowed", email });
    return null;
  }

  return { ok: true, user: data.user, email };
}
