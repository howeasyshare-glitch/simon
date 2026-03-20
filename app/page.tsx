"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";

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

const featured = [
  { id: "1", title: "Minimal Office", subtitle: "簡約通勤風格", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80" },
  { id: "2", title: "Street Casual", subtitle: "日常街頭靈感", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80" },
  { id: "3", title: "Soft Date", subtitle: "約會溫柔配色", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80" },
  { id: "4", title: "Weekend Outdoor", subtitle: "輕鬆戶外穿搭", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80" },
  { id: "5", title: "Clean Layers", subtitle: "乾淨層次造型", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80" },
];

const historyCards = [
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=500&q=80",
];

export default function Page() {
  const [selectedScene, setSelectedScene] = useState("date");
  const [selectedCeleb, setSelectedCeleb] = useState("");
  const [showCelebs, setShowCelebs] = useState(false);
  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(55);
  const [temp, setTemp] = useState(22);
  const [gender, setGender] = useState("女性");
  const [audience, setAudience] = useState("成人");
  const railRef = useRef<HTMLDivElement | null>(null);

  const activeLabel = useMemo(() => {
    if (selectedCeleb) return celebs.find((c) => c.id === selectedCeleb)?.label || "";
    return scenes.find((s) => s.id === selectedScene)?.label || "";
  }, [selectedScene, selectedCeleb]);

  const scrollRail = (dir: "left" | "right") => {
    const el = railRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.72);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <main className={styles.page}>
      <NavBar />

      <section className={styles.contentWrap}>
        <section className={styles.heroSection}>
          <div className={styles.heroHeader}>
            <div>
              <div className={styles.kicker}>Featured Looks</div>
              <h1 className={styles.heroTitle}>首頁主舞台</h1>
              <p className={styles.heroSub}>改成橫向滑動感的主舞台，不再是三張旋轉木馬。卡片排成一列，中間聚焦、左右延伸。</p>
            </div>
            <div className={styles.heroControls}>
              <button className={styles.arrowBtn} onClick={() => scrollRail("left")}>‹</button>
              <button className={styles.arrowBtn} onClick={() => scrollRail("right")}>›</button>
            </div>
          </div>

          <div className={styles.heroViewport}>
            <div className={styles.heroRail} ref={railRef}>
              {featured.map((card, idx) => (
                <article key={card.id} className={`${styles.heroCard} ${idx === 1 ? styles.heroCardActive : ""}`}>
                  <div className={styles.heroImageFrame}>
                    <div className={styles.heroImageBg} style={{ backgroundImage: `url(${card.image})` }} />
                    <img src={card.image} alt={card.title} className={styles.heroImage} />
                  </div>
                  <div className={styles.heroInfo}>
                    <div className={styles.heroCardTitle}>{card.title}</div>
                    <div className={styles.heroCardText}>{card.subtitle}</div>
                    <div className={styles.heroCardActions}>
                      <button className={styles.ghostBtn}>Like</button>
                      <button className={styles.ghostBtn}>分享</button>
                      <button className={styles.primaryBtn}>套用</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.generatorSection}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.kicker}>Builder</div>
              <h2 className={styles.sectionTitle}>穿搭生成器</h2>
            </div>
            <div className={styles.badge}>已選：{activeLabel || "未選擇"}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.blockTitle}>主要條件</div>
            <div className={styles.sliderGrid}>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>年齡</span><input type="range" min="5" max="60" value={age} onChange={(e) => setAge(Number(e.target.value))} /><span className={styles.sliderValue}>{age}</span></label>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>身高</span><input type="range" min="120" max="200" value={height} onChange={(e) => setHeight(Number(e.target.value))} /><span className={styles.sliderValue}>{height} cm</span></label>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>體重</span><input type="range" min="30" max="120" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /><span className={styles.sliderValue}>{weight} kg</span></label>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>氣溫</span><input type="range" min="0" max="35" value={temp} onChange={(e) => setTemp(Number(e.target.value))} /><span className={styles.sliderValue}>{temp}°C</span></label>
            </div>
            <div className={styles.segmentRow}>
              {["女性", "男性", "中性"].map((v) => <button key={v} className={gender === v ? styles.activePill : styles.pill} onClick={() => setGender(v)}>{v}</button>)}
            </div>
            <div className={styles.segmentRow}>
              {["成人", "兒童"].map((v) => <button key={v} className={audience === v ? styles.activePill : styles.pill} onClick={() => setAudience(v)}>{v}</button>)}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.blockTitle}>快速情境</div>
            <div className={styles.pillRow}>
              {scenes.map((scene) => (
                <button key={scene.id} className={selectedScene === scene.id && !selectedCeleb ? styles.activePill : styles.pill} onClick={() => { setSelectedScene(scene.id); setSelectedCeleb(""); setShowCelebs(false); }}>{scene.label}</button>
              ))}
              <button className={showCelebs ? styles.activePill : styles.pill} onClick={() => setShowCelebs((v) => !v)}>名人靈感</button>
            </div>
            {showCelebs ? (
              <div className={styles.celebPanel}>
                {celebs.map((celeb) => <button key={celeb.id} className={selectedCeleb === celeb.id ? styles.activePill : styles.pill} onClick={() => setSelectedCeleb(celeb.id)}>{celeb.label}</button>)}
              </div>
            ) : null}
          </div>

          <div className={styles.generateRow}>
            <button className={styles.generateBtn}>生成穿搭</button>
            <button className={styles.secondaryBtn}>查看分享頁</button>
          </div>
        </section>

        <section className={styles.historySection}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.kicker}>Activity</div>
              <h2 className={styles.sectionTitle}>最近活動</h2>
            </div>
          </div>

          <div className={styles.historyBlock}>
            <div className={styles.historyTitle}>最近生成</div>
            <div className={styles.smallRow}>
              {historyCards.map((src, i) => <div key={src + i} className={styles.smallCard}><img src={src} alt="" className={styles.smallCardImage} /></div>)}
            </div>
          </div>

          <div className={styles.historyBlock}>
            <div className={styles.historyTitle}>我的最愛</div>
            <div className={styles.smallRow}>
              {historyCards.slice().reverse().map((src, i) => <div key={src + i} className={styles.smallCard}><img src={src} alt="" className={styles.smallCardImage} /></div>)}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
