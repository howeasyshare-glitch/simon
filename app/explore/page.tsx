"use client";

import { useEffect, useMemo, useState } from "react";

type Outfit = {
  id: string;
  created_at?: string;
  share_slug?: string | null;
  image_url?: string;
  image_path?: string | null;
  summary?: string | null;
  spec?: any;
  style?: any;
  products?: any;
  like_count?: number;
  share_count?: number;
  apply_count?: number;
  share_url?: string;
  is_public?: boolean;
};

type SortKey = "like" | "share" | "recent";

function fmtDate(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
}

export default function Page() {
  const [items, setItems] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortKey>("like");
  const [zoomItem, setZoomItem] = useState<Outfit | null>(null);

  useEffect(() => {
    let on = true;
    async function load() {
      try {
        setLoading(true);
        const r = await fetch(`/api/data?op=explore&limit=60&sort=${sort}&ts=${Date.now()}`, { cache: "no-store" });
        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
        if (on) setItems(data.items || []);
      } catch (e: any) {
        if (on) setStatus(`讀取失敗：${e?.message || "Unknown error"}`);
      } finally {
        if (on) setLoading(false);
      }
    }
    load();
    return () => {
      on = false;
    };
  }, [sort]);

  const summary = useMemo(() => {
    if (loading) return "載入中…";
    return `共 ${items.length} 筆公開穿搭`;
  }, [loading, items.length]);

  async function refreshCurrent() {
    const r = await fetch(`/api/data?op=explore&limit=60&sort=${sort}&ts=${Date.now()}`, { cache: "no-store" });
    const data = await r.json();
    if (r.ok && data?.ok) setItems(data.items || []);
  }

  async function likeItem(item: Outfit) {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }

      const r = await fetch(`/api/data?op=outfits.like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);

      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, like_count: data.like_count ?? x.like_count } : x))
      );
      setStatus(data?.liked ? "已加入最愛 ✅" : "已在最愛中");
    } catch (e: any) {
      setStatus(`Like 失敗：${e?.message || "Unknown error"}`);
    }
  }

  async function shareItem(item: Outfit) {
    try {
      const r = await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);

      const shareUrl = `${window.location.origin}/share/${item.share_slug}`;
      await navigator.clipboard.writeText(shareUrl);
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, share_count: data.share_count ?? x.share_count } : x))
      );
      setStatus("已複製分享連結 ✅");
    } catch (e: any) {
      setStatus(`分享失敗：${e?.message || "Unknown error"}`);
    }
  }

  async function applyItem(item: Outfit) {
    try {
      const st = item.style || {};
      localStorage.setItem(
        "findoutfit_apply_preset",
        JSON.stringify({
          style: st.style || st.styleId || "casual",
          palette: st.palette || "mono-dark",
          styleVariant: st.styleVariant || "",
        })
      );

      const r = await fetch(`/api/data?op=outfits.apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);

      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, apply_count: data.apply_count ?? x.apply_count } : x))
      );
      window.location.href = "/";
    } catch (e: any) {
      setStatus(`套用失敗：${e?.message || "Unknown error"}`);
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24, color: "#e9ecf3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Explore</h1>
          <div style={{ opacity: 0.7, marginTop: 6 }}>{summary}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["like", "依 Like"],
            ["share", "依 分享"],
            ["recent", "依 時間"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key as SortKey)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: sort === key ? "#fff" : "rgba(255,255,255,0.06)",
                color: sort === key ? "#0b0d12" : "#e9ecf3",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!!status && <div style={{ marginBottom: 14 }}>{status}</div>}

      {loading ? (
        <div>載入中…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {items.map((item) => {
            const st = item.style || {};
            const title = st.style || st.styleId || "Outfit";
            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setZoomItem(item)}
                  style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", cursor: "zoom-in" }}
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt={title} style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "4 / 5", background: "rgba(255,255,255,0.06)" }} />
                  )}
                </button>

                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>{title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{fmtDate(item.created_at)}</div>
                  <div style={{ fontSize: 12, opacity: 0.78, marginTop: 8, minHeight: 36 }}>
                    {item.summary || "—"}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.82, marginTop: 10 }}>
                    ❤️ {item.like_count || 0} · 🔁 {item.share_count || 0} · ✨ {item.apply_count || 0}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    <button onClick={() => likeItem(item)} style={btnStyle}>Like</button>
                    <button onClick={() => shareItem(item)} style={btnStyle}>分享</button>
                    <button onClick={() => applyItem(item)} style={btnPrimaryStyle}>套用</button>
                    <a href={item.share_slug ? `/share/${item.share_slug}` : "/explore"} style={{ ...btnStyle, textDecoration: "none", textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>查看</a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoomItem && (
        <div onClick={() => setZoomItem(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "grid", placeItems: "center", padding: 24, zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "100%" }}>
            <img src={zoomItem.image_url} alt="zoom" style={{ width: "100%", height: "auto", display: "block", borderRadius: 16, objectFit: "contain" }} />
          </div>
        </div>
      )}
    </main>
  );
}

const btnStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#e9ecf3",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimaryStyle = {
  ...btnStyle,
  background: "#fff",
  color: "#0b0d12",
};
