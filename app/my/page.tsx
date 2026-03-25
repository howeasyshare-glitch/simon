// OVERWRITE: app/my/page.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
import { apiGetJson } from "../../lib/apiFetch";

export default function Page() {
  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await apiGetJson(`/api/data?op=outfits.recent`);
    const f = await apiGetJson(`/api/data?op=outfits.favorites`);
    setRecent(r?.items || []);
    setFavorites(f?.items || []);
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        <HeroCarousel
          items={recent}
          generatedItems={[]}
          stage="featured"
          setStage={() => {}}
        />
      </section>

      <section className={styles.contentWrap}>
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
