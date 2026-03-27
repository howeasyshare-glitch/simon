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
  const [activeIdx, setActiveIdx] = useState(0);

  const currentItems = stage === "generated" ? generatedItems : items;

  useEffect(() => {
    setActiveIdx(0);
    if (railRef.current) {
      railRef.current.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [stage, currentItems.length]);

  const syncActiveFromScroll = () => {
    const el = railRef.current;
    if (!el || el.children.length < 3) return;

    const center = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;

    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const childCenter = c.offsetLeft + c.offsetWidth / 2;
      const dist = Math.abs(center - childCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i - 1;
      }
    });

    setActiveIdx(Math.max(0, Math.min(currentItems.length - 1, closest)));
  };

  const scrollToIndex = (index: number) => {
    const el = railRef.current;
    if (!el || el.children.length < 3) return;
    const cardEl = el.children[index + 1] as HTMLElement;
    const left = cardEl.offsetLeft - (el.clientWidth - cardEl.offsetWidth) / 2;
    el.scrollTo({ left, behavior: "smooth" });
    setActiveIdx(index);
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroHeader}>
        <div className={styles.heroHeadCopy}>
          <div className={styles.kicker}>{stage === "generated" ? "My Generated" : "Featured"}</div>
          <h1 className={styles.heroTitle}>{stage === "generated" ? "我的生成" : "穿搭主舞台"}</h1>
          <p className={styles.heroSub}>
            {stage === "generated"
              ? generatedSummary || "用同一套主舞台方式瀏覽你最近生成的內容。"
              : "點擊整張卡片可放大查看；左右滑動即可切換目前 highlight。"}
          </p>
        </div>

        <div className={styles.heroControls}>
          <button type="button" className={stage === "featured" ? styles.activePill : styles.pill} onClick={() => setStage("featured")}>
            精選
          </button>
          <button type="button" className={stage === "generated" ? styles.activePill : styles.pill} onClick={() => setStage("generated")}>
            我的生成
          </button>
          <button type="button" className={styles.arrowBtn} onClick={() => scrollToIndex(Math.max(0, activeIdx - 1))}>
            ‹
          </button>
          <button type="button" className={styles.arrowBtn} onClick={() => scrollToIndex(Math.min(currentItems.length - 1, activeIdx + 1))}>
            ›
          </button>
        </div>
      </div>

      <div className={styles.heroViewport}>
        <div className={styles.heroRail} ref={railRef} onScroll={syncActiveFromScroll}>
          <div className={styles.heroSpacer} />
          {currentItems.map((card, idx) => {
            const src = card.image_url || (generatedImageUrl && idx === 0 ? generatedImageUrl : "");
            return (
              <article
                key={`${stage}-${card.id}`}
                className={`${styles.heroCard} ${idx === activeIdx ? styles.heroCardActive : ""}`}
                onClick={() => src && onOpen?.(src)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && src) {
                    e.preventDefault();
                    onOpen?.(src);
                  }
                }}
              >
                <div className={styles.heroImageButton}>
                  <div className={styles.heroImageFrame}>
                    {src ? (
                      <>
                        <div className={styles.heroImageBg} style={{ backgroundImage: `url(${src})` }} />
                        <img src={src} alt={card.summary || "hero"} className={styles.heroImage} />
                      </>
                    ) : (
                      <div className={styles.heroImageFallback} />
                    )}
                  </div>
                </div>

                <div className={styles.heroInfo}>
                  <div className={styles.heroCardTitle}>{card.style?.style || "Outfit"}</div>
                  <div className={styles.heroCardText}>{card.summary || "穿搭靈感"}</div>

                  <div className={styles.heroCardActions} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={isLiked?.(card.id) ? styles.activeGhostBtn : styles.ghostBtn} onClick={() => onLike?.(card)}>
                      {isLiked?.(card.id) ? "已讚" : "Like"}
                    </button>
                    <button type="button" className={isShared?.(card.id) ? styles.activeGhostBtn : styles.ghostBtn} onClick={() => onShare?.(card)}>
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
          <div className={styles.heroSpacer} />
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
