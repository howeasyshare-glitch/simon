"use client";

import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";

export default function SystemPage() {
  const [temperature, setTemperature] = useState(0.7);
  const [creativity, setCreativity] = useState(0.5);
  const [withBag, setWithBag] = useState(false);

  // 👉 初始化（讀 localStorage）
  useEffect(() => {
    try {
      const raw = localStorage.getItem("findoutfit_system");
      if (!raw) return;
      const data = JSON.parse(raw);
      setTemperature(data.temperature ?? 0.7);
      setCreativity(data.creativity ?? 0.5);
      setWithBag(data.withBag ?? false);
    } catch {}
  }, []);

  // 👉 每次變更就存
  useEffect(() => {
    localStorage.setItem(
      "findoutfit_system",
      JSON.stringify({
        temperature,
        creativity,
        withBag,
      })
    );
  }, [temperature, creativity, withBag]);

  return (
    <main className={styles.page}>
      <NavBar />

      <div className={styles.contentWrap}>
        <h2 className={styles.sectionTitle}>系統設定</h2>

        <div className={styles.card}>
          <div className={styles.blockTitle}>穿搭生成器參數</div>

          <label className={styles.sliderCard}>
            <span className={styles.sliderTop}>
              <span className={styles.sliderLabel}>風格強度</span>
              <span className={styles.sliderValue}>{temperature}</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </label>

          <label className={styles.sliderCard}>
            <span className={styles.sliderTop}>
              <span className={styles.sliderLabel}>創意程度</span>
              <span className={styles.sliderValue}>{creativity}</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={creativity}
              onChange={(e) => setCreativity(Number(e.target.value))}
            />
          </label>

          <div className={styles.segmentRow}>
            <button
              className={withBag ? styles.activePill : styles.pill}
              onClick={() => setWithBag((v) => !v)}
            >
              包包偏好：{withBag ? "開啟" : "關閉"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
