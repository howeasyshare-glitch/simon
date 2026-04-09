"use client";

import { useEffect, useRef, useState } from "react";
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
  mode?: "home" | "simple";
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
  mode = "home",
}: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [openProducts, setOpenProducts] = useState<string | null>(null);

  const currentItems = stage === "generated" ? generatedItems : items;
  const isHome = mode === "home";
  const hasItems = currentItems?.length > 0;
  const canNavigate = currentItems.length > 1;

  useEffect(() => {
    setActiveIdx(0);
    setOpenProducts(null);
  }, [stage, currentItems.length]);

  const scrollToIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(currentItems.length - 1, index));
    const el = railRef.current;
    if (!el) return;

    const cards = Array.from(el.querySelectorAll('[data-hero-card="1"]')) as HTMLElement[];
    const target = cards[nextIndex];
    if (!target) return;

    const left = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
    el.scrollTo({ left, behavior: "smooth" });
    setActiveIdx(nextIndex);
  };

  if (!hasItems) return null;

  return (
    <section className={styles.heroSection}>
      {canNavigate && (
        <div className={styles.heroSimpleControls}>
          <button className={styles.arrowBtn} onClick={() => scrollToIndex(activeIdx - 1)}>‹</button>
          <button className={styles.arrowBtn} onClick={() => scrollToIndex(activeIdx + 1)}>›</button>
        </div>
      )}

      <div className={styles.heroViewport}>
        <div className={styles.heroRail} ref={railRef}>
          {currentItems.map((card, idx) => (
            <article key={card.id} data-hero-card="1" className={styles.heroCard}>
              <div className={styles.heroImageFrame}>
                <img src={card.image_url} className={styles.heroImage} />
              </div>

              <div className={styles.heroInfo}>
                <div className={styles.heroCardTitle}>{card.style?.style}</div>
                <div className={styles.heroCardText}>{card.summary}</div>

                <div className={styles.heroCardActions}>
                  <button onClick={() => onLike?.(card)}>Like</button>
                  <button onClick={() => onShare?.(card)}>Share</button>
                  <button onClick={() => onApply?.(card)}>套用</button>
                </div>

                {/* 🔥 商品區塊 */}
                {card.products?.length ? (
                  <div className={styles.productBlock}>
                    <button
                      className={styles.productToggle}
                      onClick={() =>
                        setOpenProducts(openProducts === card.id ? null : card.id)
                      }
                    >
                      🛍 查看單品 {openProducts === card.id ? "▲" : "▼"}
                    </button>

                    {openProducts === card.id && (
                      <div className={styles.productList}>
                        {card.products.map((group: any, i: number) => (
                          <div key={i} className={styles.productGroup}>
                            <div className={styles.productTitle}>
                              {group.slot}
                            </div>

                            {group.candidates?.map((p: any, j: number) => (
                              <div key={j} className={styles.productRow}>
                                <span>{p.title}</span>
                                <a href={p.url} target="_blank">
                                  購買
                                </a>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
