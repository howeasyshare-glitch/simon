"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import OutfitCard, { type OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function Page() {
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    await Promise.all([loadRecent(), loadFavorites()]);
  }

  async function loadRecent() {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch(`/api/data?op=outfits.recent&limit=20&ts=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
      const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=outfits.favorites&limit=20&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`);
      setFavorites(data?.items || []);
    } catch {}
  }

  return (
    <main className={styles.page}>
      <NavBar />
      <section className={styles.contentWrap}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>My</div>
            <h1 className={styles.sectionTitle}>我的內容</h1>
          </div>
        </div>

        <section className={styles.listSection}>
          <div className={styles.historyBlock}>
            <div className={styles.historyTitle}>最近生成</div>
            {recent.length ? <div className={styles.exploreGrid}>{recent.map((item) => <OutfitCard key={item.id} item={item} onOpen={() => item.image_url && setZoomSrc(item.image_url)} />)}</div> : <div className={styles.emptyText}>目前沒有最近生成資料。</div>}
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.historyBlock}>
            <div className={styles.historyTitle}>我的最愛</div>
            {favorites.length ? <div className={styles.exploreGrid}>{favorites.map((item) => <OutfitCard key={item.id} item={item} onOpen={() => item.image_url && setZoomSrc(item.image_url)} />)}</div> : <div className={styles.emptyText}>目前沒有收藏資料。</div>}
          </div>
        </section>
      </section>

      {zoomSrc ? <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}><img src={zoomSrc} alt="" className={styles.modalImg} /></div> : null}
    </main>
  );
}
