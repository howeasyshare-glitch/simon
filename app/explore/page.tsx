"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
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
        <HeroCarousel
          items={items}
          generatedItems={[]}
          stage="featured"
          setStage={() => {}}
        />
      </section>

      <section className={styles.contentWrap}>
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

      {zoomSrc && (
        <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} className={styles.modalImg} alt="" />
        </div>
      )}
    </main>
  );
}
