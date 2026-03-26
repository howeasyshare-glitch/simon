"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../app/page.module.css";
import type { OutfitItem } from "./OutfitCard";

type Props = {
  items: OutfitItem[];
  generatedItems: OutfitItem[];
  stage: "featured" | "generated";
  setStage: (v: "featured" | "generated") => void;
  generatedImageUrl?: string;
  generatedSummary?: string;
  generatedShareUrl?: string;
  onOpen?: (src: string) => void;
  onLike?: (item: OutfitItem) => void;
  onShare?: (item: OutfitItem) => void;
  onApply?: (item: OutfitItem) => void;
  isLiked?: (id: string) => boolean;
  isShared?: (id: string) => boolean;
};

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
}: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const currentItems = useMemo(
    () => (stage === "generated" ? generatedItems : items),
    [stage, generatedItems, items]
  );

  useEffect(() => {
    setActiveIdx(0);
    if (railRef.current) {
      railRef.current.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [stage, currentItems.length]);

  useEffect(() => {
    return () => {
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const getRealCards = () => {
    const rail = railRef.current;
    if (!rail) return [] as HTMLElement[];

    return Array.from(rail.querySelectorAll<HTMLElement>(`[data-hero-card="true"]`));
  };

  const findClosestIndex = () => {
    const rail = railRef.current;
    const cards = getRealCards();
    if (!rail || !cards.length) return 0;

    const railCenter = rail.scrollLeft + rail.clientWidth / 2;
    let closest = 0;
    let minDist = Number.POSITIVE_INFINITY;

    cards.forEach((card, idx) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - railCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });

    return closest;
  };

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    const rail = railRef.current;
    const cards = getRealCards();
    const safeIndex = Math.max(0, Math.min(cards.length - 1, index));
    const target = cards[safeIndex];
    if (!rail || !target) return;

    const targetLeft = target.offsetLeft - (rail.clientWidth - target.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, targetLeft), behavior });
    setActiveIdx(safeIndex);
  };

  const finalizeSnap = () => {
    const nextIndex = findClosestIndex();
    setActiveIdx(nextIndex);
    scrollToIndex(nextIndex, "smooth");
  };

  const handleScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      setActiveIdx(findClosestIndex());
    });

    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(finalizeSnap, 90);
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroHeader}>
        <div className={styles.heroHeadCopy}>
          <div className={styles.kicker}>{stage === "generated" ? "My Generated" : "Featured"}</div>
          <h1 className={styles.heroTitle}>{stage === "generated" ? "我的生成" : "穿搭主舞台"}</h1>
          <p className={styles.heroSub}>
            {stage === "generated"
              ? generatedSummary || "用和精選相同的方式瀏覽你的生成結果。"
              : "卡片排成一列，highlight 會跟著目前滑到的位置變化。"}
          </p>
        </div>

        <div className={styles.heroControls}>
          <button
            type="button"
            className={stage === "featured" ? styles.activePill : styles.pill}
            onClick={() => setStage("featured")}
          >
            精選
          </button>
          <button
            type="button"
            className={stage === "generated" ? styles.activePill : styles.pill}
            onClick={() => setStage("generated")}
          >
            我的生成
          </button>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={() => scrollToIndex(activeIdx - 1)}
            aria-label="Previous outfit"
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={() => scrollToIndex(activeIdx + 1)}
            aria-label="Next outfit"
          >
            ›
          </button>
        </div>
      </div>

      <div className={styles.heroViewport}>
        <div className={styles.heroRail} ref={railRef} onScroll={handleScroll}>
          <div className={styles.heroSpacer} aria-hidden="true" />
          {currentItems.map((card, idx) => {
            const imgSrc = card.image_url || (generatedImageUrl && idx === 0 ? generatedImageUrl : undefined);

            return (
              <article
                key={`${stage}-${card.id}`}
                data-hero-card="true"
                className={`${styles.heroCard} ${idx === activeIdx ? styles.heroCardActive : ""}`}
              >
                <button
                  type="button"
                  className={styles.heroImageButton}
                  onClick={() => imgSrc && onOpen?.(imgSrc)}
                >
                  <div className={styles.heroImageFrame}>
                    {imgSrc ? (
                      <>
                        <div className={styles.heroImageBg} style={{ backgroundImage: `url(${imgSrc})` }} />
                        <img src={imgSrc} alt={card.summary || "hero"} className={styles.heroImage} />
                      </>
                    ) : (
                      <div className={styles.heroImageFallback} />
                    )}
                  </div>
                </button>

                <div className={styles.heroInfo}>
                  <div className={styles.heroCardTitle}>{card.style?.style || "Outfit"}</div>
                  <div className={styles.heroCardText}>{card.summary || "穿搭靈感"}</div>

                  <div className={styles.heroCardActions}>
                    <button
                      type="button"
                      className={isLiked?.(card.id) ? styles.activeGhostBtn : styles.ghostBtn}
                      onClick={() => onLike?.(card)}
                    >
                      {isLiked?.(card.id) ? "已讚" : "Like"}
                    </button>
                    <button
                      type="button"
                      className={isShared?.(card.id) ? styles.activeGhostBtn : styles.ghostBtn}
                      onClick={() => onShare?.(card)}
                    >
                      {isShared?.(card.id) ? "已分享" : "Share"}
                    </button>
                    <button type="button" className={styles.primaryBtn} onClick={() => onApply?.(card)}>
                      套用
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <div className={styles.heroSpacer} aria-hidden="true" />
        </div>

        {stage === "generated" && generatedShareUrl ? (
          <div className={styles.heroGeneratedLinkRow}>
            <a href={generatedShareUrl} className={styles.linkBtn}>
              開啟分享頁
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
