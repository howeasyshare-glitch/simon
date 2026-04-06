"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../app/page.module.css";
import type { OutfitItem } from "./OutfitCard";

export default function HeroCarousel({
  items,
  generatedItems,
  stage,
  setStage,
  generatedImageUrl,
  generatedSummary,
  generatedShareUrl,
  onOpen,
  onLike,
  onShare,
  onApply,
  isLiked,
  isShared,
  mode = "home",
}: any) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const currentItems = stage === "generated" ? generatedItems : items;

  const isHome = mode === "home";

  useEffect(() => {
    setActiveIdx(0);
    railRef.current?.scrollTo({ left: 0 });
  }, [stage, currentItems.length]);

  const scrollToIndex = (index: number) => {
    const el = railRef.current;
    if (!el) return;

    const cards = el.querySelectorAll('[data-hero-card="1"]');
    const target = cards[index] as HTMLElement;
    if (!target) return;

    const left = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
    el.scrollTo({ left, behavior: "smooth" });
    setActiveIdx(index);
  };

  if (!currentItems?.length) {
    return <div className={styles.heroEmpty}>目前沒有資料</div>;
  }

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroHeader}>
        <div>
          <div className={styles.kicker}>
            {stage === "generated" ? "My Generated" : "Featured"}
          </div>
          <h1 className={styles.heroTitle}>
            {stage === "generated" ? "我的生成" : "穿搭主舞台"}
          </h1>
        </div>

        <div className={styles.heroControls}>
          {isHome && (
            <>
              <button
                className={stage === "featured" ? styles.activePill : styles.pill}
                onClick={() => setStage("featured")}
              >
                精選
              </button>
              <button
                className={stage === "generated" ? styles.activePill : styles.pill}
                onClick={() => setStage("generated")}
              >
                我的生成
              </button>
            </>
          )}

          <button onClick={() => scrollToIndex(activeIdx - 1)}>‹</button>
          <button onClick={() => scrollToIndex(activeIdx + 1)}>›</button>
        </div>
      </div>

      <div className={styles.heroRail} ref={railRef}>
        {currentItems.map((item: OutfitItem, idx: number) => (
          <div
            key={item.id}
            data-hero-card="1"
            className={`${styles.heroCard} ${
              idx === activeIdx ? styles.heroCardActive : ""
            }`}
          >
            <img
              src={item.image_url}
              className={styles.heroImage}
              onClick={() => onOpen?.(item.image_url)}
            />

            <div className={styles.heroInfo}>
              <div>{item.summary}</div>

              <div className={styles.heroCardActions}>
                <button onClick={() => onLike?.(item)}>Like</button>
                <button onClick={() => onShare?.(item)}>Share</button>
                <button onClick={() => onApply?.(item)}>套用</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
