"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import { apiGetJson } from "../lib/apiFetch";
import OutfitCard from "../components/OutfitCard";

export default function Page() {
  const [featured, setFeatured] = useState<any[]>([]);
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
    const data = await apiGetJson<any>(
      `/api/data?op=explore&limit=8&sort=like&ts=${Date.now()}`
    );
    setFeatured(data?.items || []);
  }

  function getPos(i: number) {
    if (i === active) return "home_active";
    if (i === active - 1) return "home_prev";
    if (i === active + 1) return "home_next";
    return "home_hidden";
  }

  function move(dir: number) {
    setActive((prev) => Math.max(0, Math.min(prev + dir, featured.length - 1)));
  }

  return (
    <main className={styles.home_page}>
      <NavBar />

      <div className={styles.home_wrap}>
        {/* HERO */}
        <div className={styles.home_hero}>
          <div className={styles.home_carousel}>
            {featured.map((item, i) => (
              <div
                key={item.id}
                className={`${styles.home_card} ${styles[getPos(i)]}`}
                onClick={() => setActive(i)}
              >
                <img src={item.image_url} className={styles.home_image} />
              </div>
            ))}
          </div>

          <div className={styles.home_controls}>
            <button onClick={() => move(-1)}>←</button>
            <button onClick={() => move(1)}>→</button>
          </div>
        </div>

        {/* GENERATOR */}
        <div className={styles.home_generator}>
          <h2>穿搭生成器</h2>

          <div className={styles.home_sliders}>
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

          <div className={styles.home_ctaWrap}>
            <button className={styles.home_cta}>
              ✨ 生成穿搭
            </button>
          </div>
        </div>

        {/* LIST */}
        <div className={styles.home_list}>
          {featured.map((item) => (
            <OutfitCard
              key={item.id}
              item={item}
              compact
              onOpen={() => setZoomSrc(item.image_url)}
            />
          ))}
        </div>
      </div>

      {zoomSrc && (
        <div className={styles.home_modal} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} />
        </div>
      )}
    </main>
  );
}
