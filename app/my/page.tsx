"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import HeroCarousel from "../../components/HeroCarousel";
import type { OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function Page() {
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);
  const [zoomSrc, setZoomSrc] = useState("");

  useEffect(() => {
    void load();
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
    } catch {
      setRecent([]);
    }
  }

  async function loadFavorites() {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }
      const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(
        `/api/data?op=outfits.favorites&limit=20&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`
      );
      setFavorites(data?.items || []);
    } catch {
      setFavorites([]);
    }
  }

  function applyPreset(item: OutfitItem) {
    const anyItem: any = item;
    const echo = anyItem?.style?._echo || anyItem?.style?.echo || anyItem?.spec?._echo || {};
    localStorage.setItem(
      "findoutfit_apply_preset",
      JSON.stringify({
        id: item.id,
        style: anyItem?.style?.style,
        palette: anyItem?.style?.palette,
        styleVariant: anyItem?.style?.styleVariant,
        gender: anyItem?.style?.gender || echo.gender,
        audience: anyItem?.style?.audience || echo.audience,
        age: echo.age,
        height: echo.height,
        weight: echo.weight,
        temp: echo.temp,
      })
    );
    window.location.href = "/";
  }

  function isLiked(id: string) {
    return typeof window !== "undefined" && localStorage.getItem(`liked_${id}`) === "1";
  }

  function isShared(id: string) {
    return typeof window !== "undefined" && localStorage.getItem(`shared_${id}`) === "1";
  }

  async function toggleLike(item: OutfitItem) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }

    const liked = isLiked(item.id);
    const op = liked ? "outfits.unlike" : "outfits.like";

    try {
      await fetch(`/api/data?op=${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }),
      });
    } catch {}

    if (liked) localStorage.removeItem(`liked_${item.id}`);
    else localStorage.setItem(`liked_${item.id}`, "1");

    setRecent((prev) => [...prev]);
    setFavorites((prev) => [...prev]);
  }

  async function shareItem(item: OutfitItem) {
    const key = `shared_${item.id}`;
    const already = localStorage.getItem(key) === "1";

    try {
      await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
    } catch {}

    localStorage.setItem(key, "1");

    if (item.share_slug) {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    }

    setRecent((prev) => [...prev]);
    setFavorites((prev) => [...prev]);
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

        <HeroCarousel
          mode="simple"
          kicker="Recent"
          title="最近生成"
          items={recent}
          generatedItems={[]}
          stage="featured"
          setStage={() => {}}
          onOpen={(src) => setZoomSrc(src)}
          onLike={toggleLike}
          onShare={shareItem}
          onApply={applyPreset}
          isLiked={isLiked}
          isShared={isShared}
        />

        <HeroCarousel
          mode="simple"
          kicker="Favorites"
          title="我的最愛"
          items={favorites}
          generatedItems={[]}
          stage="featured"
          setStage={() => {}}
          onOpen={(src) => setZoomSrc(src)}
          onLike={toggleLike}
          onShare={shareItem}
          onApply={applyPreset}
          isLiked={isLiked}
          isShared={isShared}
        />
      </section>

      {zoomSrc ? (
        <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} alt="" className={styles.modalImg} />
        </div>
      ) : null}
    </main>
  );
}
