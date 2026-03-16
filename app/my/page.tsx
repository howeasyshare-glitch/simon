
"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import OutfitCard, { type OutfitCardItem } from "../../components/OutfitCard";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function Page() {
  const [recent, setRecent] = useState<OutfitCardItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitCardItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    await Promise.all([loadRecent(), loadFavorites()]);
  }

  async function loadRecent() {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/data?op=outfits.recent&limit=20&ts=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await r.json();
      if (r.ok && j?.ok) setRecent(j.items || []);
    } catch {}
  }

  async function loadFavorites() {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }
      const r = await fetch(`/api/data?op=outfits.favorites&limit=20&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (r.ok && j?.ok) setFavorites(j.items || []);
    } catch {}
  }

  return (
    <div className={styles.pageShell}>
      <NavBar />
      <div className={styles.pageWrap}>
        <div className={styles.listPageHeader}>
          <div>
            <div className={styles.sectionKicker}>我的內容</div>
            <h1 className={styles.pageTitle}>My</h1>
            <p className={styles.pageSub}>查看你的最近生成與收藏作品。</p>
          </div>
        </div>

        <section className={styles.bottomSection}>
          <div className={styles.subSectionTitle}>最近生成</div>
          <div className={styles.cardGrid}>
            {recent.map((item) => (
              <OutfitCard key={item.id} item={item} onOpen={(src) => setZoomSrc(src || "")} />
            ))}
          </div>
        </section>

        <section className={styles.bottomSection}>
          <div className={styles.subSectionTitle}>我的最愛</div>
          <div className={styles.cardGrid}>
            {favorites.map((item) => (
              <OutfitCard key={item.id} item={item} onOpen={(src) => setZoomSrc(src || "")} />
            ))}
          </div>
        </section>

        {zoomSrc ? (
          <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
            <img src={zoomSrc} alt="" className={styles.modalImg} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
