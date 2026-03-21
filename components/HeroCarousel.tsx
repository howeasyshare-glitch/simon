"use client";

import { useRef } from "react";
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
}: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);

  const scrollRail = (dir: "left" | "right") => {
    const el = railRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.72);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroHeader}>
        <div>
          <div className={styles.kicker}>Featured Looks</div>
          <h1 className={styles.heroTitle}>首頁主舞台</h1>
          <p className={styles.heroSub}>改成橫向滑動感的主舞台，不再是三張旋轉木馬。卡片排成一列，中間聚焦、左右延伸。</p>
        </div>
        <div className={styles.heroControls}>
          <button type="button" className={stage === "featured" ? styles.activePill : styles.pill} onClick={() => setStage("featured")}>精選靈感</button>
          <button type="button" className={stage === "generated" ? styles.activePill : styles.pill} onClick={() => generatedImageUrl && setStage("generated")}>我的生成</button>
          {stage === "featured" ? (
            <>
              <button type="button" className={styles.arrowBtn} onClick={() => scrollRail("left")}>‹</button>
              <button type="button" className={styles.arrowBtn} onClick={() => scrollRail("right")}>›</button>
            </>
          ) : null}
        </div>
      </div>

      {stage === "featured" ? (
        <div className={styles.heroViewport}>
          <div className={styles.heroRail} ref={railRef}>
            {items.map((card, idx) => (
              <article key={card.id} className={`${styles.heroCard} ${idx === 1 ? styles.heroCardActive : ""}`}>
                <div className={styles.heroImageFrame}>
                  {card.image_url ? (
                    <>
                      <div className={styles.heroImageBg} style={{ backgroundImage: `url(${card.image_url})` }} />
                      <img src={card.image_url} alt={card.summary || card.style?.style || "featured"} className={styles.heroImage} />
                    </>
                  ) : (
                    <div className={styles.heroImageFallback} />
                  )}
                </div>
                <div className={styles.heroInfo}>
                  <div className={styles.heroCardTitle}>{card.style?.style || "Outfit"}</div>
                  <div className={styles.heroCardText}>{card.summary || "精選靈感"}</div>
                  <div className={styles.heroCardActions}>
                    <button type="button" className={styles.ghostBtn} onClick={() => onLike?.(card)}>{isLiked?.(card.id) ? "取消讚" : "Like"}</button>
                    <button type="button" className={styles.ghostBtn} onClick={() => onShare?.(card)}>分享</button>
                    <button type="button" className={styles.primaryBtn} onClick={() => onApply?.(card)}>套用</button>
                    <button type="button" className={styles.linkBtn} onClick={() => card.image_url && onOpen?.(card.image_url)}>放大</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.historyBlock}>
          <div className={styles.heroCardTitle}>我的生成</div>
          <div className={styles.heroCardText}>{generatedSummary || "生成完成後，結果會出現在這裡。"}</div>
          <div style={{ marginTop: 16 }}>
            {generatedImageUrl ? (
              <img src={generatedImageUrl} alt="" className={styles.cardImage} style={{ aspectRatio: "3 / 4", objectFit: "contain", background: "rgba(255,255,255,0.03)" }} />
            ) : (
              <div className={styles.cardImageFallback} />
            )}
          </div>
          <div className={styles.generateRow} style={{ marginTop: 16 }}>
            {generatedShareUrl ? <a href={generatedShareUrl} className={styles.linkBtn}>開啟分享頁</a> : null}
          </div>
        </div>
      )}
    </section>
  );
}
