"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
import { apiGetJson } from "../../lib/apiFetch";

export default function MyPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await apiGetJson("/api/data?op=outfits.recent&limit=12");
      setItems(data?.items || []);
    } catch {
      setItems([]);
    }
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        <HeroCarousel
          items={items}
          generatedItems={items}
          stage="generated"
          setStage={() => {}}
          mode="simple"
        />
      </section>
    </main>
  );
}
