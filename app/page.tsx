"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import OutfitCard from "../components/OutfitCard";
import { apiGetJson } from "../lib/apiFetch";

type OutfitItem = {
  id: string;
  image_url?: string;
  share_slug?: string;
  summary?: string;
  style?: any;
};

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

export default function Page() {
  const [featured, setFeatured] = useState<OutfitItem[]>([]);
  const [active, setActive] = useState(0);
  const [zoomSrc, setZoomSrc] = useState("");
  const [showCelebs, setShowCelebs] = useState(false);
  const [scene, setScene] = useState("date");
  const [celeb, setCeleb] = useState("");
  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(55);
  const [temp, setTemp] = useState(22);
  const [gender, setGender] = useState("女性");
  const [audience, setAudience] = useState("成人");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetJson<any>(`/api/data?op=explore&limit=8&sort=like&ts=${Date.now()}`);
        setFeatured(data?.items || []);
      } catch {}
    })();
  }, []);

  function move(dir: number) {
    setActive((prev) => {
      const n = prev + dir;
      if (n < 0) return 0;
      if (n >= featured.length) return featured.length - 1;
      return n;
    });
  }

  function getPos(i: number) {
    if (i === active) return "home_active";
    if (i === active - 1) return "home_prev";
    if (i === active + 1) return "home_next";
    return "home_hidden";
  }

  const selectedLabel = useMemo(() => {
    if (celeb) return celebs.find((c) => c.id === celeb)?.label || "";
    return scenes.find((s) => s.id === scene)?.label || "";
  }, [scene, celeb]);

  return (
    <main className={styles.home_page}>
      <NavBar />

      <div className={styles.home_wrap}>
        <section className={styles.homeHeroBlock}>
          <div className={styles.homeHeroHead}>
            <div>
              <div className={styles.homeEyebrow}>Featured Looks</div>
              <h1 className={styles.homeHeroTitle}>找靈感，再生成自己的穿搭</h1>
              <p className={styles.homeHeroText}>
                主舞台保留滑動卡片感，其他區塊重新整理成更清楚、順手的操作流程。
              </p>
            </div>

            <div className={styles.homeHeroActions}>
              <button className={styles.homeArrowBtn} onClick={() => move(-1)} aria-label="previous">
                <span>←</span>
              </button>
              <button className={styles.homeArrowBtn} onClick={() => move(1)} aria-label="next">
                <span>→</span>
              </button>
            </div>
          </div>

          <div className={styles.home_carousel}>
            {featured.map((item, i) => (
              <button
                key={item.id}
                className={`${styles.home_card} ${styles[getPos(i)]}`}
                onClick={() => setActive(i)}
              >
                {item.image_url ? (
                  <img src={item.image_url} className={styles.home_image} alt={item.summary || "featured"} />
                ) : (
                  <div className={styles.home_imageFallback} />
                )}
              </button>
            ))}
          </div>

          <div className={styles.homeDots}>
            {featured.map((item, i) => (
              <button
                key={item.id}
                className={i === active ? styles.homeDotActive : styles.homeDot}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
        </section>

        <section className={styles.homeBuilderSection}>
          <div className={styles.homeBuilderMain}>
            <div className={styles.homePanel}>
              <div className={styles.homePanelTitle}>主要條件</div>
              <div className={styles.homeSliderGrid}>
                <label className={styles.homeSliderCard}>
                  <span>年齡</span>
                  <input type="range" min="5" max="60" value={age} onChange={(e) => setAge(Number(e.target.value))} />
                  <b>{age}</b>
                </label>
                <label className={styles.homeSliderCard}>
                  <span>身高</span>
                  <input type="range" min="120" max="200" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
                  <b>{height} cm</b>
                </label>
                <label className={styles.homeSliderCard}>
                  <span>體重</span>
                  <input type="range" min="30" max="120" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
                  <b>{weight} kg</b>
                </label>
                <label className={styles.homeSliderCard}>
                  <span>氣溫</span>
                  <input type="range" min="0" max="35" value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
                  <b>{temp}°C</b>
                </label>
              </div>

              <div className={styles.homeSegmentWrap}>
                <div className={styles.homeSegmentRow}>
                  {["女性", "男性", "中性"].map((v) => (
                    <button key={v} className={gender === v ? styles.homePillActive : styles.homePill} onClick={() => setGender(v)}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className={styles.homeSegmentRow}>
                  {["成人", "兒童"].map((v) => (
                    <button key={v} className={audience === v ? styles.homePillActive : styles.homePill} onClick={() => setAudience(v)}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.homePanel}>
              <div className={styles.homePanelTitle}>快速情境</div>
              <div className={styles.homePillRow}>
                {scenes.map((s) => (
                  <button
                    key={s.id}
                    className={scene === s.id && !celeb ? styles.homePillActive : styles.homePill}
                    onClick={() => {
                      setScene(s.id);
                      setCeleb("");
                      setShowCelebs(false);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  className={showCelebs ? styles.homePillActive : styles.homePill}
                  onClick={() => setShowCelebs((v) => !v)}
                >
                  名人靈感
                </button>
              </div>

              {showCelebs ? (
                <div className={styles.homeCelebWrap}>
                  {celebs.map((c) => (
                    <button
                      key={c.id}
                      className={celeb === c.id ? styles.homePillActive : styles.homePill}
                      onClick={() => setCeleb(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <aside className={styles.homeBuilderSide}>
            <div className={styles.homeActionCard}>
              <div className={styles.homeActionKicker}>Ready</div>
              <div className={styles.homeActionTitle}>生成你的下一套穿搭</div>
              <div className={styles.homeActionText}>目前選擇：{selectedLabel || "未選擇"} · {gender} · {audience}</div>
              <button className={styles.home_cta}>✨ 生成穿搭</button>
              <button className={styles.homeSecondaryCta}>查看分享頁</button>
            </div>
          </aside>
        </section>

        <section className={styles.homeBottomSection}>
          <div className={styles.homeSectionHeader}>
            <h3>最近生成</h3>
          </div>
          <div className={styles.home_list}>
            {featured.map((item) => (
              <OutfitCard key={`r-${item.id}`} item={item as any} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />
            ))}
          </div>
        </section>

        <section className={styles.homeBottomSection}>
          <div className={styles.homeSectionHeader}>
            <h3>我的最愛</h3>
          </div>
          <div className={styles.home_list}>
            {featured.map((item) => (
              <OutfitCard key={`f-${item.id}`} item={item as any} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />
            ))}
          </div>
        </section>
      </div>

      {zoomSrc ? (
        <div className={styles.home_modal} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} alt="" />
        </div>
      ) : null}
    </main>
  );
}
