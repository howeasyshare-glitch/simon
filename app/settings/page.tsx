"use client";

import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [gender, setGender] = useState("女性");
  const [audience, setAudience] = useState("成人");

  // 👉 初始化
  useEffect(() => {
    try {
      const raw = localStorage.getItem("findoutfit_settings");
      if (!raw) return;
      const data = JSON.parse(raw);
      setGender(data.gender || "女性");
      setAudience(data.audience || "成人");
    } catch {}
  }, []);

  // 👉 存設定
  useEffect(() => {
    localStorage.setItem(
      "findoutfit_settings",
      JSON.stringify({
        gender,
        audience,
      })
    );
  }, [gender, audience]);

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
