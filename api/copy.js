// api/copy.js
export default async function handler(req, res) {
  const name = String(req.query.name || "");
  if (!name) return res.status(400).json({ error: "Missing name" });

  if (name === "homepage") {
    // TODO: 把原本 homepage-copy.js 的回傳搬進來
    return res.status(200).json({ ok: true, name, data: {} });
  }
  if (name === "public") {
    // TODO: 把原本 public-copy.js 的回傳搬進來
    return res.status(200).json({ ok: true, name, data: {} });
  }

  return res.status(404).json({ error: "Unknown name" });
}
