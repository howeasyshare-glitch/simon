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
        setLoading(true);
        setError("");

        const r = await fetch(`/api/share?slug=${encodeURIComponent(slug)}`, {
          method: "GET",
          cache: "no-store",
        });

        const text = await r.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }

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
    return () => {
      mounted = false;
    };
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
        body: JSON.stringify({
          outfit_id: outfit.id,
          anon_id: anonId,
        }),
      });

      const data = await r.json();
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Like failed");
      }

      setOutfit((prev) =>
        prev
          ? {
              ...prev,
              like_count: data.like_count ?? prev.like_count ?? 0,
            }
          : prev
      );
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
        body: JSON.stringify({
          outfit_id: outfit.id,
        }),
      });

      const data = await r.json();
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Share failed");
      }

      const shareUrl = `${window.location.origin}/share/${outfit.share_slug}`;
      await navigator.clipboard.writeText(shareUrl);

      setOutfit((prev) =>
        prev
          ? {
              ...prev,
              share_count: data.share_count ?? prev.share_count ?? 0,
            }
          : prev
      );
      setStatus("已複製分享連結 ✅");
    } catch (e: any) {
      setStatus(`分享失敗：${e?.message || "Unknown error"}`);
    }
  }

  if (loading) {
    return <main style={{ padding: 24 }}>載入中…</main>;
  }

  if (error) {
    return <main style={{ padding: 24 }}>錯誤：{error}</main>;
  }

  if (!outfit) {
    return <main style={{ padding: 24 }}>找不到分享資料</main>;
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>公開穿搭分享</h1>

      {outfit.image_url ? (
        <div style={{ marginBottom: 16 }}>
          <img
            src={outfit.image_url}
            alt="share outfit"
            style={{
              width: "100%",
              maxWidth: 420,
              height: "auto",
              display: "block",
              borderRadius: 16,
              objectFit: "contain",
            }}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>找不到圖片網址</div>
      )}

      <p style={{ lineHeight: 1.7 }}>{outfit.summary || "沒有摘要"}</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={handleLike}>Like ({outfit.like_count || 0})</button>
        <button onClick={handleShare}>分享 ({outfit.share_count || 0})</button>
      </div>

      {!!status && <div style={{ marginTop: 12 }}>{status}</div>}
    </main>
  );
}
