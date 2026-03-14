"use client";

import { useEffect, useState } from "react";

type Outfit = {
  id: string;
  created_at?: string;
  share_slug?: string | null;
  image_url?: string;
  summary?: string | null;
  style?: any;
  like_count?: number;
  share_count?: number;
  apply_count?: number;
  is_public?: boolean;
};

function likedKey(outfitId: string) {
  return `liked_outfit_${outfitId}`;
}
function sharedKey(outfitId: string) {
  return `shared_outfit_${outfitId}`;
}
function fmtDate(ts?: string) {
  if (!ts) return "剛剛";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "剛剛";
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
}

const btnStyle = {
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const primaryBtnStyle = {
  ...btnStyle,
  background: "rgba(255,255,255,0.96)",
  color: "#111",
} as const;

export default function Page() {
  const [items, setItems] = useState<Outfit[]>([]);
  const [sort, setSort] = useState("like");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [zoomSrc, setZoomSrc] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/data?op=explore&limit=60&sort=${encodeURIComponent(sort)}&ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Load failed");
      setItems(data.items || []);
    } catch (e: any) {
      setItems([]);
      setStatus(e?.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sort]);

  async function toggleLike(it: Outfit) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }
    const alreadyLiked = localStorage.getItem(likedKey(it.id)) === "1";
    const op = alreadyLiked ? "outfits.unlike" : "outfits.like";

    const r = await fetch(`/api/data?op=${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outfit_id: it.id, anon_id: anonId }),
    });
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.error || "Like failed");

    if (alreadyLiked) localStorage.removeItem(likedKey(it.id));
    else localStorage.setItem(likedKey(it.id), "1");

    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, like_count: data.like_count ?? x.like_count } : x));
  }

  async function shareOnce(it: Outfit) {
    if (!it.share_slug) return;
    const key = sharedKey(it.id);
    if (localStorage.getItem(key) !== "1") {
      const r = await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: it.id }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Share failed");
      localStorage.setItem(key, "1");
      setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, share_count: data.share_count ?? x.share_count } : x));
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${it.share_slug}`);
    setStatus("已複製分享連結 ✅");
  }

  function applyPresetAndGoHome(it: Outfit) {
    localStorage.setItem(
      "findoutfit_apply_preset",
      JSON.stringify({
        style: it.style?.style || "casual",
        palette: it.style?.palette || "mono-dark",
        styleVariant: it.style?.styleVariant || "",
        label: it.summary || it.style?.style || "Explore preset",
        ts: Date.now(),
      })
    );
    window.location.href = "/";
  }

  const titleStyle = { color: "rgba(255,255,255,0.96)" } as const;
  const subStyle = { color: "rgba(255,255,255,0.82)" } as const;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, color: "rgba(255,255,255,0.92)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, ...titleStyle }}>Explore</h1>
          <p style={{ marginTop: 8, ...subStyle }}>查看全部公開穿搭，支援 like / 分享 / 套用 / 放大與排序。</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["like", "share", "time"].map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: sort === s ? "rgba(255,255,255,0.96)" : "transparent",
                color: sort === s ? "#111" : "rgba(255,255,255,0.92)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {s === "like" ? "Like 排序" : s === "share" ? "分享排序" : "時間排序"}
            </button>
          ))}
        </div>
      </div>

      {!!status && <div style={{ marginBottom: 12, ...subStyle }}>{status}</div>}
      {loading ? <div style={subStyle}>載入中…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 16 }}>
          {items.map((it) => {
            const alreadyLiked = typeof window !== "undefined" && localStorage.getItem(likedKey(it.id)) === "1";
            return (
              <div
                key={it.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <button
                  onClick={() => it.image_url && setZoomSrc(it.image_url)}
                  style={{ border: 0, background: "transparent", padding: 0, width: "100%", cursor: "zoom-in" }}
                >
                  {it.image_url ? (
                    <img src={it.image_url} alt="" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover" as const, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "1 / 1", background: "rgba(255,255,255,0.08)" }} />
                  )}
                </button>

                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800, ...titleStyle }}>{it.style?.style || "Outfit"}</div>
                  <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, ...subStyle }}>
                    {it.summary || `${fmtDate(it.created_at)} · 公開穿搭`}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
                    <button onClick={() => toggleLike(it)} style={btnStyle}>{alreadyLiked ? "取消讚" : "Like"}</button>
                    <button onClick={() => shareOnce(it)} style={btnStyle}>分享</button>
                    <button onClick={() => applyPresetAndGoHome(it)} style={primaryBtnStyle}>套用</button>
                    <a href={it.share_slug ? `/share/${it.share_slug}` : "/explore"} style={{ ...btnStyle, textDecoration: "none", textAlign: "center" }}>查看</a>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 12, ...subStyle }}>
                    <span>♥ {it.like_count || 0}</span>
                    <span>↗ {it.share_count || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoomSrc ? (
        <div
          onClick={() => setZoomSrc("")}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.74)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <img src={zoomSrc} alt="" style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain" as const, borderRadius: 16 }} />
        </div>
      ) : null}
    </main>
  );
}
