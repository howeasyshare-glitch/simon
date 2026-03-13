"use client";

import { useEffect, useState } from "react";

type Outfit = {
  id: string;
  created_at?: string;
  share_slug?: string | null;
  image_url?: string;
  summary?: string | null;
  style?: any;
  is_public?: boolean;
};

function fmtDate(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
}

export default function Page() {
  const [recent, setRecent] = useState<Outfit[]>([]);
  const [favorites, setFavorites] = useState<Outfit[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let on = true;
    async function run() {
      try {
        const anonId = localStorage.getItem("findoutfit_anon_id") || "";
        const [r1, r2] = await Promise.all([
          fetch(`/api/data?op=outfits.recent&limit=24&ts=${Date.now()}`, { cache: "no-store" }),
          fetch(`/api/data?op=outfits.favorites&limit=24&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`, { cache: "no-store" }),
        ]);
        const d1 = await r1.json().catch(() => ({}));
        const d2 = await r2.json().catch(() => ({}));
        if (on) {
          setRecent(d1.items || []);
          setFavorites(d2.items || []);
        }
      } catch (e: any) {
        if (on) setStatus(e?.message || "讀取失敗");
      }
    }
    run();
    return () => { on = false; };
  }, []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, color: "#e9ecf3" }}>
      <h1 style={{ marginTop: 0 }}>我的穿搭</h1>
      {!!status && <div style={{ marginBottom: 12 }}>{status}</div>}
      <section style={{ marginTop: 20 }}>
        <h2>最近生成</h2>
        <div style={gridStyle}>
          {recent.map((it) => (
            <a key={it.id} href={it.is_public && it.share_slug ? `/share/${it.share_slug}` : "/my"} style={cardStyle}>
              {it.image_url ? <img src={it.image_url} alt="" style={imgStyle} /> : <div style={emptyStyle} />}
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 800 }}>{it.style?.style || "Outfit"}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{fmtDate(it.created_at)} · {it.is_public ? "已公開" : "未公開"}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>我的最愛</h2>
        <div style={gridStyle}>
          {favorites.map((it) => (
            <a key={it.id} href={it.share_slug ? `/share/${it.share_slug}` : "/my"} style={cardStyle}>
              {it.image_url ? <img src={it.image_url} alt="" style={imgStyle} /> : <div style={emptyStyle} />}
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 800 }}>{it.style?.style || "Outfit"}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{it.summary || "已收藏"}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 };
const cardStyle = { textDecoration: "none", color: "inherit", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)" };
const imgStyle = { width: "100%", aspectRatio: "4 / 5", objectFit: "cover", display: "block" };
const emptyStyle = { width: "100%", aspectRatio: "4 / 5", background: "rgba(255,255,255,0.06)" };
