import { supabaseServer } from "../../lib/supabaseServer";

export function getBearerToken(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function isAdminEmail(email) {
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.length) return false;
  return allow.includes(String(email || "").toLowerCase());
}

export async function requireAdmin(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing Bearer token" });
    return null;
  }

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error) {
    res.status(401).json({ error: "Invalid token", detail: error.message });
    return null;
  }

  const email = data?.user?.email;
  if (!isAdminEmail(email)) {
    res.status(403).json({ error: "Forbidden (not admin)" });
    return null;
  }

  return { user: data.user, token };
}
