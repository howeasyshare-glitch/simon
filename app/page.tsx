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
  return (
    <div className={styles.toast}>
      {text}
    </div>
  );
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
    loadFeatured();
    loadFavorites();
    loadRecent();
    tryApplyPresetFromStorage();
  }, []);

  function pushToast(text: string) {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2500);
  }

  async function loadFeatured() {
    const data = await apiGetJson(`/api/data?op=explore&limit=8&sort=like`);
    setFeatured(data?.items || []);
  }

  async function loadRecent() {
    const data = await apiGetJson(`/api/data?op=outfits.recent&limit=8`);
    setRecent(data?.items || []);
  }

  async function loadFavorites() {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }

    const data = await apiGetJson(
      `/api/data?op=outfits.favorites&limit=8&anon_id=${anonId}`
    );

    setFavorites(data?.items || []);
  }

  function isLiked(id: string) {
    return localStorage.getItem(`liked_${id}`) === "1";
  }

  function isShared(id: string) {
    return localStorage.getItem(`shared_${id}`) === "1";
  }

  async function toggleLike(item: OutfitItem) {
    const liked = isLiked(item.id);

    if (liked) {
      localStorage.removeItem(`liked_${item.id}`);
      pushToast("已取消最愛");
    } else {
      localStorage.setItem(`liked_${item.id}`, "1");
      pushToast("已加入最愛");
    }

    setFeatured([...featured]);
  }

  async function shareItem(item: OutfitItem) {
    const key = `shared_${item.id}`;
    const already = localStorage.getItem(key) === "1";

    localStorage.setItem(key, "1");

    await navigator.clipboard.writeText(
      `${window.location.origin}/share/${item.share_slug}`
    );

    pushToast(already ? "已複製連結" : "已分享並複製連結");
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
    const echo = anyItem?.style?._echo || {};

    applyPresetPayload({
      gender: echo.gender,
      audience: echo.audience,
      age: echo.age,
      height: echo.height,
      weight: echo.weight,
      temp: echo.temp,
    });
  }

  function tryApplyPresetFromStorage() {
    const raw = localStorage.getItem("findoutfit_apply_preset");
    if (!raw) return;
    applyPresetPayload(JSON.parse(raw));
    localStorage.removeItem("findoutfit_apply_preset");
  }

  async function handleGenerate() {
    try {
      setStage("generated");
      pushToast("生成中...");

      const imgResp = await apiPostJson<ImgResp>(
        "/api/generate-image",
        { age, height, weight, temp, gender, audience }
      );

      if (!imgResp?.image_url) throw new Error();

      setGeneratedImageUrl(imgResp.image_url);
      pushToast("完成");
    } catch {
      pushToast("生成失敗");
    }
  }

  return (
    <main className={styles.page}>
      <NavBar />

      <HeroCarousel
        items={featured}
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

      <section className={styles.generator}>
        <button className={styles.generateBtn} onClick={handleGenerate}>
          生成穿搭
        </button>
      </section>

      {toast && <Toast text={toast} />}
    </main>
  );
}
