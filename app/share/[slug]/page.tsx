"use client";

import { useEffect, useState } from "react";

type ShareOutfit = {
  id: string;
  created_at?: string;
  share_slug?: string;
  image_url?: string;
  summary?: string | null;
  style?: any;
  like_count?: number;
  share_count?: number;
  apply_count?: number;
};

export default function Page({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outfit, setOutfit] = useState<ShareOutfit | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const r = await fetch(`/api/share?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await r.json();
        if (!r.ok || !data?.ok || !data?.outfit) throw new Error(data?.error || `HTTP ${r.status}`);
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
      const r = await fetch(`/api/data?op=outfits.like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: outfit.id, anon_id: anonId }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setOutfit((prev) => prev ? { ...prev, like_count: data.like_count ?? prev.like_count } : prev);
      setStatus(data?.liked ? "已加入最愛 ✅" : "已在最愛中");
    } catch (e: any) {
      setStatus(`Like 失敗：${e?.message || "Unknown error"}`);
    }
  }

  async function handleShare() {
    if (!outfit?.id || !outfit?.share_slug) return;
    try {
      const r = await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: outfit.id }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      await navigator.clipboard.writeText(`${window.location.origin}/share/${outfit.share_slug}`);
      setOutfit((prev) => prev ? { ...prev, share_count: data.share_count ?? prev.share_count } : prev);
      setStatus("已複製分享連結 ✅");
    } catch (e: any) {
      setStatus(`分享失敗：${e?.message || "Unknown error"}`);
    }
  }

  if (loading) return <main style={{ padding: 24 }}>載入中…</main>;
  if (error) return <main style={{ padding: 24 }}>錯誤：{error}</main>;
  if (!outfit) return <main style={{ padding: 24 }}>找不到分享資料</main>;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24, color: "#e9ecf3" }}>
      <h1 style={{ marginTop: 0 }}>公開穿搭分享</h1>
      {outfit.image_url ? <img src={outfit.image_url} alt="share outfit" style={{ width: "100%", maxWidth: 420, height: "auto", display: "block", borderRadius: 16, objectFit: "contain" }} /> : <div>找不到圖片網址</div>}
      <p style={{ lineHeight: 1.8, marginTop: 16 }}>{outfit.summary || "沒有摘要"}</p>
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={handleLike}>Like ({outfit.like_count || 0})</button>
        <button onClick={handleShare}>分享 ({outfit.share_count || 0})</button>
      </div>
      {!!status && <div style={{ marginTop: 12 }}>{status}</div>}
    </main>
  );
}
