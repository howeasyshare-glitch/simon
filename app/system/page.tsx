"use client";

import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";
import { apiGetJson, apiPostJson } from "../../lib/apiFetch";
import { supabase } from "../../lib/supabase/client";

export default function SystemPage() {
  const [temperature, setTemperature] = useState(0.7);
  const [creativity, setCreativity] = useState(0.5);
  const [withBag, setWithBag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState("");

  useEffect(() => {
    loadSystem();
  }, []);

  async function loadSystem() {
    try {
      const raw = localStorage.getItem("findoutfit_system");
      if (raw) {
        const data = JSON.parse(raw);
        setTemperature(data.temperature ?? 0.7);
        setCreativity(data.creativity ?? 0.5);
        setWithBag(data.withBag ?? false);
      }
    } catch {}

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const data = await apiGetJson<any>(`/api/data?op=user.settings.get&ts=${Date.now()}`);
      const system = data?.item?.system;
      if (!system) return;

      setTemperature(system.temperature ?? 0.7);
      setCreativity(system.creativity ?? 0.5);
      setWithBag(system.withBag ?? false);
    } catch {}
  }

  async function save() {
    setSaving(true);
    setSavedText("");
    try {
      const system = {
        temperature,
        creativity,
        withBag,
      };

      localStorage.setItem("findoutfit_system", JSON.stringify(system));

      const settingsRaw = localStorage.getItem("findoutfit_settings");
      let gender = undefined;
      let audience = undefined;
      try {
        const settings = settingsRaw ? JSON.parse(settingsRaw) : null;
        gender = settings?.gender;
        audience = settings?.audience;
      } catch {}

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        await apiPostJson("/api/data?op=user.settings.upsert", {
          gender,
          audience,
          system,
        });
      }

      setSavedText("已儲存");
    } catch {
      setSavedText("儲存失敗");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedText(""), 2200);
    }
  }

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

          <div className={styles.generateRow} style={{ marginTop: 16 }}>
            <button className={styles.primaryBtn} onClick={save} disabled={saving}>
              {saving ? "儲存中..." : "儲存系統設定"}
            </button>
            {savedText ? <span className={styles.emptyText}>{savedText}</span> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
