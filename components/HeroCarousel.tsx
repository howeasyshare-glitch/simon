"use client";

import styles from "../app/page.module.css";
import type { OutfitItem } from "./OutfitCard";

type Props = {
  items: OutfitItem[];
  active: number;
  setActive: (n: number) => void;
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

export default function HeroCarousel({ items, active, setActive, stage, setStage, generatedImageUrl, generatedShareUrl, generatedSummary, onOpen, onLike, onShare, onApply, isLiked }: Props) {
  const current = items[active] || null;
  const prevIndex = items.length ? (active - 1 + items.length) % items.length : 0;
  const nextIndex = items.length ? (active + 1) % items.length : 0;

  const side = (idx: number) => {
    const item = items[idx];
    if (!item) return <div className={styles.heroSide} />;
    return (
      <button type="button" className={styles.heroSide} onClick={() => setActive(idx)}>
        {item.image_url ? <img src={item.image_url} alt="" className={styles.heroImage} /> : <div className={styles.heroImageFallback} />}
      </button>
    );
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroHeader}>
        <div>
          <div className={styles.kicker}>Featured Looks</div>
          <h1 className={styles.heroTitle}>首頁主舞台</h1>
          <p className={styles.heroSub}>桌機版採橫向主舞台。中間顯示主作品，左右顯示前後卡，透過明暗與透明度做對比。</p>
        </div>
        <div className={styles.stageTabs}>
          <button type="button" className={stage === 'featured' ? styles.tabActive : styles.tab} onClick={() => setStage('featured')}>精選靈感</button>
          <button type="button" className={stage === 'generated' ? styles.tabActive : styles.tab} onClick={() => generatedImageUrl && setStage('generated')}>我的生成</button>
        </div>
      </div>
      {stage === 'featured' ? (current ? (
        <>
          <div className={styles.heroRail}>
            {side(prevIndex)}
            <div className={styles.heroMain}>
              <button type="button" className={styles.heroMainImageBtn} onClick={() => current.image_url && onOpen?.(current.image_url)}>
                {current.image_url ? <img src={current.image_url} alt={current.summary || 'featured'} className={styles.heroImage} /> : <div className={styles.heroImageFallback} />}
              </button>
              <div className={styles.heroInfo}>
                <div className={styles.heroCardTitle}>{current.style?.style || 'Outfit'}</div>
                <div className={styles.heroCardText}>{current.summary || '精選穿搭靈感'}</div>
                <div className={styles.heroMeta}><span>♥ {current.like_count || 0}</span><span>↗ {current.share_count || 0}</span></div>
                <div className={styles.heroCardActions}>
                  <button type="button" className={styles.ghostBtn} onClick={() => onLike?.(current)}>{isLiked?.(current.id) ? '取消讚' : 'Like'}</button>
                  <button type="button" className={styles.ghostBtn} onClick={() => onShare?.(current)}>分享</button>
                  <button type="button" className={styles.primaryBtn} onClick={() => onApply?.(current)}>套用</button>
                </div>
              </div>
            </div>
            {side(nextIndex)}
          </div>
          <div className={styles.dotRow}>
            {items.map((item, idx) => <button key={item.id} type="button" className={idx === active ? styles.dotActive : styles.dot} onClick={() => setActive(idx)} />)}
          </div>
        </>
      ) : <div className={styles.emptyState}>目前還沒有可顯示的精選作品。</div>) : (
        <div className={styles.generatedStage}>
          <div className={styles.generatedMain}>{generatedImageUrl ? <img src={generatedImageUrl} alt="generated" className={styles.heroImage} /> : <div className={styles.heroImageFallback} />}</div>
          <div className={styles.generatedInfo}>
            <div className={styles.heroCardTitle}>我的生成</div>
            <div className={styles.heroCardText}>{generatedSummary || '生成完成後，結果會出現在這裡。'}</div>
            <div className={styles.heroCardActions}>{generatedShareUrl ? <a href={generatedShareUrl} className={styles.linkBtn}>開啟分享頁</a> : null}</div>
          </div>
        </div>
      )}
    </section>
  );
}
