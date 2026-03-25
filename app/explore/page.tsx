"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import OutfitCard, { type OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";

type ListResp = {
  ok?: boolean;
  items?: OutfitItem[];
};

export default function Page() {
  const [items, setItems] = useState<OutfitItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await apiGetJson<ListResp>(`/api/data?op=explore&limit=60`);
    setItems(data?.items || []);
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>Explore</div>
            <h1 className={styles.sectionTitle}>全部公開穿搭</h1>
          </div>
        </div>

        <div className={styles.exploreGrid}>
          {items.map((item) => (
            <OutfitCard
              key={item.id}
              item={item}
              onOpen={() => item.image_url && setZoomSrc(item.image_url)}
            />
          ))}
        </div>
      </section>

      {zoomSrc ? (
        <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} className={styles.modalImg} alt="" />
        </div>
      ) : null}
    </main>
  );
}
