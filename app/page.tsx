"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

const scenes = [
  { id: "date", label: "約會" },
  { id: "commute", label: "通勤" },
  { id: "party", label: "聚會" },
  { id: "outdoor", label: "戶外" },
];

const celebs = [
  { id: "jennie", label: "Jennie" },
  { id: "iu", label: "IU" },
  { id: "gd", label: "G-Dragon" },
  { id: "hailey", label: "Hailey" },
];

const heroCards = [
  { id: "1", title: "Minimal Office", subtitle: "簡約通勤風格", tone: "light" },
  { id: "2", title: "Street Casual", subtitle: "日常街頭靈感", tone: "dark" },
  { id: "3", title: "Soft Date", subtitle: "約會溫柔配色", tone: "light" },
];

export default function Page() {
  const [activeHero, setActiveHero] = useState(1);
  const [selectedScene, setSelectedScene] = useState("date");
  const [selectedCeleb, setSelectedCeleb] = useState("");
  const [showCelebs, setShowCelebs] = useState(false);

  const activePreset = useMemo(() => {
    if (selectedCeleb) return celebs.find((c) => c.id === selectedCeleb)?.label || "";
    return scenes.find((s) => s.id === selectedScene)?.label || "";
  }, [selectedScene, selectedCeleb]);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>FindOutfit</div>
        <nav className={styles.nav}>
          <a className={styles.navItem}>Home</a>
          <a className={styles.navItem}>Explore</a>
          <a className={styles.navItem}>My</a>
          <a className={styles.navItem}>Settings</a>
        </nav>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.heroHeader}>
          <div>
            <div className={styles.kicker}>Featured Looks</div>
            <h1 className={styles.heroTitle}>首頁主舞台</h1>
            <p className={styles.heroSub}>橫向版位，中間主卡完整呈現，左右卡用透明度與模糊做層次。</p>
          </div>
          <div className={styles.heroCounter}>
            <button
              className={styles.arrowBtn}
              onClick={() => setActiveHero((v) => (v - 1 + heroCards.length) % heroCards.length)}
            >
              ‹
            </button>
            <span>{activeHero + 1} / {heroCards.length}</span>
            <button
              className={styles.arrowBtn}
              onClick={() => setActiveHero((v) => (v + 1) % heroCards.length)}
            >
              ›
            </button>
          </div>
        </div>

        <div className={styles.heroRail}>
          {heroCards.map((card, idx) => {
            const isActive = idx === activeHero;
            return (
              <button
                key={card.id}
                className={isActive ? styles.heroMain : styles.heroSide}
                onClick={() => setActiveHero(idx)}
              >
                <div className={card.tone === "light" ? styles.mockFigureLight : styles.mockFigureDark} />
                <div className={styles.heroCaption}>
                  <div className={styles.heroCardTitle}>{card.title}</div>
                  <div className={styles.heroCardSub}>{card.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className={styles.dotRow}>
          {heroCards.map((card, idx) => (
            <button
              key={card.id}
              className={idx === activeHero ? styles.dotActive : styles.dot}
              onClick={() => setActiveHero(idx)}
            />
          ))}
        </div>
      </section>

      <section className={styles.generatorSection}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>Builder</div>
            <h2 className={styles.sectionTitle}>穿搭生成器</h2>
          </div>
          <div className={styles.badge}>已選：{activePreset || "未選擇"}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.blockTitle}>主要條件</div>
          <div className={styles.mainGrid}>
            <input className={styles.field} placeholder="年齡" />
            <input className={styles.field} placeholder="身高" />
            <input className={styles.field} placeholder="體重" />
            <input className={styles.field} placeholder="氣溫" />
            <select className={styles.field}>
              <option>性別</option>
              <option>女性</option>
              <option>男性</option>
              <option>中性</option>
            </select>
            <select className={styles.field}>
              <option>對象</option>
              <option>成人</option>
              <option>兒童</option>
            </select>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.blockTitle}>快速情境</div>
          <div className={styles.pillRow}>
            {scenes.map((scene) => (
              <button
                key={scene.id}
                className={selectedScene === scene.id && !selectedCeleb ? styles.activePill : styles.pill}
                onClick={() => {
                  setSelectedScene(scene.id);
                  setSelectedCeleb("");
                  setShowCelebs(false);
                }}
              >
                {scene.label}
              </button>
            ))}

            <button
              className={showCelebs ? styles.activePill : styles.pill}
              onClick={() => setShowCelebs((v) => !v)}
            >
              名人靈感
            </button>
          </div>

          {showCelebs ? (
            <div className={styles.celebPanel}>
              {celebs.map((celeb) => (
                <button
                  key={celeb.id}
                  className={selectedCeleb === celeb.id ? styles.activePill : styles.pill}
                  onClick={() => setSelectedCeleb(celeb.id)}
                >
                  {celeb.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.generateRow}>
          <button className={styles.primaryBtn}>生成穿搭</button>
          <button className={styles.secondaryBtn}>查看分享頁</button>
        </div>
      </section>

      <section className={styles.listSection}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>History</div>
            <h2 className={styles.sectionTitle}>最近生成</h2>
          </div>
        </div>
        <div className={styles.smallRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.smallCard}>
              <div className={i % 2 === 0 ? styles.smallMockLight : styles.smallMockDark} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.listSection}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>Favorites</div>
            <h2 className={styles.sectionTitle}>我的最愛</h2>
          </div>
        </div>
        <div className={styles.smallRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.smallCard}>
              <div className={i % 2 === 0 ? styles.smallMockDark : styles.smallMockLight} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
