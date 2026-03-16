
"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import OutfitCard, { type OutfitCardItem } from "../../components/OutfitCard";

function likedKey(outfitId: string) {
  return `liked_outfit_${outfitId}`;
}
function sharedKey(outfitId: string) {
  return `shared_outfit_${outfitId}`;
}

export default function Page() {
  const [items, setItems] = useState<OutfitCardItem[]>([]);
  const [sort, setSort] = useState("like");
  const [status, setStatus] = useState("");
  const [zoomSrc, setZoomSrc] = useState("");

  useEffect(() => { load(); }, [sort]);

  async function load() {
    try {
      const r = await fetch(`/api/data?op=explore&limit=60&sort=${encodeURIComponent(sort)}&ts=${Date.now()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "載入失敗");
      setItems(j.items || []);
    } catch (e: any) {
      setItems([]);
      setStatus(e?.message || "載入失敗");
    }
  }

  function isLiked(id: string) {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(likedKey(id)) === "1";
  }

  async function toggleLike(item: OutfitCardItem) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }
    const alreadyLiked = isLiked(item.id);
    const op = alreadyLiked ? "outfits.unlike" : "outfits.like";
    const r = await fetch(`/api/data?op=${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }),
    });
    const j = await r.json();
    if (!r.ok || !j?.ok) return;
    if (alreadyLiked) localStorage.removeItem(likedKey(item.id));
    else localStorage.setItem(likedKey(item.id), "1");
    setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x));
    setStatus(alreadyLiked ? "已取消最愛" : "已加入最愛 ✅");
  }

  async function shareItem(item: OutfitCardItem) {
    if (!item.share_slug) return;
    const key = sharedKey(item.id);
    if (localStorage.getItem(key) !== "1") {
      const r = await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
      const j = await r.json();
      if (r.ok && j?.ok) {
        localStorage.setItem(key, "1");
        setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, share_count: j.share_count ?? x.share_count } : x));
      }
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    setStatus("已複製分享連結 ✅");
  }

  function applyPreset(item: OutfitCardItem) {
    localStorage.setItem("findoutfit_apply_preset", JSON.stringify({
      style: item.style?.style || "casual",
      palette: item.style?.palette || "mono-dark",
      styleVariant: item.style?.styleVariant || "",
      id: item.style?.styleVariant || item.id,
    }));
    window.location.href = "/";
  }

  return (
    <div className={styles.pageShell}>
      <NavBar />
      <div className={styles.pageWrap}>
        <div className={styles.listPageHeader}>
          <div>
            <div className={styles.sectionKicker}>全部公開穿搭</div>
            <h1 className={styles.pageTitle}>Explore</h1>
            <p className={styles.pageSub}>瀏覽全部公開作品，並依 Like、分享或時間排序。</p>
          </div>
          <div className={styles.sortRow}>
            {["like", "share", "time"].map((s) => (
              <button key={s} type="button" className={sort === s ? styles.sortBtnActive : styles.sortBtn} onClick={() => setSort(s)}>
                {s === "like" ? "Like 排序" : s === "share" ? "分享排序" : "時間排序"}
              </button>
            ))}
          </div>
        </div>

        {!!status ? <div className={styles.pageStatus}>{status}</div> : null}

        <div className={styles.cardGrid}>
          {items.map((item) => (
            <OutfitCard
              key={item.id}
              item={item}
              liked={isLiked(item.id)}
              onOpen={(src) => setZoomSrc(src || "")}
              onLike={() => toggleLike(item)}
              onShare={() => shareItem(item)}
              onApply={() => applyPreset(item)}
            />
          ))}
        </div>

        {zoomSrc ? (
          <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
            <img src={zoomSrc} alt="" className={styles.modalImg} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
