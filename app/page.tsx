"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import { apiGetJson, apiPostJson } from "../lib/apiFetch";
import OutfitCard from "../components/OutfitCard";

type OutfitItem = any;

export default function Page() {
  const [featured, setFeatured] = useState<OutfitItem[]>([]);
  const [active, setActive] = useState(0);
  const [zoomSrc, setZoomSrc] = useState("");

  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(55);
  const [temp, setTemp] = useState(22);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await apiGetJson<any>(
        `/api/data?op=explore&limit=8&sort=like&ts=${Date.now()}`
      );
      setFeatured(data?.items || []);
    } catch {}
  }

  // =============================
  // ⭐ HERO 卡片位置計算（重點）
  // =============================
  function getPos(i: number) {
    if (i === active) return "active";
    if (i === active - 1) return "prev";
    if (i === active + 1) return "next";
    return "hidden";
  }

  function move(dir: number) {
    setActive((prev) => {
      const next = prev + dir;
      if (next < 0) return 0;
      if (next >= featured.length) return featured.length - 1;
      return next;
    });
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.wrap}>
        {/* ================= HERO ================= */}
        <section className={styles.hero}>
          <div className={styles.carousel}>
            {featured.map((item, i) => {
              const pos = getPos(i);

              return (
                <div
                  key={item.id}
                  className={`${styles.card} ${styles[pos]}`}
                  onClick={() => setActive(i)}
                >
                  <img src={item.image_url} className={styles.image} />
                </div>
              );
            })}
          </div>

          {/* 控制 */}
          <div className={styles.controls}>
            <button onClick={() => move(-1)}>←</button>
            <button onClick={() => move(1)}>→</button>
          </div>
        </section>

        {/* ================= GENERATOR ================= */}
        <section className={styles.generator}>
          <h2>穿搭生成器</h2>

          <div className={styles.sliders}>
            <label>
              年齡 {age}
              <input type="range" min="5" max="60" value={age} onChange={(e) => setAge(Number(e.target.value))} />
            </label>

            <label>
              身高 {height}
              <input type="range" min="120" max="200" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            </label>

            <label>
              體重 {weight}
              <input type="range" min="30" max="120" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
            </label>

            <label>
              氣溫 {temp}
              <input type="range" min="0" max="35" value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
            </label>
          </div>

          {/* ⭐ 主 CTA */}
          <div className={styles.ctaWrap}>
            <button className={styles.cta}>
              ✨ 生成穿搭
            </button>
          </div>
        </section>

        {/* ================= LIST ================= */}
        <section className={styles.list}>
          {featured.map((item) => (
            <OutfitCard
              key={item.id}
              item={item}
              compact
              onOpen={() => setZoomSrc(item.image_url)}
            />
          ))}
        </section>
      </section>

      {/* ⭐ 只保留 modal，不再插入頁面 */}
      {zoomSrc && (
        <div className={styles.modal} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} />
        </div>
      )}
    </main>
  );
}
