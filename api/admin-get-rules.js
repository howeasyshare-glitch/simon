import { supabaseServer } from "../lib/supabaseServer";
export const config = { runtime: "nodejs" };

function getToken(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function isAdminEmail(email) {
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.length) return false;
  return allow.includes(String(email || "").toLowerCase());
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Missing Bearer token" });

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error) return res.status(401).json({ error: "Invalid token", detail: error.message });

  const email = data?.user?.email;
  if (!isAdminEmail(email)) return res.status(403).json({ error: "Forbidden (not admin)" });

  const { data: row, error: e2 } = await supabaseServer
    .from("display_rules")
    .select("id,rules,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (e2) return res.status(500).json({ error: "DB error", detail: e2.message });

  return res.status(200).json({
    ok: true,
    rules: row?.rules || null,
    updated_at: row?.updated_at || null,
  });
}
