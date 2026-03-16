
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import HeroCarousel from "../components/HeroCarousel";
import OutfitCard, { type OutfitCardItem } from "../components/OutfitCard";
import { apiGetJson, apiPostJson } from "../lib/apiFetch";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Gender = "male" | "female" | "neutral";
type Audience = "adult" | "child";

type OutfitRow = OutfitCardItem & { is_public?: boolean };

type ImgResp = {
  ok?: boolean;
  image_url?: string;
  image_path?: string;
  storage_path?: string;
};

const SCENES: Record<Audience, Record<Gender, Array<{ id: string; title: string; style: string; palette: string; styleVariant?: string }>>> = {
  adult: {
    female: [
      { id: "scene-date", title: "約會", style: "minimal", palette: "cream-warm", styleVariant: "scene-date" },
      { id: "scene-commute", title: "通勤", style: "smart", palette: "mono-dark", styleVariant: "scene-commute" },
      { id: "scene-party", title: "聚會", style: "street", palette: "bright", styleVariant: "scene-party" },
      { id: "scene-weekend", title: "週末", style: "casual", palette: "mono-light", styleVariant: "scene-weekend" },
    ],
    male: [
      { id: "scene-commute", title: "通勤", style: "casual", palette: "mono-dark", styleVariant: "scene-commute" },
      { id: "scene-outdoor", title: "戶外", style: "casual", palette: "earth", styleVariant: "scene-outdoor" },
      { id: "scene-party", title: "聚會", style: "street", palette: "denim", styleVariant: "scene-party" },
      { id: "scene-weekend", title: "週末", style: "sporty", palette: "bright", styleVariant: "scene-weekend" },
    ],
    neutral: [
      { id: "scene-minimal", title: "極簡", style: "minimal", palette: "mono-light", styleVariant: "scene-minimal" },
      { id: "scene-street", title: "街頭", style: "street", palette: "denim", styleVariant: "scene-street" },
      { id: "scene-sport", title: "運動", style: "sporty", palette: "bright", styleVariant: "scene-sport" },
      { id: "scene-commute", title: "通勤", style: "smart", palette: "mono-dark", styleVariant: "scene-commute" },
    ],
  },
  child: {
    female: [
      { id: "kid-school", title: "校園", style: "casual", palette: "bright", styleVariant: "kid-school" },
      { id: "kid-party", title: "聚會", style: "smart", palette: "cream-warm", styleVariant: "kid-party" },
    ],
    male: [
      { id: "kid-school", title: "校園", style: "casual", palette: "bright", styleVariant: "kid-school" },
      { id: "kid-sport", title: "運動", style: "sporty", palette: "bright", styleVariant: "kid-sport" },
    ],
    neutral: [
      { id: "kid-school", title: "校園", style: "casual", palette: "bright", styleVariant: "kid-school" },
      { id: "kid-sport", title: "運動", style: "sporty", palette: "bright", styleVariant: "kid-sport" },
    ],
  },
};

const CELEBS: Record<Gender, Array<{ id: string; title: string; style: string; palette: string; styleVariant?: string }>> = {
  female: [
    { id: "celeb-jennie", title: "Jennie", style: "minimal", palette: "mono-dark", styleVariant: "celeb-jennie" },
    { id: "celeb-iu", title: "IU", style: "casual", palette: "cream-warm", styleVariant: "celeb-iu" },
    { id: "celeb-hailey", title: "Hailey", style: "smart", palette: "mono-light", styleVariant: "celeb-hailey" },
  ],
  male: [
    { id: "celeb-gd", title: "G-Dragon", style: "street", palette: "denim", styleVariant: "celeb-gd" },
    { id: "celeb-jk", title: "Jungkook", style: "casual", palette: "mono-dark", styleVariant: "celeb-jk" },
    { id: "celeb-v", title: "V", style: "smart", palette: "mono-dark", styleVariant: "celeb-v" },
  ],
  neutral: [
    { id: "celeb-jennie", title: "Jennie", style: "minimal", palette: "mono-dark", styleVariant: "celeb-jennie" },
    { id: "celeb-gd", title: "G-Dragon", style: "street", palette: "denim", styleVariant: "celeb-gd" },
    { id: "celeb-iu", title: "IU", style: "casual", palette: "cream-warm", styleVariant: "celeb-iu" },
  ],
};

function likedKey(outfitId: string) {
  return `liked_outfit_${outfitId}`;
}
function sharedKey(outfitId: string) {
  return `shared_outfit_${outfitId}`;
}

export default function Page() {
  const [featured, setFeatured] = useState<OutfitRow[]>([]);
  const [recent, setRecent] = useState<OutfitRow[]>([]);
  const [favorites, setFavorites] = useState<OutfitRow[]>([]);
  const [status, setStatus] = useState("");

  const [gender, setGender] = useState<Gender>("female");
  const [audience, setAudience] = useState<Audience>("adult");
  const [style, setStyle] = useState("casual");
  const [palette, setPalette] = useState("mono-dark");
  const [styleVariant, setStyleVariant] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(55);
  const [temp, setTemp] = useState(22);
  const [withBag, setWithBag] = useState(false);
  const [withHat, setWithHat] = useState(false);
  const [withCoat, setWithCoat] = useState(false);

  const [imageUrl, setImageUrl] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [zoomSrc, setZoomSrc] = useState("");

  const scenes = useMemo(() => SCENES[audience][gender] || [], [audience, gender]);
  const celebs = useMemo(() => CELEBS[gender] || [], [gender]);

  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadFeatured();
    loadFavorites();
    loadRecent();
    tryApplyPresetFromStorage();
  }, []);

  async function loadFeatured() {
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>(`/api/data?op=explore&limit=10&sort=like&ts=${Date.now()}`);
      setFeatured(data?.items || []);
    } catch {
      setFeatured([]);
    }
  }

  async function loadFavorites() {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }
      const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>(`/api/data?op=outfits.favorites&limit=6&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`);
      setFavorites(data?.items || []);
    } catch {
      setFavorites([]);
    }
  }

  async function loadRecent() {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/data?op=outfits.recent&limit=6&ts=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await r.json();
      if (r.ok && j?.ok) setRecent(j.items || []);
    } catch {}
  }

  function isLiked(id: string) {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(likedKey(id)) === "1";
  }

  function applyPreset(preset: { id?: string; style: string; palette: string; styleVariant?: string }) {
    setStyle(preset.style);
    setPalette(preset.palette);
    setStyleVariant(preset.styleVariant || "");
    setSelectedPresetId(preset.id || preset.styleVariant || "");
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function tryApplyPresetFromStorage() {
    try {
      const raw = localStorage.getItem("findoutfit_apply_preset");
      if (!raw) return;
      const preset = JSON.parse(raw);
      applyPreset({
        id: preset.id || preset.styleVariant || "",
        style: preset.style,
        palette: preset.palette,
        styleVariant: preset.styleVariant,
      });
      localStorage.removeItem("findoutfit_apply_preset");
      setStatus("已套用靈感 ✅");
    } catch {}
  }

  async function toggleLike(item: OutfitRow) {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }

    const alreadyLiked = isLiked(item.id);
    const op = alreadyLiked ? "outfits.unlike" : "outfits.like";
    const r = await fetch(`/api/data?op=${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }),
    });
    const j = await r.json();
    if (!r.ok || !j?.ok) return;

    if (alreadyLiked) localStorage.removeItem(likedKey(item.id));
    else localStorage.setItem(likedKey(item.id), "1");

    setFeatured((prev) => prev.map((x) => (x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x)));
    setFavorites((prev) => prev.map((x) => (x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x)));
    setStatus(alreadyLiked ? "已取消最愛" : "已加入最愛 ✅");
  }

  async function shareItem(item: OutfitRow) {
    if (!item.share_slug) return;
    const key = sharedKey(item.id);
    if (localStorage.getItem(key) !== "1") {
      const r = await fetch(`/api/data?op=outfits.share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfit_id: item.id }),
      });
      const j = await r.json();
      if (r.ok && j?.ok) {
        localStorage.setItem(key, "1");
        setFeatured((prev) => prev.map((x) => (x.id === item.id ? { ...x, share_count: j.share_count ?? x.share_count } : x)));
      }
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    setStatus("已複製分享連結 ✅");
  }

  async function generate() {
    try {
      setStatus("正在生成…");
      const specResp = await apiPostJson<any>("/api/generate-outfit-spec", {
        gender, age, height, weight, style, styleVariant: styleVariant || undefined, temp, withBag, withHat, withCoat,
      });
      const specObj = specResp?.spec || specResp;

      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", {
        gender, age, height, weight, style, styleVariant: styleVariant || undefined, temp, withBag, withHat, withCoat,
        outfitSpec: { items: specObj?.items || [], summary: specObj?.summary || "" },
        aspectRatio: "3:4",
        imageSize: "1K",
      });

      const url = imgResp?.image_url || "";
      const path = imgResp?.image_path || imgResp?.storage_path || "";
      setImageUrl(url);
      setGeneratedSummary(specObj?.summary || "");

      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch(`/api/data?op=outfits.create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          image_url: url,
          image_path: path,
          is_public: true,
          spec: specObj,
          style: { style, palette, styleVariant, audience, gender },
          summary: specObj?.summary || "",
          products: null,
        }),
      });
      const created = await r.json();
      const slug = created?.outfit?.share_slug || created?.item?.share_slug;
      if (slug) setShareUrl(`${window.location.origin}/share/${slug}`);

      setStatus("完成 ✅");
      loadFeatured();
      loadRecent();
    } catch (e: any) {
      setStatus(e?.message || "生成失敗");
    }
  }

  return (
    <div className={styles.pageShell}>
      <NavBar />
      <div className={styles.pageWrap}>
        <HeroCarousel
          featured={featured}
          generatedImageUrl={imageUrl}
          generatedShareUrl={shareUrl}
          generatedSummary={generatedSummary}
          onLike={toggleLike}
          onShare={shareItem}
          onApply={(item) => applyPreset({
            id: item.id,
            style: item.style?.style || "casual",
            palette: item.style?.palette || "mono-dark",
            styleVariant: item.style?.styleVariant || "",
          })}
          onOpen={(src) => setZoomSrc(src || "")}
          isLiked={isLiked}
        />

        {!!status ? <div className={styles.pageStatus}>{status}</div> : null}

        <section ref={formRef} className={styles.builderSection}>
          <div className={styles.builderHeader}>
            <div>
              <div className={styles.sectionKicker}>穿搭生成器</div>
              <h2 className={styles.pageTitle}>選擇靈感，再微調條件</h2>
            </div>
          </div>

          <div className={styles.builderGrid}>
            <div className={styles.builderMain}>
              <div>
                <div className={styles.blockTitle}>快速情境</div>
                <div className={styles.presetGrid} style={{ marginTop: 10 }}>
                  {scenes.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      className={`${styles.presetBtn} ${selectedPresetId === scene.id ? styles.presetBtnActive : ""}`}
                      onClick={() => applyPreset({ id: scene.id, style: scene.style, palette: scene.palette, styleVariant: scene.styleVariant })}
                    >
                      <div className={styles.presetTitle}>{scene.title}</div>
                      <div className={styles.presetSub}>{scene.style} · {scene.palette}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className={styles.blockTitle}>名人靈感</div>
                <div className={styles.presetGrid} style={{ marginTop: 10 }}>
                  {celebs.map((celeb) => (
                    <button
                      key={celeb.id}
                      type="button"
                      className={`${styles.presetBtn} ${selectedPresetId === celeb.id ? styles.presetBtnActive : ""}`}
                      onClick={() => applyPreset({ id: celeb.id, style: celeb.style, palette: celeb.palette, styleVariant: celeb.styleVariant })}
                    >
                      <div className={styles.presetTitle}>{celeb.title}</div>
                      <div className={styles.presetSub}>{celeb.style} · {celeb.palette}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formCardGrid}>
                <label className={styles.fieldCard}>
                  <span className={styles.fieldLabel}>風格</span>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className={styles.select}>
                    <option value="casual">casual</option>
                    <option value="minimal">minimal</option>
                    <option value="street">street</option>
                    <option value="sporty">sporty</option>
                    <option value="smart">smart</option>
                  </select>
                </label>

                <label className={styles.fieldCard}>
                  <span className={styles.fieldLabel}>配色</span>
                  <select value={palette} onChange={(e) => setPalette(e.target.value)} className={styles.select}>
                    <option value="mono-dark">mono-dark</option>
                    <option value="mono-light">mono-light</option>
                    <option value="earth">earth</option>
                    <option value="bright">bright</option>
                    <option value="cream-warm">cream-warm</option>
                    <option value="denim">denim</option>
                  </select>
                </label>

                <label className={styles.fieldCard}>
                  <span className={styles.fieldLabel}>性別</span>
                  <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={styles.select}>
                    <option value="female">female</option>
                    <option value="male">male</option>
                    <option value="neutral">neutral</option>
                  </select>
                </label>

                <label className={styles.fieldCard}>
                  <span className={styles.fieldLabel}>對象</span>
                  <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className={styles.select}>
                    <option value="adult">adult</option>
                    <option value="child">child</option>
                  </select>
                </label>
              </div>

              <div className={styles.sliderGrid}>
                <label className={styles.sliderCard}>
                  <span className={styles.fieldLabel}>年齡</span>
                  <input type="range" min="5" max="60" value={age} onChange={(e) => setAge(parseInt(e.target.value, 10) || 0)} />
                  <span className={styles.sliderValue}>{age}</span>
                </label>

                <label className={styles.sliderCard}>
                  <span className={styles.fieldLabel}>身高</span>
                  <input type="range" min="120" max="200" value={height} onChange={(e) => setHeight(parseInt(e.target.value, 10) || 0)} />
                  <span className={styles.sliderValue}>{height} cm</span>
                </label>

                <label className={styles.sliderCard}>
                  <span className={styles.fieldLabel}>體重</span>
                  <input type="range" min="30" max="120" value={weight} onChange={(e) => setWeight(parseInt(e.target.value, 10) || 0)} />
                  <span className={styles.sliderValue}>{weight} kg</span>
                </label>

                <label className={styles.sliderCard}>
                  <span className={styles.fieldLabel}>氣溫</span>
                  <input type="range" min="0" max="35" value={temp} onChange={(e) => setTemp(parseInt(e.target.value, 10) || 0)} />
                  <span className={styles.sliderValue}>{temp}°C</span>
                </label>
              </div>

              <div className={styles.toggleRow}>
                <label className={styles.toggleChip}><input type="checkbox" checked={withBag} onChange={(e) => setWithBag(e.target.checked)} /><span>包包</span></label>
                <label className={styles.toggleChip}><input type="checkbox" checked={withHat} onChange={(e) => setWithHat(e.target.checked)} /><span>帽子</span></label>
                <label className={styles.toggleChip}><input type="checkbox" checked={withCoat} onChange={(e) => setWithCoat(e.target.checked)} /><span>外套</span></label>
              </div>
            </div>

            <aside className={styles.sideCard}>
              <div className={styles.sideTitle}>目前條件</div>
              <div className={styles.cardText}>
                style = <b>{style}</b><br />
                palette = <b>{palette}</b><br />
                styleVariant = <b>{styleVariant || "none"}</b>
              </div>
              <div className={styles.sideActionStack}>
                <button type="button" className={styles.actionBtnPrimary} onClick={generate}>立即生成</button>
                {shareUrl ? <a href={shareUrl} className={styles.actionLink}>開啟分享頁</a> : null}
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.bottomSection}>
          <div className={styles.listPageHeader}>
            <div>
              <div className={styles.sectionKicker}>最近與收藏</div>
              <h2 className={styles.pageTitle}>最近生成 / 我的最愛</h2>
            </div>
          </div>

          <div className={styles.bottomTwoCol}>
            <div>
              <div className={styles.subSectionTitle}>最近生成</div>
              <div className={styles.smallGrid}>
                {recent.map((item) => <OutfitCard key={item.id} item={item} compact onOpen={(src) => setZoomSrc(src || "")} />)}
              </div>
            </div>
            <div>
              <div className={styles.subSectionTitle}>我的最愛</div>
              <div className={styles.smallGrid}>
                {favorites.map((item) => <OutfitCard key={item.id} item={item} compact onOpen={(src) => setZoomSrc(src || "")} />)}
              </div>
            </div>
          </div>
        </section>

        {zoomSrc ? (
          <div className={styles.modalBackdrop} onClick={() => setZoomSrc("")}>
            <img src={zoomSrc} alt="" className={styles.modalImg} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
