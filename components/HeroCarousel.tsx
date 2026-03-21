"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../app/page.module.css";
import type { OutfitItem } from "./OutfitCard";

type Props = {
  items: OutfitItem[];
  stage: "featured" | "generated";
  setStage: (v: "featured" | "generated") => void;
  generatedImageUrl?: string;
  generatedShareUrl?: string;
  generatedSummary?: string;
  onOpen?: (src: string) => void;
  onLike?: (item: OutfitItem) => void;
  onShare?: (item: OutfitItem) => void;
  onApply?: (item: OutfitItem) => void;
  isLiked?: (id: string) => boolean;
  isShared?: (id: string) => boolean;
};

export default function HeroCarousel({
  items,
  stage,
  setStage,
  generatedImageUrl,
  generatedShareUrl,
  generatedSummary,
  onOpen,
  onLike,
  onShare,
  onApply,
  isLiked,
  isShared,
}: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
    if (railRef.current) railRef.current.scrollTo({ left: 0, behavior: "auto" });
  }, [items.length]);

  const syncActiveFromScroll = () => {
    const el = railRef.current;
    if (!el || !el.children.length) return;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + 18;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / step)));
    setActiveIdx(idx);
  };

  const scrollToIndex = (index: number) => {
    const el = railRef.current;
    if (!el || !el.children.length) return;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + 18;
    el.scrollTo({ left: index * step, behavior: "smooth" });
    setActiveIdx(index);
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroHeader}>
        <div>
          <div className={styles.kicker}>Featured Looks</div>
          <h1 className={styles.heroTitle}>首頁主舞台</h1>
          <p className={styles.heroSub}>
            卡片排成一列，highlight 會跟著目前滑到的位置變化。
          </p>
        </div>

        <div className={styles.heroControls}>
          <button
            type="button"
            className={stage === "featured" ? styles.activePill : styles.pill}
            onClick={() => setStage("featured")}
          >
            精選靈感
          </button>
          <button
            type="button"
            className={stage === "generated" ? styles.activePill : styles.pill}
            onClick={() => generatedImageUrl && setStage("generated")}
          >
            我的生成
          </button>

          {stage === "featured" ? (
            <>
              <button
                type="button"
                className={styles.arrowBtn}
                onClick={() => scrollToIndex(Math.max(0, activeIdx - 1))}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.arrowBtn}
                onClick={() => scrollToIndex(Math.min(items.length - 1, activeIdx + 1))}
              >
                ›
              </button>
            </>
          ) : null}
        </div>
      </div>

      {stage === "featured" ? (
        <div className={styles.heroViewport}>
          <div className={styles.heroRail} ref={railRef} onScroll={syncActiveFromScroll}>
            {items.map((card, idx) => (
              <article
                key={card.id}
                className={`${styles.heroCard} ${idx === activeIdx ? styles.heroCardActive : ""}`}
              >
                <div className={styles.heroImageFrame}>
                  {card.image_url ? (
                    <>
                      <div
                        className={styles.heroImageBg}
                        style={{ backgroundImage: `url(${card.image_url})` }}
                      />
                      <img
                        src={card.image_url}
                        alt={card.summary || card.style?.style || "featured"}
                        className={styles.heroImage}
                      />
                    </>
                  ) : (
                    <div className={styles.heroImageFallback} />
                  )}
                </div>

                <div className={styles.heroInfo}>
                  <div className={styles.heroCardTitle}>{card.style?.style || "Outfit"}</div>
                  <div className={styles.heroCardText}>{card.summary || "精選靈感"}</div>

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
                      {isShared?.(card.id) ? "已分享" : "分享"}
                    </button>

                    <button type="button" className={styles.primaryBtn} onClick={() => onApply?.(card)}>
                      套用
                    </button>

                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => card.image_url && onOpen?.(card.image_url)}
                    >
                      放大
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.historyBlock}>
          <div className={styles.heroCardTitle}>我的生成</div>
          <div className={styles.heroCardText}>
            {generatedSummary || "生成完成後，結果會出現在這裡。"}
          </div>

          <div style={{ marginTop: 16 }}>
            {generatedImageUrl ? (
              <img
                src={generatedImageUrl}
                alt=""
                className={styles.cardImage}
                style={{ aspectRatio: "3 / 4", objectFit: "contain", background: "rgba(255,255,255,0.03)" }}
              />
            ) : (
              <div className={styles.cardImageFallback} />
            )}
          </div>

          <div className={styles.generateRow} style={{ marginTop: 16 }}>
            {generatedShareUrl ? (
              <a href={generatedShareUrl} className={styles.linkBtn}>
                開啟分享頁
              </a>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
