"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
import type { OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";

function Toast({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 1200,
        background: "rgba(15,18,27,0.95)",
        color: "#fff",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        maxWidth: 360,
        lineHeight: 1.45,
      }}
    >
      {text}
    </div>
  );
}

type ListResp = {
  ok?: boolean;
  items?: OutfitItem[];
};

export default function Page() {
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  function pushToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function loadAll() {
    await Promise.all([loadRecent(), loadFavorites()]);
  }

  async function loadRecent() {
    try {
      const data = await apiGetJson<ListResp>(
        `/api/data?op=outfits.recent&limit=12&ts=${Date.now()}`
      );
      setRecent(data?.items || []);
    } catch {
      setRecent([]);
    }
  }

  async function loadFavorites() {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }

      const data = await apiGetJson<ListResp>(
        `/api/data?op=outfits.favorites&limit=12&anon_id=${encodeURIComponent(
          anonId
        )}&ts=${Date.now()}`
      );
      setFavorites(data?.items || []);
    } catch {
      setFavorites([]);
    }
  }

  function isLiked(id: string) {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem(`liked_${id}`) === "1"
    );
  }

  function isShared(id: string) {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem(`shared_${id}`) === "1"
    );
  }

  async function toggleLike(item: OutfitItem) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }

    const liked = isLiked(item.id);
    const op = liked ? "outfits.unlike" : "outfits.like";

    try {
      await fetch(`/api/data?op=${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }),
      });
    } catch {}

    if (liked) {
      localStorage.removeItem(`liked_${item.id}`);
      pushToast("已取消最愛");
    } else {
      localStorage.setItem(`liked_${item.id}`, "1");
      pushToast("已加入最愛");
    }

    setRecent((prev) => [...prev]);
    setFavorites((prev) => [...prev]);
  }

  async function shareItem(item: OutfitItem) {
    const key = `shared_${item.id}`;
    const already = localStorage.getItem(key) === "1";

    try {
      await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
    } catch {}

    localStorage.setItem(key, "1");

    if (item.share_slug) {
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${item.share_slug}`
      );
    }

    pushToast(already ? "已複製連結" : "已分享並複製連結");
    setRecent((prev) => [...prev]);
    setFavorites((prev) => [...prev]);
  }

  function applyPreset(item: OutfitItem) {
    const anyItem: any = item;
    const echo =
      anyItem?.style?._echo || anyItem?.style?.echo || anyItem?.spec?._echo || {};

    localStorage.setItem(
      "findoutfit_apply_preset",
      JSON.stringify({
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
      })
    );

    window.location.href = "/";
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        <HeroCarousel
          items={favorites}
          generatedItems={recent}
          stage="generated"
          setStage={() => {}}
          generatedImageUrl=""
          generatedSummary=""
          generatedShareUrl=""
          onOpen={(src) => setZoomSrc(src)}
          onLike={toggleLike}
          onShare={shareItem}
          onApply={applyPreset}
          isLiked={isLiked}
          isShared={isShared}
          mode="simple"
        />
      </section>

      <section className={styles.historySection}>
        <div className={styles.activityGrid}>
          <div className={styles.historyBlock}>
            <div className={styles.historyTitleRow}>
              <div className={styles.historyTitle}>最近生成</div>
              <div className={styles.historyCount}>{recent.length} 筆</div>
            </div>

            {recent.length ? (
              <div className={styles.activityList}>
                {recent.slice(0, 6).map((item) => (
                  <article key={item.id} className={styles.activityCard}>
                    <button
                      type="button"
                      className={styles.activityImageBtn}
                      onClick={() => item.image_url && setZoomSrc(item.image_url)}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.summary || "outfit"}
                          className={styles.activityImage}
                        />
                      ) : (
                        <div className={styles.activityImageFallback} />
                      )}
                    </button>

                    <div className={styles.activityBody}>
                      <div className={styles.activityTitleRow}>
                        <div className={styles.activityTitle}>
                          {item.style?.style || "Outfit"}
                        </div>
                        <button
                          type="button"
                          className={styles.activityChipBtn}
                          onClick={() => applyPreset(item)}
                        >
                          套用
                        </button>
                      </div>

                      <div className={styles.activityText}>
                        {item.summary || "穿搭靈感"}
                      </div>

                      <div className={styles.activityMetaRow}>
                        <span>♥ {item.like_count || 0}</span>
                        <span>↗ {item.share_count || 0}</span>
                        <button
                          type="button"
                          className={styles.activityLinkBtn}
                          onClick={() => shareItem(item)}
                        >
                          分享
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyText}>目前沒有最近生成資料。</div>
            )}
          </div>

          <div className={styles.historyBlock}>
            <div className={styles.historyTitleRow}>
              <div className={styles.historyTitle}>我的最愛</div>
              <div className={styles.historyCount}>{favorites.length} 筆</div>
            </div>

            {favorites.length ? (
              <div className={styles.activityList}>
                {favorites.slice(0, 6).map((item) => (
                  <article key={item.id} className={styles.activityCard}>
                    <button
                      type="button"
                      className={styles.activityImageBtn}
                      onClick={() => item.image_url && setZoomSrc(item.image_url)}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.summary || "outfit"}
                          className={styles.activityImage}
                        />
                      ) : (
                        <div className={styles.activityImageFallback} />
                      )}
                    </button>

                    <div className={styles.activityBody}>
                      <div className={styles.activityTitleRow}>
                        <div className={styles.activityTitle}>
                          {item.style?.style || "Outfit"}
                        </div>
                        <button
                          type="button"
                          className={styles.activityChipBtn}
                          onClick={() => applyPreset(item)}
                        >
                          套用
                        </button>
                      </div>

                      <div className={styles.activityText}>
                        {item.summary || "穿搭靈感"}
                      </div>

                      <div className={styles.activityMetaRow}>
                        <span>♥ {item.like_count || 0}</span>
                        <span>↗ {item.share_count || 0}</span>
                        <button
                          type="button"
                          className={styles.activityLinkBtn}
                          onClick={() => shareItem(item)}
                        >
                          分享
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyText}>目前沒有收藏資料。</div>
            )}
          </div>
        </div>
      </section>

      {zoomSrc ? (
        <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} alt="" className={styles.modalImg} />
        </div>
      ) : null}

      {toast ? <Toast text={toast} /> : null}
    </main>
  );
}
