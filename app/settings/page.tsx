"use client";

import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import { useEffect, useState } from "react";
import { apiGetJson, apiPostJson } from "../../lib/apiFetch";
import { supabase } from "../../lib/supabase/client";

export default function SettingsPage() {
  const [gender, setGender] = useState("女性");
  const [audience, setAudience] = useState("成人");
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const raw = localStorage.getItem("findoutfit_settings");
      if (raw) {
        const data = JSON.parse(raw);
        setGender(data.gender || "女性");
        setAudience(data.audience || "成人");
      }
    } catch {}

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const data = await apiGetJson<any>(`/api/data?op=user.settings.get&ts=${Date.now()}`);
      const item = data?.item;
      if (!item) return;

      setGender(item.gender || "女性");
      setAudience(item.audience || "成人");
    } catch {}
  }

  async function save() {
    setSaving(true);
    setSavedText("");
    try {
      localStorage.setItem(
        "findoutfit_settings",
        JSON.stringify({
          gender,
          audience,
        })
      );

      const systemRaw = localStorage.getItem("findoutfit_system");
      let system = null;
      try {
        system = systemRaw ? JSON.parse(systemRaw) : null;
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

          <div className={styles.generateRow} style={{ marginTop: 16 }}>
            <button className={styles.primaryBtn} onClick={save} disabled={saving}>
              {saving ? "儲存中..." : "儲存設定"}
            </button>
            {savedText ? <span className={styles.emptyText}>{savedText}</span> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
