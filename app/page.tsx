"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import HeroCarousel from "../components/HeroCarousel";
import OutfitCard, { type OutfitItem } from "../components/OutfitCard";
import { apiGetJson, apiPostJson } from "../lib/apiFetch";

type ImgResp = {
  ok?: boolean;
  image_url?: string;
  image_path?: string;
  storage_path?: string;
};

type ListResp = {
  ok?: boolean;
  items?: OutfitItem[];
};

type PresetPayload = {
  style?: string;
  palette?: string;
  styleVariant?: string;
  id?: string;
  gender?: string;
  audience?: string;
  age?: number | string;
  height?: number | string;
  weight?: number | string;
  temp?: number | string;
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

function Toast({ text }: { text: string }) {
  return <div className={styles.toast}>{text}</div>;
}

export default function Page() {
  const [featured, setFeatured] = useState<OutfitItem[]>([]);
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);
  const [stage, setStage] = useState<"featured" | "generated">("featured");
  const [zoomSrc, setZoomSrc] = useState("");

  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(55);
  const [temp, setTemp] = useState(22);
  const [gender, setGender] = useState("女性");
  const [audience, setAudience] = useState("成人");

  const [selectedScene, setSelectedScene] = useState("date");
  const [selectedCeleb, setSelectedCeleb] = useState("");
  const [showCelebs, setShowCelebs] = useState(false);

  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [generatedShareUrl, setGeneratedShareUrl] = useState("");

  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    loadAll();
    tryApplyPresetFromStorage();
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  async function loadAll() {
    await Promise.all([loadFeatured(), loadRecent(), loadFavorites()]);
  }

  function pushToast(text: string) {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }

  async function loadFeatured() {
    try {
      const data = await apiGetJson<ListResp>(`/api/data?op=explore&limit=8&sort=like&ts=${Date.now()}`);
      setFeatured(data?.items || []);
    } catch {
      setFeatured([]);
    }
  }

  async function loadRecent() {
    try {
      const data = await apiGetJson<ListResp>(`/api/data?op=outfits.recent&limit=12&ts=${Date.now()}`);
      setRecent(data?.items || []);
    } catch {
      setRecent([]);
    }
  }

  async function loadFavorites() {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }
      const data = await apiGetJson<ListResp>(
        `/api/data?op=outfits.favorites&limit=12&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`
      );
      setFavorites(data?.items || []);
    } catch {
      setFavorites([]);
    }
  }

  function isLiked(id: string) {
    return typeof window !== "undefined" && localStorage.getItem(`liked_${id}`) === "1";
  }

  function isShared(id: string) {
    return typeof window !== "undefined" && localStorage.getItem(`shared_${id}`) === "1";
  }

  async function toggleLike(item: OutfitItem) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }

    const liked = isLiked(item.id);
    const op = liked ? "outfits.unlike" : "outfits.like";

    try {
      await fetch(`/api/data?op=${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }),
      });
    } catch {}

    if (liked) {
      localStorage.removeItem(`liked_${item.id}`);
      pushToast("已取消最愛");
    } else {
      localStorage.setItem(`liked_${item.id}`, "1");
      pushToast("已加入最愛");
    }

    setFeatured((prev) => [...prev]);
    setRecent((prev) => [...prev]);
    setFavorites((prev) => [...prev]);
  }

  async function shareItem(item: OutfitItem) {
    const key = `shared_${item.id}`;
    const already = localStorage.getItem(key) === "1";

    try {
      await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
    } catch {}

    localStorage.setItem(key, "1");

    if (item.share_slug) {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    }

    pushToast(already ? "已複製連結" : "已分享並複製連結");
    setFeatured((prev) => [...prev]);
    setRecent((prev) => [...prev]);
  }

  function normalizeGender(v?: string) {
    const s = String(v || "").toLowerCase();
    if (["female", "女", "女性"].includes(s)) return "女性";
    if (["male", "男", "男性"].includes(s)) return "男性";
    return "中性";
  }

  function normalizeAudience(v?: string) {
    const s = String(v || "").toLowerCase();
    if (["adult", "成人"].includes(s)) return "成人";
    if (["child", "兒童"].includes(s)) return "兒童";
    return "成人";
  }

  function applyPresetPayload(payload: PresetPayload) {
    setGender(normalizeGender(payload.gender));
    setAudience(normalizeAudience(payload.audience));

    if (payload.age) setAge(Number(payload.age));
    if (payload.height) setHeight(Number(payload.height));
    if (payload.weight) setWeight(Number(payload.weight));
    if (payload.temp) setTemp(Number(payload.temp));

    pushToast("已套用條件");
  }

  function applyPreset(item: OutfitItem) {
    const anyItem: any = item;
    const echo = anyItem?.style?._echo || anyItem?.style?.echo || anyItem?.spec?._echo || {};

    applyPresetPayload({
      gender: echo.gender || anyItem?.style?.gender,
      audience: echo.audience || anyItem?.style?.audience,
      age: echo.age,
      height: echo.height,
      weight: echo.weight,
      temp: echo.temp,
    });
  }

  function tryApplyPresetFromStorage() {
    const raw = localStorage.getItem("findoutfit_apply_preset");
    if (!raw) return;
    try {
      applyPresetPayload(JSON.parse(raw));
      localStorage.removeItem("findoutfit_apply_preset");
    } catch {}
  }

  async function handleGenerate() {
    try {
      setStage("generated");
      pushToast("生成中...");

      const promptContext = selectedCeleb
        ? `名人靈感：${celebs.find((c) => c.id === selectedCeleb)?.label || ""}`
        : `情境：${scenes.find((s) => s.id === selectedScene)?.label || ""}`;

      const specResp = await apiPostJson<any>("/api/generate-outfit-spec", {
        age,
        height,
        weight,
        temp,
        gender,
        audience,
        promptContext,
      });
      const specObj = specResp?.spec || specResp;

      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", {
        age,
        height,
        weight,
        temp,
        gender,
        audience,
        outfitSpec: {
          items: specObj?.items || [],
          summary: specObj?.summary || promptContext,
        },
        aspectRatio: "3:4",
        imageSize: "1K",
      });

      if (!imgResp?.image_url) throw new Error("圖片生成失敗");

      setGeneratedImageUrl(imgResp.image_url);
      setGeneratedSummary(specObj?.summary || "生成完成");

      try {
        const created = await apiPostJson<any>("/api/data?op=outfits.create", {
          image_url: imgResp.image_url,
          image_path: imgResp.image_path || imgResp.storage_path || null,
          is_public: true,
          spec: specObj,
          style: {
            style: selectedCeleb ? "celeb-inspired" : selectedScene,
            palette: "auto",
            styleVariant: selectedCeleb || selectedScene,
            gender,
            audience,
            _echo: { age, height, weight, temp, gender, audience },
          },
          summary: specObj?.summary || promptContext,
          products: null,
        });
        const slug = created?.outfit?.share_slug || created?.item?.share_slug;
        if (slug) {
          setGeneratedShareUrl(`${window.location.origin}/share/${slug}`);
        }
      } catch {}

      await loadRecent();
      pushToast("完成");
    } catch {
      pushToast("生成失敗");
    }
  }

  const activeLabel = useMemo(() => {
    if (selectedCeleb) return celebs.find((c) => c.id === selectedCeleb)?.label || "";
    return scenes.find((s) => s.id === selectedScene)?.label || "";
  }, [selectedScene, selectedCeleb]);

  return (
    <main className={styles.page}>
      <NavBar />

      <div className={styles.contentWrap}>
        <HeroCarousel
          items={featured}
          generatedItems={recent}
          stage={stage}
          setStage={setStage}
          generatedImageUrl={generatedImageUrl}
          generatedSummary={generatedSummary}
          generatedShareUrl={generatedShareUrl}
          onOpen={(src) => setZoomSrc(src)}
          onLike={toggleLike}
          onShare={shareItem}
          onApply={applyPreset}
          isLiked={isLiked}
          isShared={isShared}
        />
      </div>

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
            <label className={styles.sliderCard}>
              <span className={styles.sliderLabel}>年齡</span>
              <input type="range" min="5" max="60" value={age} onChange={(e) => setAge(Number(e.target.value))} />
              <span className={styles.sliderValue}>{age}</span>
            </label>

            <label className={styles.sliderCard}>
              <span className={styles.sliderLabel}>身高</span>
              <input type="range" min="120" max="200" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
              <span className={styles.sliderValue}>{height} cm</span>
            </label>

            <label className={styles.sliderCard}>
              <span className={styles.sliderLabel}>體重</span>
              <input type="range" min="30" max="120" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
              <span className={styles.sliderValue}>{weight} kg</span>
            </label>

            <label className={styles.sliderCard}>
              <span className={styles.sliderLabel}>氣溫</span>
              <input type="range" min="0" max="35" value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
              <span className={styles.sliderValue}>{temp}°C</span>
            </label>
          </div>

          <div className={styles.segmentRow}>
            {["女性", "男性", "中性"].map((v) => (
              <button key={v} className={gender === v ? styles.activePill : styles.pill} onClick={() => setGender(v)}>
                {v}
              </button>
            ))}
          </div>

          <div className={styles.segmentRow}>
            {["成人", "兒童"].map((v) => (
              <button key={v} className={audience === v ? styles.activePill : styles.pill} onClick={() => setAudience(v)}>
                {v}
              </button>
            ))}
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

            <button className={showCelebs ? styles.activePill : styles.pill} onClick={() => setShowCelebs((v) => !v)}>
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
          <button className={styles.generateBtn} onClick={handleGenerate}>
            生成穿搭
          </button>
          {generatedShareUrl ? (
            <a href={generatedShareUrl} className={styles.secondaryBtn}>
              查看分享頁
            </a>
          ) : null}
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
          {recent.length ? (
            <div className={styles.smallRow}>
              {recent.map((item) => (
                <OutfitCard key={item.id} item={item} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyText}>目前沒有最近生成資料。</div>
          )}
        </div>

        <div className={styles.historyBlock}>
          <div className={styles.historyTitle}>我的最愛</div>
          {favorites.length ? (
            <div className={styles.smallRow}>
              {favorites.map((item) => (
                <OutfitCard key={item.id} item={item} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyText}>目前沒有收藏資料。</div>
          )}
        </div>
      </section>

      {toast ? <Toast text={toast} /> : null}

      {zoomSrc ? (
        <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
          <img src={zoomSrc} alt="" className={styles.modalImg} />
        </div>
      ) : null}
    </main>
  );
}
