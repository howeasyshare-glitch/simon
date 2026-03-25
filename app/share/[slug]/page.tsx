// OVERWRITE: app/share/[slug]/page.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "../../page.module.css";
import NavBar from "../../../components/NavBar";

export default function Page({ params }: any) {
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await fetch(`/api/share?slug=${params.slug}`);
    const j = await r.json();
    setItem(j.outfit);
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        {item && (
          <div className={styles.shareStage}>
            <img src={item.image_url} className={styles.heroImage} />

            <div>
              <h2>{item.summary}</h2>

              <button className={styles.primaryBtn}>
                套用這套穿搭
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
