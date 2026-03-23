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
    if (railRef.current) railRef.current.scrollTo({ left: 0, behavior: "auto" });
  }, [stage, currentItems.length]);

  const syncActiveFromScroll = () => {
    const el = railRef.current;
    if (!el || el.children.length < 3) return;
    const firstCard = el.children[1] as HTMLElement;
    const step = firstCard.offsetWidth + 18;
    const idx = Math.max(0, Math.min(currentItems.length - 1, Math.round(el.scrollLeft / step)));
    setActiveIdx(idx);
  };

  const scrollToIndex = (index: number) => {
    const el = railRef.current;
    if (!el || el.children.length < 3) return;
    const firstCard = el.children[1] as HTMLElement;
    const step = firstCard.offsetWidth + 18;
    el.scrollTo({ left: index * step, behavior: "smooth" });
    setActiveIdx(index);
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroHeader}>
        <div className={styles.heroHeadCopy}>
          <div className={styles.kicker}>{stage === "generated" ? "My Generated" : "Featured Looks"}</div>
          <h1 className={styles.heroTitle}>{stage === "generated" ? "我的生成" : "首頁主舞台"}</h1>
          <p className={styles.heroSub}>
            {stage === "generated"
              ? generatedSummary || "用和精選相同的方式瀏覽你的生成結果。"
              : "卡片排成一列，highlight 會跟著目前滑到的位置變化。"}
          </p>
        </div>

        <div className={styles.heroControls}>
          <button type="button" className={stage === "featured" ? styles.activePill : styles.pill} onClick={() => setStage("featured")}>
            精選靈感
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
          {currentItems.map((card, idx) => (
            <article key={`${stage}-${card.id}`} className={`${styles.heroCard} ${idx === activeIdx ? styles.heroCardActive : ""}`}>
              <div className={styles.heroImageFrame}>
                {card.image_url ? (
                  <>
                    <div className={styles.heroImageBg} style={{ backgroundImage: `url(${card.image_url})` }} />
                    <img src={card.image_url} alt={card.summary || "hero"} className={styles.heroImage} />
                  </>
                ) : generatedImageUrl && idx === 0 ? (
                  <>
                    <div className={styles.heroImageBg} style={{ backgroundImage: `url(${generatedImageUrl})` }} />
                    <img src={generatedImageUrl} alt="" className={styles.heroImage} />
                  </>
                ) : (
                  <div className={styles.heroImageFallback} />
                )}
              </div>

              <div className={styles.heroInfo}>
                <div className={styles.heroCardTitle}>{card.style?.style || "Outfit"}</div>
                <div className={styles.heroCardText}>{card.summary || "穿搭靈感"}</div>
                <div className={styles.heroCardActions}>
                  <button type="button" className={isLiked?.(card.id) ? styles.activeGhostBtn : styles.ghostBtn} onClick={() => onLike?.(card)}>
                    {isLiked?.(card.id) ? "已讚" : "Like"}
                  </button>
                  <button type="button" className={isShared?.(card.id) ? styles.activeGhostBtn : styles.ghostBtn} onClick={() => onShare?.(card)}>
                    {isShared?.(card.id) ? "已分享" : "分享"}
                  </button>
                  <button type="button" className={styles.primaryBtn} onClick={() => onApply?.(card)}>
                    套用
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => card.image_url && onOpen?.(card.image_url)}>
                    放大
                  </button>
                </div>
              </div>
            </article>
          ))}
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
