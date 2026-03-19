"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import HeroCarousel from "../components/HeroCarousel";
import OutfitCard, { type OutfitItem } from "../components/OutfitCard";
import { apiGetJson, apiPostJson } from "../lib/apiFetch";

type ImgResp = { ok?: boolean; image_url?: string; image_path?: string; storage_path?: string };
type PresetPayload = { style?: string; palette?: string; styleVariant?: string; id?: string; gender?: string; audience?: string; age?: number | string; height?: number | string; weight?: number | string; temp?: number | string };

const scenes = [{ id: "date", label: "約會" },{ id: "commute", label: "通勤" },{ id: "party", label: "聚會" },{ id: "outdoor", label: "戶外" }];
const celebs = [{ id: "jennie", label: "Jennie" },{ id: "iu", label: "IU" },{ id: "gd", label: "G-Dragon" },{ id: "hailey", label: "Hailey" }];

function Toast({ text }: { text: string }) {
  return <div style={{position:"fixed",right:20,bottom:20,zIndex:1200,background:"rgba(15,18,27,0.95)",color:"#fff",padding:"12px 14px",borderRadius:14,border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 16px 40px rgba(0,0,0,0.35)",maxWidth:360,lineHeight:1.45}}>{text}</div>;
}

export default function Page() {
  const [featured, setFeatured] = useState<OutfitItem[]>([]);
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);
  const [activeHero, setActiveHero] = useState(0);
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
    loadFeatured(); loadFavorites(); loadRecent(); tryApplyPresetFromStorage();
    return () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); };
  }, []);

  function pushToast(text: string) {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }

  async function loadFeatured() {
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=explore&limit=8&sort=like&ts=${Date.now()}`);
      setFeatured(data?.items || []);
    } catch { setFeatured([]); }
  }

  async function loadRecent() {
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=outfits.recent&limit=8&ts=${Date.now()}`);
      setRecent(data?.items || []);
    } catch { setRecent([]); }
  }

  async function loadFavorites() {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem("findoutfit_anon_id", anonId); }
      const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=outfits.favorites&limit=8&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`);
      setFavorites(data?.items || []);
    } catch { setFavorites([]); }
  }

  function isLiked(id: string) {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`liked_outfit_${id}`) === "1";
  }

  async function toggleLike(item: OutfitItem) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem("findoutfit_anon_id", anonId); }
    const alreadyLiked = isLiked(item.id);
    const op = alreadyLiked ? "outfits.unlike" : "outfits.like";
    const r = await fetch(`/api/data?op=${op}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }) });
    const j = await r.json();
    if (!r.ok || !j?.ok) return;
    if (alreadyLiked) localStorage.removeItem(`liked_outfit_${item.id}`); else localStorage.setItem(`liked_outfit_${item.id}`, "1");
    setFeatured((prev) => prev.map((x) => (x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x)));
    setFavorites((prev) => prev.map((x) => (x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x)));
    pushToast(alreadyLiked ? "已取消最愛" : "已加入最愛 ✅");
  }

  async function shareItem(item: OutfitItem) {
    if (!item.share_slug) return;
    const key = `shared_outfit_${item.id}`;
    const alreadyShared = localStorage.getItem(key) === "1";
    if (!alreadyShared) {
      const r = await fetch(`/api/data?op=outfits.share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outfit_id: item.id }) });
      const j = await r.json();
      if (r.ok && j?.ok) {
        localStorage.setItem(key, "1");
        setFeatured((prev) => prev.map((x) => (x.id === item.id ? { ...x, share_count: j.share_count ?? x.share_count } : x)));
      }
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    pushToast(alreadyShared ? "已複製分享連結（本裝置已記錄過分享，不重複計數）" : "已複製分享連結，並記錄分享次數 ✅");
  }

  function normalizeNum(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  function applyPresetPayload(payload: PresetPayload) {
    let partial = false;
    if (payload.gender) setGender(String(payload.gender)); else partial = true;
    if (payload.audience) setAudience(String(payload.audience)); else partial = true;

    const ageVal = normalizeNum(payload.age), heightVal = normalizeNum(payload.height), weightVal = normalizeNum(payload.weight), tempVal = normalizeNum(payload.temp);
    if (ageVal !== undefined) setAge(ageVal); else partial = true;
    if (heightVal !== undefined) setHeight(heightVal); else partial = true;
    if (weightVal !== undefined) setWeight(weightVal); else partial = true;
    if (tempVal !== undefined) setTemp(tempVal); else partial = true;

    const variant = String(payload.styleVariant || payload.id || "");
    const style = String(payload.style || "");
    if (variant.includes("jennie") || variant.includes("iu") || variant.includes("gd") || variant.includes("hailey")) {
      setSelectedCeleb(variant.includes("jennie") ? "jennie" : variant.includes("iu") ? "iu" : variant.includes("gd") ? "gd" : "hailey");
      setShowCelebs(true);
    } else if (variant.includes("date") || style.includes("minimal")) {
      setSelectedScene("date"); setSelectedCeleb(""); setShowCelebs(false);
    } else if (variant.includes("party") || style.includes("street")) {
      setSelectedScene("party"); setSelectedCeleb(""); setShowCelebs(false);
    } else if (variant.includes("outdoor")) {
      setSelectedScene("outdoor"); setSelectedCeleb(""); setShowCelebs(false);
    } else {
      setSelectedScene("commute"); setSelectedCeleb(""); setShowCelebs(false);
    }
    pushToast(partial ? "已套用靈感，部分條件沿用目前設定" : "已完整套用條件 ✅");
  }

  function applyPreset(item: OutfitItem) {
    const anyItem = item as any;
    const echo = anyItem?.style?._echo || anyItem?.style?.echo || anyItem?.spec?._echo || {};
    applyPresetPayload({
      id: item.id, style: anyItem?.style?.style, palette: anyItem?.style?.palette, styleVariant: anyItem?.style?.styleVariant,
      gender: anyItem?.style?.gender || echo.gender, audience: anyItem?.style?.audience || echo.audience,
      age: echo.age, height: echo.height, weight: echo.weight, temp: echo.temp,
    });
  }

  function tryApplyPresetFromStorage() {
    try {
      const raw = localStorage.getItem("findoutfit_apply_preset");
      if (!raw) return;
      const payload = JSON.parse(raw) as PresetPayload;
      applyPresetPayload(payload);
      localStorage.removeItem("findoutfit_apply_preset");
    } catch {}
  }

  const activePreset = useMemo(() => selectedCeleb ? (celebs.find((c) => c.id === selectedCeleb)?.label || "") : (scenes.find((s) => s.id === selectedScene)?.label || ""), [selectedScene, selectedCeleb]);

  async function handleGenerate() {
    try {
      pushToast("正在生成…");
      const promptContext = selectedCeleb ? `名人靈感：${celebs.find((c) => c.id === selectedCeleb)?.label || ""}` : `情境：${scenes.find((s) => s.id === selectedScene)?.label || ""}`;
      const specResp = await apiPostJson<any>("/api/generate-outfit-spec", { age, height, weight, temp, gender, audience, promptContext });
      const specObj = specResp?.spec || specResp;
      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", { age, height, weight, temp, gender, audience, outfitSpec: { items: specObj?.items || [], summary: specObj?.summary || promptContext }, aspectRatio: "3:4", imageSize: "1K" });
      const url = imgResp?.image_url || "";
      const path = imgResp?.image_path || imgResp?.storage_path || "";
      setGeneratedImageUrl(url); setGeneratedSummary(specObj?.summary || promptContext); setStage("generated");
      try {
        const created = await apiPostJson<any>("/api/data?op=outfits.create", {
          image_url: url, image_path: path, is_public: true, spec: specObj,
          style: { style: selectedCeleb ? "celeb-inspired" : selectedScene, palette: "auto", styleVariant: selectedCeleb || selectedScene, gender, audience, _echo: { age, height, weight, temp, gender, audience } },
          summary: specObj?.summary || promptContext, products: null,
        });
        const slug = created?.outfit?.share_slug; if (slug) setGeneratedShareUrl(`${window.location.origin}/share/${slug}`);
      } catch {}
      pushToast("完成 ✅");
      loadFeatured(); loadRecent();
    } catch (e: any) { pushToast(e?.message || "生成失敗"); }
  }

  return (
    <main className={styles.page}>
      <NavBar />
      <section className={styles.contentWrap}>
        <HeroCarousel items={featured} active={activeHero} setActive={setActiveHero} stage={stage} setStage={setStage} generatedImageUrl={generatedImageUrl} generatedShareUrl={generatedShareUrl} generatedSummary={generatedSummary} onOpen={(src) => setZoomSrc(src)} onLike={toggleLike} onShare={shareItem} onApply={applyPreset} isLiked={isLiked} />

        <section className={styles.generatorSection}>
          <div className={styles.sectionHead}>
            <div><div className={styles.kicker}>Builder</div><h2 className={styles.sectionTitle}>穿搭生成器</h2></div>
            <div className={styles.badge}>已選：{activePreset || "未選擇"}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.blockTitle}>主要條件</div>
            <div className={styles.sliderGrid}>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>年齡</span><input type="range" min="5" max="60" value={age} onChange={(e) => setAge(Number(e.target.value))} /><span className={styles.sliderValue}>{age}</span></label>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>身高</span><input type="range" min="120" max="200" value={height} onChange={(e) => setHeight(Number(e.target.value))} /><span className={styles.sliderValue}>{height} cm</span></label>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>體重</span><input type="range" min="30" max="120" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /><span className={styles.sliderValue}>{weight} kg</span></label>
              <label className={styles.sliderCard}><span className={styles.sliderLabel}>氣溫</span><input type="range" min="0" max="35" value={temp} onChange={(e) => setTemp(Number(e.target.value))} /><span className={styles.sliderValue}>{temp}°C</span></label>
            </div>
            <div className={styles.segmentRow}>{["女性","男性","中性"].map((v) => <button key={v} className={gender === v ? styles.activePill : styles.pill} onClick={() => setGender(v)}>{v}</button>)}</div>
            <div className={styles.segmentRow}>{["成人","兒童"].map((v) => <button key={v} className={audience === v ? styles.activePill : styles.pill} onClick={() => setAudience(v)}>{v}</button>)}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.blockTitle}>快速情境</div>
            <div className={styles.pillRow}>
              {scenes.map((scene) => <button key={scene.id} className={selectedScene === scene.id && !selectedCeleb ? styles.activePill : styles.pill} onClick={() => { setSelectedScene(scene.id); setSelectedCeleb(""); setShowCelebs(false); }}>{scene.label}</button>)}
              <button className={showCelebs ? styles.activePill : styles.pill} onClick={() => setShowCelebs((v) => !v)}>名人靈感</button>
            </div>
            {showCelebs ? <div className={styles.celebPanel}>{celebs.map((celeb) => <button key={celeb.id} className={selectedCeleb === celeb.id ? styles.activePill : styles.pill} onClick={() => setSelectedCeleb(celeb.id)}>{celeb.label}</button>)}</div> : null}
          </div>

          <div className={styles.generateRow}>
            <button className={styles.generateBtn} onClick={handleGenerate}>生成穿搭</button>
            {generatedShareUrl ? <a href={generatedShareUrl} className={styles.secondaryBtn}>查看分享頁</a> : null}
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionHead}><div><div className={styles.kicker}>History</div><h2 className={styles.sectionTitle}>最近生成</h2></div></div>
          <div className={styles.smallRow}>{recent.map((item) => <OutfitCard key={item.id} item={item} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />)}</div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionHead}><div><div className={styles.kicker}>Favorites</div><h2 className={styles.sectionTitle}>我的最愛</h2></div></div>
          <div className={styles.smallRow}>{favorites.map((item) => <OutfitCard key={item.id} item={item} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />)}</div>
        </section>
      </section>

      {zoomSrc ? <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}><img src={zoomSrc} alt="" className={styles.modalImg} /></div> : null}
      {toast ? <Toast text={toast} /> : null}
    </main>
  );
}
