
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import styles from "../app/page.module.css";
import type { OutfitCardItem } from "./OutfitCard";

type Props = {
  featured: OutfitCardItem[];
  generatedImageUrl?: string;
  generatedShareUrl?: string;
  generatedSummary?: string;
  onLike?: (item: OutfitCardItem) => void;
  onShare?: (item: OutfitCardItem) => void;
  onApply?: (item: OutfitCardItem) => void;
  onOpen?: (src?: string) => void;
  isLiked?: (id: string) => boolean;
};

export default function HeroCarousel({
  featured,
  generatedImageUrl,
  generatedShareUrl,
  generatedSummary,
  onLike,
  onShare,
  onApply,
  onOpen,
  isLiked,
}: Props) {
  const [mode, setMode] = useState<"featured" | "generated">("featured");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (generatedImageUrl) setMode("generated");
  }, [generatedImageUrl]);

  const current = useMemo(() => {
    if (!featured.length) return null;
    return featured[Math.max(0, Math.min(index, featured.length - 1))];
  }, [featured, index]);

  function next() {
    if (!featured.length) return;
    setIndex((prev) => (prev + 1) % featured.length);
  }

  function prev() {
    if (!featured.length) return;
    setIndex((prev) => (prev - 1 + featured.length) % featured.length);
  }

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroTop}>
        <div>
          <div className={styles.sectionKicker}>首頁主舞台</div>
          <h1 className={styles.pageTitle}>精選穿搭靈感與你的生成結果</h1>
          <p className={styles.pageSub}>用 3:4 大圖瀏覽靈感，生成後會自動切到「我的生成」。</p>
        </div>

        <div className={styles.heroTabs}>
          <button
            type="button"
            className={`${styles.heroTab} ${mode === "featured" ? styles.heroTabActive : ""}`}
            onClick={() => setMode("featured")}
          >
            精選靈感
          </button>
          <button
            type="button"
            className={`${styles.heroTab} ${mode === "generated" ? styles.heroTabActive : ""}`}
            onClick={() => generatedImageUrl && setMode("generated")}
            disabled={!generatedImageUrl}
          >
            我的生成
          </button>
        </div>
      </div>

      {mode === "featured" ? (
        current ? (
          <div className={styles.heroStage}>
            <div className={styles.heroMediaWrap}>
              <button type="button" className={styles.heroImageBtn} onClick={() => onOpen?.(current.image_url)}>
                {current.image_url ? (
                  <img src={current.image_url} alt={current.summary || "featured"} className={styles.heroImage} />
                ) : (
                  <div className={styles.heroImageEmpty} />
                )}
              </button>
              {featured.length > 1 ? (
                <>
                  <button type="button" className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`} onClick={prev}>‹</button>
                  <button type="button" className={`${styles.carouselArrow} ${styles.carouselArrowRight}`} onClick={next}>›</button>
                </>
              ) : null}
            </div>

            <div className={styles.heroInfoCol}>
              <div className={styles.heroCardTitle}>{current.style?.style || "Outfit"}</div>
              <div className={styles.heroCardText}>{current.summary || "精選靈感"}</div>
              <div className={styles.heroCardMeta}>
                <span>♥ {current.like_count || 0}</span>
                <span>↗ {current.share_count || 0}</span>
              </div>

              <div className={styles.heroActionRow}>
                <button type="button" className={styles.actionBtn} onClick={() => onLike?.(current)}>
                  {isLiked?.(current.id) ? "取消讚" : "Like"}
                </button>
                <button type="button" className={styles.actionBtn} onClick={() => onShare?.(current)}>分享</button>
                <button type="button" className={styles.actionBtnPrimary} onClick={() => onApply?.(current)}>套用</button>
                <Link href={current.share_slug ? `/share/${current.share_slug}` : "/explore"} className={styles.actionLink}>查看</Link>
              </div>

              <div className={styles.carouselDots}>
                {featured.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`${styles.carouselDot} ${idx === index ? styles.carouselDotActive : ""}`}
                    onClick={() => setIndex(idx)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.heroInfoCol}>
            <div className={styles.heroCardText}>目前還沒有可顯示的精選穿搭。</div>
          </div>
        )
      ) : (
        <div className={styles.heroStage}>
          <div className={styles.heroMediaWrap}>
            <button type="button" className={styles.heroImageBtn} onClick={() => onOpen?.(generatedImageUrl)}>
              {generatedImageUrl ? (
                <img src={generatedImageUrl} alt="generated outfit" className={styles.heroImage} />
              ) : (
                <div className={styles.heroImageEmpty} />
              )}
            </button>
          </div>

          <div className={styles.heroInfoCol}>
            <div className={styles.heroCardTitle}>我的生成結果</div>
            <div className={styles.heroCardText}>{generatedSummary || "生成完成後，最新結果會顯示在這裡。"}</div>
            <div className={styles.heroActionRow}>
              {generatedShareUrl ? (
                <>
                  <a href={generatedShareUrl} className={styles.actionLink}>查看分享頁</a>
                  <a href={generatedShareUrl} target="_blank" className={styles.actionBtnPrimary}>開啟</a>
                </>
              ) : (
                <div className={styles.heroCardText}>先生成一套穿搭後，這裡會顯示你的作品。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
