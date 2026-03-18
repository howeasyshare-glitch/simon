"use client";

import Link from "next/link";
import styles from "../app/page.module.css";

export type OutfitItem = {
  id: string;
  share_slug?: string | null;
  image_url?: string;
  summary?: string | null;
  style?: any;
  like_count?: number;
  share_count?: number;
};

type Props = {
  item: OutfitItem;
  liked?: boolean;
  compact?: boolean;
  onLike?: () => void;
  onShare?: () => void;
  onApply?: () => void;
  onOpen?: () => void;
};

export default function OutfitCard({ item, liked = false, compact = false, onLike, onShare, onApply, onOpen }: Props) {
  const title = item.style?.style || "Outfit";
  const href = item.share_slug ? `/share/${item.share_slug}` : "/explore";
  return (
    <article className={compact ? styles.smallCard : styles.cardTile}>
      <button type="button" className={styles.cardImageBtn} onClick={onOpen}>
        {item.image_url ? <img src={item.image_url} alt={item.summary || title} className={compact ? styles.smallCardImage : styles.cardImage} /> : <div className={compact ? styles.smallCardImageFallback : styles.cardImageFallback} />}
      </button>
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{title}</div>
        {!compact ? <div className={styles.cardText}>{item.summary || "AI 穿搭靈感"}</div> : null}
        {!compact ? (
          <>
            <div className={styles.cardActions}>
              <button type="button" className={styles.ghostBtn} onClick={onLike}>{liked ? "取消讚" : "Like"}</button>
              <button type="button" className={styles.ghostBtn} onClick={onShare}>分享</button>
              <button type="button" className={styles.primaryBtn} onClick={onApply}>套用</button>
              <Link href={href} className={styles.linkBtn}>查看</Link>
            </div>
            <div className={styles.cardMeta}><span>♥ {item.like_count || 0}</span><span>↗ {item.share_count || 0}</span></div>
          </>
        ) : (
          <div className={styles.compactMeta}>{title}</div>
        )}
      </div>
    </article>
  );
}
