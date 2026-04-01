"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
import type { OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";

type ListResp = {
  ok?: boolean;
  items?: OutfitItem[];
};

function Toast({ text }: { text: string }) {
  return <div className={styles.toast}>{text}</div>;
}

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

export default function Page() {
  const [items, setItems] = useState<OutfitItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    load();
  }, []);

  function pushToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function load() {
    try {
      const data = await apiGetJson<ListResp>(
        `/api/data?op=explore&limit=24&sort=like&ts=${Date.now()}`
      );
      setItems(data?.items || []);
    } catch {
      setItems([]);
      pushToast("載入失敗");
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
      pushToast("已取消最愛");
    } else {
      localStorage.setItem(`liked_${item.id}`, "1");
      pushToast("已加入最愛");
    }

    setItems((prev) => [...prev]);
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
      await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    }

    pushToast(already ? "已複製連結" : "已分享並複製連結");
    setItems((prev) => [...prev]);
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

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        <div className={styles.pageHeroHead}>
          <div className={styles.pageHeroKicker}>Explore</div>
          <h1 className={styles.pageHeroTitle}>Public Outfits</h1>
          <div className={styles.pageHeroSub}>公開穿搭</div>
        </div>

        <HeroCarousel
          items={items}
          generatedItems={items}
          stage="featured"
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
        <div className={styles.historyBlock}>
          <div className={styles.historyTitleRow}>
            <div className={styles.historyTitle}>Explore Feed</div>
            <div className={styles.historyCount}>{items.length} 筆</div>
          </div>

          {items.length ? (
            <div className={styles.activityList}>
              {items.slice(0, 8).map((item) => (
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
            <div className={styles.emptyText}>目前沒有公開穿搭資料。</div>
          )}
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
