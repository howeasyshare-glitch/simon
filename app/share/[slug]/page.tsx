"use client";

import { useEffect, useState } from "react";

type ShareOutfit = {
  id: string;
  created_at?: string;
  share_slug?: string;
  image_url?: string;
  image_path?: string | null;
  summary?: string | null;
  spec?: any;
  style?: any;
  products?: any;
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

const btnStyle = {
  padding: "10px 12px",
  borderRadius: 12,
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

export default function Page({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outfit, setOutfit] = useState<ShareOutfit | null>(null);
  const [status, setStatus] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const r = await fetch(`/api/share?slug=${encodeURIComponent(slug)}`, {
          method: "GET",
          cache: "no-store",
        });

        const text = await r.text();
        const data = text ? JSON.parse(text) : null;

        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`);
        }

        if (!data?.ok || !data?.outfit) {
          throw new Error("分享資料讀取成功，但格式不符合預期");
        }

        if (mounted) setOutfit(data.outfit);
      } catch (e: any) {
        if (mounted) setError(e?.message || "讀取失敗");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => { mounted = false; };
  }, [slug]);

  async function handleLike() {
    if (!outfit?.id) return;
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }

      const alreadyLiked = localStorage.getItem(likedKey(outfit.id)) === "1";
      const op = alreadyLiked ? "outfits.unlike" : "outfits.like";

      const r = await fetch(`/api/data?op=${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outfit_id: outfit.id,
          anon_id: anonId,
        }),
      });

      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || "Like failed");

      if (alreadyLiked) localStorage.removeItem(likedKey(outfit.id));
      else localStorage.setItem(likedKey(outfit.id), "1");

      setOutfit((prev) =>
        prev ? { ...prev, like_count: data.like_count ?? prev.like_count ?? 0 } : prev
      );
      setStatus(alreadyLiked ? "已取消最愛" : "已加入最愛 ✅");
    } catch (e: any) {
      setStatus(`Like 失敗：${e?.message || "Unknown error"}`);
    }
  }

  async function handleShare() {
    if (!outfit?.id || !outfit?.share_slug) return;
    try {
      const key = sharedKey(outfit.id);
      if (localStorage.getItem(key) !== "1") {
        const r = await fetch(`/api/data?op=outfits.share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outfit_id: outfit.id,
          }),
        });

        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || "Share failed");

        localStorage.setItem(key, "1");
        setOutfit((prev) =>
          prev ? { ...prev, share_count: data.share_count ?? prev.share_count ?? 0 } : prev
        );
      }

      const shareUrl = `${window.location.origin}/share/${outfit.share_slug}`;
      await navigator.clipboard.writeText(shareUrl);
      setStatus("已複製分享連結 ✅");
    } catch (e: any) {
      setStatus(`分享失敗：${e?.message || "Unknown error"}`);
    }
  }

  function handleApply() {
    if (!outfit) return;
    localStorage.setItem(
      "findoutfit_apply_preset",
      JSON.stringify({
        style: outfit.style?.style || "casual",
        palette: outfit.style?.palette || "mono-dark",
        styleVariant: outfit.style?.styleVariant || "",
        label: outfit.summary || outfit.style?.style || "Share preset",
        ts: Date.now(),
      })
    );
    window.location.href = "/";
  }

  const titleStyle = { color: "rgba(255,255,255,0.96)" } as const;
  const subStyle = { color: "rgba(255,255,255,0.82)" } as const;

  if (loading) {
    return <main style={{ padding: 24, ...subStyle }}>載入中…</main>;
  }

  if (error) {
    return <main style={{ padding: 24, ...subStyle }}>錯誤：{error}</main>;
  }

  if (!outfit) {
    return <main style={{ padding: 24, ...subStyle }}>找不到分享資料</main>;
  }

  const alreadyLiked = typeof window !== "undefined" && localStorage.getItem(likedKey(outfit.id)) === "1";

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, color: "rgba(255,255,255,0.92)" }}>
      <h1 style={{ marginBottom: 8, ...titleStyle }}>公開穿搭分享</h1>
      <p style={{ marginTop: 0, marginBottom: 18, ...subStyle }}>{outfit.summary || "沒有摘要"}</p>

      {outfit.image_url ? (
        <button
          onClick={() => setZoomOpen(true)}
          style={{ border: 0, background: "transparent", padding: 0, cursor: "zoom-in", display: "block", marginBottom: 16 }}
        >
          <img
            src={outfit.image_url}
            alt="share outfit"
            style={{
              width: "100%",
              maxWidth: 420,
              height: "auto",
              display: "block",
              borderRadius: 16,
              objectFit: "contain" as const,
            }}
          />
        </button>
      ) : (
        <div style={{ marginBottom: 16, ...subStyle }}>找不到圖片網址</div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={handleLike} style={btnStyle}>
          {alreadyLiked ? `取消讚 (${outfit.like_count || 0})` : `Like (${outfit.like_count || 0})`}
        </button>
        <button onClick={handleShare} style={btnStyle}>分享 ({outfit.share_count || 0})</button>
        <button onClick={handleApply} style={primaryBtnStyle}>套用</button>
      </div>

      {!!status && <div style={{ marginTop: 12, ...subStyle }}>{status}</div>}

      {zoomOpen ? (
        <div
          onClick={() => setZoomOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <img
            src={outfit.image_url}
            alt="zoom"
            style={{
              maxWidth: "92vw",
              maxHeight: "88vh",
              objectFit: "contain" as const,
              borderRadius: 16,
            }}
          />
        </div>
      ) : null}
    </main>
  );
}
