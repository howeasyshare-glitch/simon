"use client";

import Link from "next/link";
import styles from "../app/page.module.css";

export type OutfitItem = {
  id: string;
  created_at?: string;
  share_slug?: string | null;
  image_url?: string;
  summary?: string | null;
  style?: any;
  like_count?: number;
  share_count?: number;
  apply_count?: number;
  is_public?: boolean;
  spec?: any;
};

type Props = {
  item: OutfitItem;
  liked?: boolean;
  shared?: boolean;
  compact?: boolean;
  onLike?: () => void;
  onShare?: () => void;
  onApply?: () => void;
  onOpen?: () => void;
};

export default function OutfitCard({
  item,
  liked = false,
  shared = false,
  compact = false,
  onLike,
  onShare,
  onApply,
  onOpen,
}: Props) {
  const title = item.style?.style || "Outfit";
  const href = item.share_slug ? `/share/${item.share_slug}` : "/explore";

  if (compact) {
    return (
      <article className={styles.smallCard}>
        <button type="button" className={styles.cardImageBtn} onClick={onOpen}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.summary || title} className={styles.smallCardImage} />
          ) : (
            <div className={styles.smallCardImageFallback} />
          )}
        </button>
        <div className={styles.compactMeta}>{title}</div>
      </article>
    );
  }

  return (
    <article className={styles.cardTile}>
      <button type="button" className={styles.cardImageBtn} onClick={onOpen}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.summary || title} className={styles.cardImage} />
        ) : (
          <div className={styles.cardImageFallback} />
        )}
      </button>

      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{title}</div>
        <div className={styles.cardText}>{item.summary || "AI 穿搭靈感"}</div>

        <div className={styles.cardActions}>
          <button type="button" className={liked ? styles.activeGhostBtn : styles.ghostBtn} onClick={onLike}>
            {liked ? "已讚" : "Like"}
          </button>

          <button type="button" className={shared ? styles.activeGhostBtn : styles.ghostBtn} onClick={onShare}>
            {shared ? "已分享" : "分享"}
          </button>

          <button type="button" className={styles.primaryBtn} onClick={onApply}>
            套用
          </button>

          <Link href={href} className={styles.linkBtn}>
            查看
          </Link>
        </div>

        <div className={styles.cardMeta}>
          <span>♥ {item.like_count || 0}</span>
          <span>↗ {item.share_count || 0}</span>
        </div>
      </div>
    </article>
  );
}
