
"use client";

import Link from "next/link";
import styles from "../app/page.module.css";

export type OutfitCardItem = {
  id: string;
  share_slug?: string | null;
  image_url?: string;
  summary?: string | null;
  style?: any;
  created_at?: string;
  like_count?: number;
  share_count?: number;
};

type Props = {
  item: OutfitCardItem;
  liked?: boolean;
  onOpen?: (src?: string) => void;
  onLike?: () => void;
  onShare?: () => void;
  onApply?: () => void;
  compact?: boolean;
};

export default function OutfitCard({ item, liked = false, onOpen, onLike, onShare, onApply, compact = false }: Props) {
  return (
    <article className={compact ? styles.smallCard : styles.outfitCard}>
      <button className={styles.cardThumbBtn} type="button" onClick={() => onOpen?.(item.image_url)}>
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.summary || item.style?.style || "Outfit"}
            className={compact ? styles.smallThumbImg : styles.cardThumbImg}
          />
        ) : (
          <div className={compact ? styles.smallThumbEmpty : styles.cardThumbEmpty} />
        )}
      </button>

      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{item.style?.style || "Outfit"}</div>
        <div className={styles.cardText}>{item.summary || "AI 穿搭靈感"}</div>

        {!compact ? (
          <>
            <div className={styles.actionRow}>
              <button type="button" className={styles.actionBtn} onClick={onLike}>
                {liked ? "取消讚" : "Like"}
              </button>
              <button type="button" className={styles.actionBtn} onClick={onShare}>
                分享
              </button>
              <button type="button" className={styles.actionBtnPrimary} onClick={onApply}>
                套用
              </button>
              <Link href={item.share_slug ? `/share/${item.share_slug}` : "/explore"} className={styles.actionLink}>
                查看
              </Link>
            </div>
            <div className={styles.cardMeta}>
              <span>♥ {item.like_count || 0}</span>
              <span>↗ {item.share_count || 0}</span>
            </div>
          </>
        ) : (
          <div className={styles.smallCardMeta}>
            <span>♥ {item.like_count || 0}</span>
            <span>↗ {item.share_count || 0}</span>
          </div>
        )}
      </div>
    </article>
  );
}
