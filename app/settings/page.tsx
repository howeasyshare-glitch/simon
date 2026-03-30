"use client";

import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import { useState } from "react";

export default function SettingsPage() {
  const [gender, setGender] = useState("女性");
  const [audience, setAudience] = useState("成人");

  return (
    <main className={styles.page}>
      <NavBar />

      <div className={styles.contentWrap}>
        <h2 className={styles.sectionTitle}>設定</h2>

        <div className={styles.card}>
          <div className={styles.blockTitle}>基本偏好</div>

          <div className={styles.segmentRow}>
            {["女性", "男性", "中性"].map((v) => (
              <button
                key={v}
                className={gender === v ? styles.activePill : styles.pill}
                onClick={() => setGender(v)}
              >
                {v}
              </button>
            ))}
          </div>

          <div className={styles.segmentRow}>
            {["成人", "兒童"].map((v) => (
              <button
                key={v}
                className={audience === v ? styles.activePill : styles.pill}
                onClick={() => setAudience(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
