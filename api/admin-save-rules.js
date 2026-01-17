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

function normalizeRules(input) {
  const dft = {
    perSlot: { top: 4, bottom: 4, shoes: 4, outer: 4, bag: 2, hat: 2 },
    customMax: 2,
    fallback: true,
  };
  const r = input && typeof input === "object" ? input : {};
  const perSlot = { ...dft.perSlot, ...(r.perSlot || {}) };

  // clamp
  for (const k of Object.keys(perSlot)) {
    const n = Number(perSlot[k]);
    perSlot[k] = Number.isFinite(n) ? Math.max(0, Math.min(12, Math.round(n))) : dft.perSlot[k];
  }

  const customMax = Number.isFinite(Number(r.customMax)) ? Math.max(0, Math.min(6, Math.round(Number(r.customMax)))) : dft.customMax;
  const fallback = typeof r.fallback === "boolean" ? r.fallback : dft.fallback;

  return { perSlot, customMax, fallback };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Missing Bearer token" });

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error) return res.status(401).json({ error: "Invalid token", detail: error.message });

  const email = data?.user?.email;
  if (!isAdminEmail(email)) return res.status(403).json({ error: "Forbidden (not admin)" });

  const rules = normalizeRules(req.body?.rules);

  const { data: saved, error: e2 } = await supabaseServer
    .from("display_rules")
    .upsert({ id: 1, rules }, { onConflict: "id" })
    .select("id,rules,updated_at")
    .single();

  if (e2) return res.status(500).json({ error: "DB error", detail: e2.message });

  return res.status(200).json({ ok: true, saved });
}
