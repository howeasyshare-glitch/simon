"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import OutfitCard, { type OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";

function Toast({ text }: { text: string }) {
  return <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1200, background: "rgba(15,18,27,0.95)", color: "#fff", padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 40px rgba(0,0,0,0.35)", maxWidth: 360, lineHeight: 1.45 }}>{text}</div>;
}

export default function Page() {
  const [items, setItems] = useState<OutfitItem[]>([]);
  const [sort, setSort] = useState("like");
  const [zoomSrc, setZoomSrc] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    load();
  }, [sort]);

  function pushToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function load() {
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=explore&limit=60&sort=${sort}&ts=${Date.now()}`);
      setItems(data?.items || []);
    } catch {
      setItems([]);
      pushToast("載入失敗");
    }
  }

  function isLiked(id: string) {
    return typeof window !== "undefined" && localStorage.getItem(`liked_outfit_${id}`) === "1";
  }

  async function toggleLike(item: OutfitItem) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }
    const alreadyLiked = isLiked(item.id);
    const op = alreadyLiked ? "outfits.unlike" : "outfits.like";
    const r = await fetch(`/api/data?op=${op}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }) });
    const j = await r.json();
    if (!r.ok || !j?.ok) return;
    if (alreadyLiked) localStorage.removeItem(`liked_outfit_${item.id}`); else localStorage.setItem(`liked_outfit_${item.id}`, "1");
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x)));
    pushToast(alreadyLiked ? "已取消最愛" : "已加入最愛 ✅");
  }

  async function shareItem(item: OutfitItem) {
    if (!item.share_slug) return;
    const key = `shared_outfit_${item.id}`;
    const alreadyShared = localStorage.getItem(key) === "1";
    if (!alreadyShared) {
      const r = await fetch(`/api/data?op=outfits.share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outfit_id: item.id }) });
      const j = await r.json();
      if (r.ok && j?.ok) {
        localStorage.setItem(key, "1");
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, share_count: j.share_count ?? x.share_count } : x)));
      }
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    pushToast(alreadyShared ? "已複製分享連結（本裝置已記錄過分享，不重複計數）" : "已複製分享連結，並記錄分享次數 ✅");
  }

  function applyPreset(item: OutfitItem) {
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
            <div className={styles.kicker}>Explore</div>
            <h1 className={styles.sectionTitle}>全部公開穿搭</h1>
          </div>
          <div className={styles.pillRow}>
            {["like", "share", "time"].map((s) => (
              <button key={s} className={sort === s ? styles.activePill : styles.pill} onClick={() => setSort(s)}>
                {s === "like" ? "Like 排序" : s === "share" ? "分享排序" : "時間排序"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.exploreGrid}>
          {items.map((item) => (
            <OutfitCard
              key={item.id}
              item={item}
              liked={isLiked(item.id)}
              onOpen={() => item.image_url && setZoomSrc(item.image_url)}
              onLike={() => toggleLike(item)}
              onShare={() => shareItem(item)}
              onApply={() => applyPreset(item)}
            />
          ))}
        </div>
      </section>

      {zoomSrc ? <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}><img src={zoomSrc} alt="" className={styles.modalImg} /></div> : null}
      {toast ? <Toast text={toast} /> : null}
    </main>
  );
}
