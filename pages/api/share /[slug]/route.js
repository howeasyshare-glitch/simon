// app/api/share/[slug]/route.js
export async function GET(request, { params }) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return Response.json({ error: "Supabase env not set" }, { status: 500 });
    }

    const slug = String(params?.slug || "").trim();
    if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });

    const url =
      `${SUPABASE_URL}/rest/v1/outfits` +
      `?share_slug=eq.${encodeURIComponent(slug)}` +
      `&is_public=eq.true` +
      `&select=id,created_at,spec,style,summary,products,image_path,share_slug`;

    const resp = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Accept: "application/json",
      },
      // 避免 edge cache 讓你以為資料不會更新
      cache: "no-store",
    });

    const text = await resp.text();
    if (!resp.ok) {
      return Response.json(
        { error: "Query failed", status: resp.status, detail: text },
        { status: 500 }
      );
    }

    const rows = JSON.parse(text);
    const row = rows?.[0];
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });

    const imageUrl = row.image_path
      ? `${SUPABASE_URL}/storage/v1/object/public/outfits/${row.image_path}`
      : "";

    return Response.json(
      { ok: true, outfit: { ...row, image_url: imageUrl } },
      { status: 200 }
    );
  } catch (e) {
    return Response.json(
      { error: "Unhandled", detail: String(e) },
      { status: 500 }
    );
  }
}
