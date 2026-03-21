"use client";

import { useEffect, useState } from "react";
import styles from "../../page.module.css";
import NavBar from "../../../components/NavBar";

type Outfit = {
  id: string;
  share_slug?: string;
  image_url?: string;
  summary?: string | null;
  style?: any;
  like_count?: number;
  share_count?: number;
  spec?: any;
};

function Toast({ text }: { text: string }) {
  return <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1200, background: "rgba(15,18,27,0.95)", color: "#fff", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 40px rgba(0,0,0,0.35)", maxWidth: 360, lineHeight: 1.45 }}>{text}</div>;
}

export default function Page({ params }: { params: { slug: string } }) {
  const [item, setItem] = useState<Outfit | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    load();
  }, [params.slug]);

  function pushToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function load() {
    const r = await fetch(`/api/share?slug=${encodeURIComponent(params.slug)}`, { cache: "no-store" });
    const j = await r.json();
    if (r.ok && j?.ok) setItem(j.outfit);
  }

  function isLiked() {
    if (!item || typeof window === "undefined") return false;
    return localStorage.getItem(`liked_outfit_${item.id}`) === "1";
  }

  async function toggleLike() {
    if (!item) return;
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }
    const alreadyLiked = isLiked();
    const op = alreadyLiked ? "outfits.unlike" : "outfits.like";
    const r = await fetch(`/api/data?op=${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }),
    });
    const j = await r.json();
    if (!r.ok || !j?.ok) return;
    if (alreadyLiked) localStorage.removeItem(`liked_outfit_${item.id}`); else localStorage.setItem(`liked_outfit_${item.id}`, "1");
    setItem((prev) => (prev ? { ...prev, like_count: j.like_count ?? prev.like_count } : prev));
    pushToast(alreadyLiked ? "已取消最愛" : "已加入最愛 ✅");
  }

  async function shareItem() {
    if (!item?.share_slug) return;
    const key = `shared_outfit_${item.id}`;
    const alreadyShared = localStorage.getItem(key) === "1";
    if (!alreadyShared) {
      const r = await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
      const j = await r.json();
      if (r.ok && j?.ok) {
        localStorage.setItem(key, "1");
        setItem((prev) => (prev ? { ...prev, share_count: j.share_count ?? prev.share_count } : prev));
      }
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    pushToast(alreadyShared ? "已複製分享連結（本裝置已記錄過分享，不重複計數）" : "已複製分享連結，並記錄分享次數 ✅");
  }

  function applyPreset() {
    if (!item) return;
    const anyItem: any = item;
    const echo = anyItem?.style?._echo || anyItem?.style?.echo || anyItem?.spec?._echo || {};
    localStorage.setItem("findoutfit_apply_preset", JSON.stringify({
      id: item.id,
      style: anyItem?.style?.style,
      palette: anyItem?.style?.palette,
      styleVariant: anyItem?.style?.styleVariant,
      gender: anyItem?.style?.gender || echo.gender,
      audience: anyItem?.style?.audience || echo.audience,
      age: echo.age,
      height: echo.height,
      weight: echo.weight,
      temp: echo.temp,
    }));
    window.location.href = "/";
  }

  return (
    <main className={styles.page}>
      <NavBar />
      <section className={styles.contentWrap}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>Share</div>
            <h1 className={styles.sectionTitle}>公開穿搭分享</h1>
          </div>
        </div>

        {item ? (
          <div className={styles.shareStage}>
            <button className={styles.shareImageBtn} onClick={() => setZoomOpen(true)}>
              {item.image_url ? <img src={item.image_url} alt="" className={styles.shareImage} /> : <div className={styles.cardImageFallback} />}
            </button>
            <div className={styles.sharePanel}>
              <div className={styles.cardTitle}>{item.style?.style || "Outfit"}</div>
              <div className={styles.cardText}>{item.summary || "分享頁"}</div>
              <div className={styles.cardMeta}>
                <span>♥ {item.like_count || 0}</span>
                <span>↗ {item.share_count || 0}</span>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.ghostBtn} onClick={toggleLike}>{isLiked() ? "取消讚" : "Like"}</button>
                <button className={styles.ghostBtn} onClick={shareItem}>分享</button>
                <button className={styles.primaryBtn} onClick={applyPreset}>套用</button>
              </div>
            </div>
          </div>
        ) : <div className={styles.emptyText}>找不到分享資料。</div>}
      </section>

      {zoomOpen && item?.image_url ? <div className={styles.modalBackdrop} onClick={() => setZoomOpen(false)}><img src={item.image_url} alt="" className={styles.modalImg} /></div> : null}
      {toast ? <Toast text={toast} /> : null}
    </main>
  );
}
