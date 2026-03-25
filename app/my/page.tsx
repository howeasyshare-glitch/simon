"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
import { apiGetJson } from "../../lib/apiFetch";
import { type OutfitItem } from "../../components/OutfitCard";

type ListResp = {
  ok?: boolean;
  items?: OutfitItem[];
};

export default function Page() {
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await apiGetJson<ListResp>(`/api/data?op=outfits.recent`);
    const f = await apiGetJson<ListResp>(`/api/data?op=outfits.favorites`);

    setRecent(r?.items || []);
    setFavorites(f?.items || []);
  }

  return (
    <main className={styles.page}>
      <NavBar />

      {/* 最近生成 */}
      <section className={styles.contentWrap}>
        <h2 className={styles.sectionTitle}>最近生成</h2>
        <HeroCarousel
          items={recent}
          generatedItems={[]}
          stage="featured"
          setStage={() => {}}
        />
      </section>

      {/* 我的最愛 */}
      <section className={styles.contentWrap}>
        <h2 className={styles.sectionTitle}>我的最愛</h2>
        <HeroCarousel
          items={favorites}
          generatedItems={[]}
          stage="featured"
          setStage={() => {}}
        />
      </section>
    </main>
  );
}
