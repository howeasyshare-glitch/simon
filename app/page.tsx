"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function Page() {
  const [active, setActive] = useState(1);

  const items = [0, 1, 2];

  return (
    <div className={styles.page}>

      {/* ===== HERO 橫向主舞台 ===== */}
      <div className={styles.hero}>
        {items.map((i) => (
          <div
            key={i}
            className={
              i === active
                ? styles.heroMain
                : styles.heroSide
            }
            onClick={() => setActive(i)}
          />
        ))}
      </div>

      {/* ===== 穿搭生成器 ===== */}
      <div className={styles.generator}>
        <h2>穿搭生成器</h2>

        {/* 主要條件 */}
        <div className={styles.mainGrid}>
          <input placeholder="年齡" />
          <input placeholder="身高" />
          <input placeholder="體重" />
          <input placeholder="氣溫" />
          <select>
            <option>性別</option>
          </select>
          <select>
            <option>對象</option>
          </select>
        </div>

        {/* 快速情境 */}
        <div className={styles.scene}>
          <button>約會</button>
          <button>通勤</button>
          <button>聚會</button>
          <button>戶外</button>
          <button>名人靈感</button>
        </div>
      </div>

      {/* ===== 最近 / 收藏 ===== */}
      <div className={styles.section}>
        <h3>最近生成</h3>
        <div className={styles.row}>
          {items.map((i) => (
            <div key={i} className={styles.smallCard} />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3>我的最愛</h3>
        <div className={styles.row}>
          {items.map((i) => (
            <div key={i} className={styles.smallCard} />
          ))}
        </div>
      </div>

    </div>
  );
}
