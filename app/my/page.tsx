"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
import type { OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";
import { supabase } from "../../lib/supabase/client";

type ListResp = {
  ok?: boolean;
  items?: OutfitItem[];
};

function ActivityMiniCard({
  item,
  onOpen,
  onApply,
  onShare,
}: {
  item: OutfitItem;
  onOpen: () => void;
  onApply: () => void;
  onShare: () => void;
}) {
  return (
    <article className={styles.activityCard}>
      <button type="button" className={styles.activityImageBtn} onClick={onOpen}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.summary || "outfit"} className={styles.activityImage} />
        ) : (
          <div className={styles.activityImageFallback} />
        )}
      </button>
      <div className={styles.activityBody}>
        <div className={styles.activityTitleRow}>
          <div className={styles.activityTitle}>{item.style?.style || "Outfit"}</div>
          <button type="button" className={styles.activityChipBtn} onClick={onApply}>
            套用
          </button>
        </div>
        <div className={styles.activityText}>{item.summary || "穿搭靈感"}</div>
        <div className={styles.activityMetaRow}>
          <span>♥ {item.like_count || 0}</span>
          <span>↗ {item.share_count || 0}</span>
          <button type="button" className={styles.activityLinkBtn} onClick={onShare}>
            分享
          </button>
        </div>
      </div>
    </article>
  );
}

export default function MyPage() {
  const [userChecked, setUserChecked] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasUser(!!data.user);
      setUserChecked(true);
    });
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadRecent(), loadFavorites()]);
  }

  async function loadRecent() {
    try {
      const data = await apiGetJson<ListResp>(`/api/data?op=outfits.recent&limit=12&ts=${Date.now()}`);
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
        `/api/data?op=outfits.favorites&limit=12&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`
      );
      setFavorites(data?.items || []);
    } catch {
      setFavorites([]);
    }
  }

  function isLiked(id: string) {
    return typeof window !== "undefined" && localStorage.getItem(`liked_${id}`) === "1";
  }

  function isShared(id: string) {
    return typeof window !== "undefined" && localStorage.getItem(`shared_${id}`) === "1";
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
    } else {
      localStorage.setItem(`liked_${item.id}`, "1");
    }

    setRecent((prev) => [...prev]);
    setFavorites((prev) => [...prev]);
  }

  async function shareItem(item: OutfitItem) {
    const key = `shared_${item.id}`;
    try {
      await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
    } catch {}
    localStorage.setItem(key, "1");

    if (item.share_slug) {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    }

    setRecent((prev) => [...prev]);
    setFavorites((prev) => [...prev]);
  }

  function applyPreset(item: OutfitItem) {
    const anyItem: any = item;
    const echo = anyItem?.style?._echo || anyItem?.style?.echo || anyItem?.spec?._echo || {};

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

  if (!userChecked) {
    return (
      <main className={styles.page}>
        <NavBar />
        <section className={styles.contentWrap}>
          <div className={styles.emptyText}>讀取中...</div>
        </section>
      </main>
    );
  }

  if (!hasUser) {
    return (
      <main className={styles.page}>
        <NavBar />
        <section className={styles.contentWrap}>
          <div className={styles.card}>
            <div className={styles.blockTitle}>My</div>
            <div className={styles.emptyText}>請先登入後查看你的生成與收藏。</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        <div className={styles.pageHeroHead}>
          <div className={styles.pageHeroKicker}>My</div>
          <h1 className={styles.pageHeroTitle}>My Generated</h1>
          <div className={styles.pageHeroSub}>我的生成</div>
        </div>

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
                  <ActivityMiniCard
                    key={item.id}
                    item={item}
                    onOpen={() => item.image_url && setZoomSrc(item.image_url)}
                    onApply={() => applyPreset(item)}
                    onShare={() => shareItem(item)}
                  />
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
                  <ActivityMiniCard
                    key={item.id}
                    item={item}
                    onOpen={() => item.image_url && setZoomSrc(item.image_url)}
                    onApply={() => applyPreset(item)}
                    onShare={() => shareItem(item)}
                  />
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
    </main>
  );
}
