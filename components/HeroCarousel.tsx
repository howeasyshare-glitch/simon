
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

  const currentItems = stage === "generated" ? generatedItems : items;
  const isHome = mode === "home";
  const hasItems = currentItems?.length > 0;
  const canNavigate = currentItems.length > 1;

  useEffect(() => {
    setActiveIdx(0);
    if (railRef.current) {
      railRef.current.scrollTo({ left: 0, behavior: "auto" });
    }
  }, [stage, currentItems.length]);

  const syncActiveFromScroll = () => {
    const el = railRef.current;
    if (!el) return;

    const cards = Array.from(el.querySelectorAll('[data-hero-card="1"]')) as HTMLElement[];
    if (!cards.length) return;

    const center = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;

    cards.forEach((card, idx) => {
      const childCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(center - childCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });

    setActiveIdx(Math.max(0, Math.min(currentItems.length - 1, closest)));
  };

  const scrollToIndex = (index: number) => {
    if (!canNavigate) return;

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

  if (!hasItems) {
    return (
      <section className={styles.heroSection}>
        <div className={styles.heroEmpty}>
          <div>目前沒有資料</div>
          <div className={styles.heroEmptySub}>先生成一套穿搭或到 Explore 看看</div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.heroSection}>
      {isHome ? (
        <div className={styles.heroHeader}>
          <div className={styles.heroHeadCopy}>
            <div className={styles.kicker}>{stage === "generated" ? "My Generated" : "Featured"}</div>
            <h1 className={styles.heroTitle}>{stage === "generated" ? "我的生成" : "穿搭主舞台"}</h1>
            {stage === "generated" && generatedSummary ? (
              <p className={styles.heroSub}>{generatedSummary}</p>
            ) : null}
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

            {canNavigate ? (
              <>
                <button
                  type="button"
                  className={styles.arrowBtn}
                  onClick={() => scrollToIndex(activeIdx - 1)}
                  aria-label="上一張"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={styles.arrowBtn}
                  onClick={() => scrollToIndex(activeIdx + 1)}
                  aria-label="下一張"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : canNavigate ? (
        <div className={styles.heroSimpleControls}>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={() => scrollToIndex(activeIdx - 1)}
            aria-label="上一張"
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={() => scrollToIndex(activeIdx + 1)}
            aria-label="下一張"
          >
            ›
          </button>
        </div>
      ) : null}

      <div className={styles.heroViewport}>
        <div className={styles.heroRail} ref={railRef} onScroll={syncActiveFromScroll}>
          <div className={styles.heroSpacer} />
          {currentItems.map((card, idx) => (
            <article
              key={`${stage}-${card.id}`}
              data-hero-card="1"
              className={`${styles.heroCard} ${idx === activeIdx ? styles.heroCardActive : ""}`}
            >
              <button
                type="button"
                className={styles.heroImageButton}
                onClick={() => card.image_url && onOpen?.(card.image_url)}
              >
                <div className={styles.heroImageFrame}>
                  {card.image_url ? (
                    <>
                      <div
                        className={styles.heroImageBg}
                        style={{ backgroundImage: `url(${card.image_url})` }}
                      />
                      <img src={card.image_url} alt={card.summary || "hero"} className={styles.heroImage} />
                    </>
                  ) : generatedImageUrl && idx === 0 ? (
                    <>
                      <div
                        className={styles.heroImageBg}
                        style={{ backgroundImage: `url(${generatedImageUrl})` }}
                      />
                      <img src={generatedImageUrl} alt="" className={styles.heroImage} />
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
                  {/* 商品區塊 */}
{(card as any).products?.length ? (
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
        {(card as any).products.map((group: any, i: number) => (
          <div key={i} className={styles.productGroup}>
            <div className={styles.productTitle}>
              {group.slot || group.label}
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
          ))}
          <div className={styles.heroSpacer} />
        </div>

        {isHome && stage === "generated" && generatedShareUrl ? (
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
