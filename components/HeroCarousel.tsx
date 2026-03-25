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
}: any) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const currentItems = stage === "generated" ? generatedItems : items;

  useEffect(() => {
    setActiveIdx(0);
    railRef.current?.scrollTo({ left: 0 });
  }, [stage]);

  // 🔥 核心：真正中心判斷
  const syncActiveFromScroll = () => {
    const el = railRef.current;
    if (!el) return;

    const center = el.scrollLeft + el.clientWidth / 2;

    let closest = 0;
    let minDist = Infinity;

    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const childCenter = c.offsetLeft + c.offsetWidth / 2;
      const dist = Math.abs(center - childCenter);

      if (dist < minDist) {
        minDist = dist;
        closest = i - 1; // 扣掉 spacer
      }
    });

    setActiveIdx(Math.max(0, Math.min(currentItems.length - 1, closest)));
  };

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
        </div>
      </div>

      <div className={styles.heroViewport}>
        <div
          className={styles.heroRail}
          ref={railRef}
          onScroll={syncActiveFromScroll}
        >
          <div className={styles.heroSpacer} />

          {currentItems.map((item: any, idx: number) => (
            <div
              key={item.id}
              className={`${styles.heroCard} ${
                idx === activeIdx ? styles.heroCardActive : ""
              }`}
            >
              <img src={item.image_url} className={styles.heroImage} />

              <div className={styles.heroInfo}>
                <div>{item.summary}</div>

                <div className={styles.heroCardActions}>
                  <button
                    className={
                      isLiked(item.id)
                        ? styles.activeGhostBtn
                        : styles.ghostBtn
                    }
                    onClick={() => onLike(item)}
                  >
                    Like
                  </button>

                  <button
                    className={
                      isShared(item.id)
                        ? styles.activeGhostBtn
                        : styles.ghostBtn
                    }
                    onClick={() => onShare(item)}
                  >
                    Share
                  </button>

                  <button
                    className={styles.primaryBtn}
                    onClick={() => onApply(item)}
                  >
                    套用
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className={styles.heroSpacer} />
        </div>
      </div>
    </section>
  );
}
