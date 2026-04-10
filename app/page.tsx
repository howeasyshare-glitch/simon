"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import HeroCarousel from "../components/HeroCarousel";
import type { OutfitItem } from "../components/OutfitCard";
import { apiGetJson, apiPostJson } from "../lib/apiFetch";
import { getAnonId } from "../lib/user";
import { supabase } from "../lib/supabase/client";

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

type QuickScene = {
  id: string;
  label: string;
  hint: string;
};

const baseCelebs = [
  { id: "jennie", label: "Jennie" },
  { id: "iu", label: "IU" },
  { id: "gd", label: "G-Dragon" },
  { id: "hailey", label: "Hailey" },
];

const quickSceneMap: Record<string, QuickScene[]> = {
  "女性-成人": [
    { id: "date", label: "約會", hint: "柔和、精緻、好感度高" },
    { id: "commute", label: "通勤", hint: "俐落、耐看、可久坐" },
    { id: "party", label: "聚會", hint: "有亮點、適合拍照" },
    { id: "shopping", label: "逛街", hint: "自在、輕鬆、好搭配" },
  ],
  "男性-成人": [
    { id: "commute", label: "通勤", hint: "乾淨、俐落、日常實穿" },
    { id: "date", label: "約會", hint: "成熟、有層次、不用力" },
    { id: "outdoor", label: "戶外", hint: "舒適、防曬、好活動" },
    { id: "coffee", label: "咖啡店", hint: "簡約、有品味、好看不拘束" },
  ],
  "中性-成人": [
    { id: "minimal", label: "極簡日常", hint: "乾淨線條、低彩度" },
    { id: "creative", label: "創意工作", hint: "有態度、保有機能性" },
    { id: "travel", label: "輕旅行", hint: "方便走動、層次分明" },
    { id: "weekend", label: "週末休閒", hint: "放鬆但不隨便" },
  ],
  "女性-兒童": [
    { id: "school", label: "上學", hint: "活潑、舒適、方便活動" },
    { id: "park", label: "公園", hint: "耐髒、輕盈、好奔跑" },
    { id: "birthday", label: "生日會", hint: "可愛、有亮點、好拍" },
    { id: "family", label: "家庭出遊", hint: "溫柔、童趣、好穿脫" },
  ],
  "男性-兒童": [
    { id: "school", label: "上學", hint: "舒適、耐穿、清爽" },
    { id: "outdoor", label: "戶外玩樂", hint: "好動、透氣、機能感" },
    { id: "birthday", label: "生日會", hint: "精神、有重點、不厚重" },
    { id: "family", label: "家庭出遊", hint: "方便活動、易搭配" },
  ],
  "中性-兒童": [
    { id: "school", label: "上學", hint: "乾淨、舒服、好整理" },
    { id: "play", label: "遊戲日", hint: "輕鬆、童趣、可活動" },
    { id: "outing", label: "出門散步", hint: "溫和色系、舒適感" },
    { id: "photo", label: "拍照日", hint: "可愛、有記憶點" },
  ],
};

function Toast({ text }: { text: string }) {
  return <div className={styles.toast}>{text}</div>;
}

function ActivityMiniCard({
  item,
  onOpen,
  onApply,
  onShare,
}: {
  item: OutfitItem;
  onOpen: () => void;
  onApply: () => void;
  onShare: () => void;
}) {
  return (
    <article className={styles.activityCard}>
      <button type="button" className={styles.activityImageBtn} onClick={onOpen}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.summary || "outfit"} className={styles.activityImage} />
        ) : (
          <div className={styles.activityImageFallback} />
        )}
      </button>
      <div className={styles.activityBody}>
        <div className={styles.activityTitleRow}>
          <div className={styles.activityTitle}>{item.style?.style || "Outfit"}</div>
          <button type="button" className={styles.activityChipBtn} onClick={onApply}>
            套用
          </button>
        </div>
        <div className={styles.activityText}>{item.summary || "穿搭靈感"}</div>
        <div className={styles.activityMetaRow}>
          <span>♥ {item.like_count || 0}</span>
          <span>↗ {item.share_count || 0}</span>
          <button type="button" className={styles.activityLinkBtn} onClick={onShare}>
            分享
          </button>
        </div>
      </div>
    </article>
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
    loadAll();
    loadUserSettings();
    tryApplyPresetFromStorage();

    try {
      const raw = localStorage.getItem("findoutfit_settings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.gender) setGender(s.gender);
        if (s.audience) setAudience(s.audience);
      }
    } catch {}

    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const quickScenes = useMemo(() => {
    return quickSceneMap[`${gender}-${audience}`] || quickSceneMap["中性-成人"];
  }, [gender, audience]);

  useEffect(() => {
    if (!quickScenes.some((scene) => scene.id === selectedScene)) {
      setSelectedScene(quickScenes[0]?.id || "date");
      setSelectedCeleb("");
      setShowCelebs(false);
    }
  }, [quickScenes, selectedScene]);

  async function loadAll() {
    await Promise.all([loadFeatured(), loadRecent(), loadFavorites()]);
  }

  async function loadUserSettings() {
    try {
      const data = await apiGetJson<any>(`/api/data?op=user.settings.get&ts=${Date.now()}`);
      const item = data?.item;
      if (!item) return;

      if (item.gender) setGender(item.gender);
      if (item.audience) setAudience(item.audience);

      if (item.system) {
        localStorage.setItem("findoutfit_system", JSON.stringify(item.system));
      }
    } catch {}
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let url = `/api/data?op=outfits.favorites&limit=12&ts=${Date.now()}`;
      if (!session?.access_token) {
        const anonId = getAnonId();
        url += `&anon_id=${encodeURIComponent(anonId)}`;
      }

      const data = await apiGetJson<ListResp>(url);
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const liked = isLiked(item.id);
    const op = liked ? "outfits.unlike" : "outfits.like";

    try {
      await apiPostJson(`/api/data?op=${op}`, {
        outfit_id: item.id,
        ...(session?.access_token ? {} : { anon_id: getAnonId() }),
      });
    } catch {}

    if (liked) {
      localStorage.removeItem(`liked_${item.id}`);
      pushToast("已取消最愛");
    } else {
      localStorage.setItem(`liked_${item.id}`, "1");
      pushToast("已加入最愛");
    }

    await loadFavorites();
    await loadFeatured();
    await loadRecent();
  }

  async function shareItem(item: OutfitItem) {
    const key = `shared_${item.id}`;
    const already = localStorage.getItem(key) === "1";

    try {
      await apiPostJson(`/api/data?op=outfits.share`, {
        outfit_id: item.id,
      });
    } catch {}

    localStorage.setItem(key, "1");

    if (item.share_slug) {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    }

    pushToast(already ? "已複製連結" : "已分享並複製連結");
    await loadFeatured();
    await loadRecent();
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
    let system = {
      temperature: 0.7,
      creativity: 0.5,
      withBag: false,
    };

    try {
      const raw = localStorage.getItem("findoutfit_system");
      if (raw) system = JSON.parse(raw);
    } catch {}

    try {
      setStage("generated");
      pushToast("生成中...");

      const safeScene = selectedScene || "date";
      const safeGender = normalizeGender(gender);
      const safeAudience = normalizeAudience(audience);
      const sceneLabel =
        selectedCeleb
          ? baseCelebs.find((c) => c.id === selectedCeleb)?.label || "名人靈感"
          : quickScenes.find((s) => s.id === selectedScene)?.label || "日常穿搭";
      const promptContext = selectedCeleb ? `celeb:${selectedCeleb}` : `scene:${safeScene}`;

      const specResp = await apiPostJson<any>("/api/generate-outfit-spec", {
        payload: {
          age,
          height,
          weight,
          temp,
          gender: safeGender,
          audience: safeAudience,
          styleVariant: selectedCeleb || safeScene,
          style: selectedCeleb ? "celeb-inspired" : "scene",
          palette: "auto",
          withBag: system.withBag,
          promptContext: `${promptContext} | style:${system.temperature} creativity:${system.creativity}`,
        },
      });
      const specObj = specResp?.spec || specResp;

      const safeItems = Array.isArray(specObj?.items) ? specObj.items : [];
      if (!safeItems.length) throw new Error("outfitSpec items empty");

      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", {
        payload: {
          age,
          height,
          weight,
          temp,
          gender: safeGender,
          audience: safeAudience,
          styleVariant: selectedCeleb || safeScene,
          style: selectedCeleb ? "celeb-inspired" : "scene",
          palette: "auto",
          withBag: system.withBag,
          outfitSpec: {
            items: safeItems,
            summary: specObj?.summary || promptContext,
          },
          aspectRatio: "3:4",
          imageSize: "1K",
        },
      });

      if (!imgResp?.image_url) throw new Error("圖片生成失敗");

      setGeneratedImageUrl(imgResp.image_url);
      setGeneratedSummary(
        `${sceneLabel} · 風格 ${system.temperature} · 創意 ${system.creativity} · 包包 ${
          system.withBag ? "開啟" : "關閉"
        }`
      );

      let resolvedProducts: any[] = [];

      try {
        const productsResp = await apiPostJson<any>("/api/data?op=products", {
          items: safeItems.map((x: any) => {
            const rawLabel =
              x.description ||
              x.label ||
              x.name ||
              x.item ||
              x.title ||
              x.slot ||
              "單品";

            const label = `${rawLabel} ${sceneLabel}`.trim();

            return {
              slot: x.slot || x.category || x.type || "",
              label,
            };
          }),
          limitPerSlot: 3,
        });

        resolvedProducts = Array.isArray(productsResp?.products)
          ? productsResp.products
          : [];
      } catch {}

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
          products: resolvedProducts,
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
    if (selectedCeleb) return baseCelebs.find((c) => c.id === selectedCeleb)?.label || "";
    return quickScenes.find((s) => s.id === selectedScene)?.label || "";
  }, [selectedScene, selectedCeleb, quickScenes]);

  const activeSceneHint = useMemo(() => {
    if (selectedCeleb) return "以名人穿搭氣質為靈感，自動轉成適合你條件的版本。";
    return quickScenes.find((s) => s.id === selectedScene)?.hint || "";
  }, [selectedScene, selectedCeleb, quickScenes]);

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
          mode="home"
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

        <div className={styles.generatorShell}>
          <aside className={styles.generatorLeadCard}>
            <div className={styles.generatorBadge}>AI Powered Outfit</div>

            <div className={styles.generatorLeadTop}>
              <div>
                <div className={styles.blockTitle}>本次設定</div>
                <div className={styles.generatorLeadValue}>{gender} · {audience}</div>
              </div>
              <div className={styles.generatorTempBadge}>{temp}°C</div>
            </div>

            <div className={styles.generatorHintText}>{activeSceneHint || "先選情境，再用條件微調會更準。"}</div>

            <div className={styles.generatorStats}>
              <div className={styles.generatorStat}>
                <span className={styles.generatorStatLabel}>年齡</span>
                <strong>{age}</strong>
              </div>
              <div className={styles.generatorStat}>
                <span className={styles.generatorStatLabel}>身高</span>
                <strong>{height} cm</strong>
              </div>
              <div className={styles.generatorStat}>
                <span className={styles.generatorStatLabel}>體重</span>
                <strong>{weight} kg</strong>
              </div>
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
          </aside>

          <div className={styles.generatorMain}>
            <div className={styles.card}>
              <div className={styles.blockTitle}>基本輪廓</div>
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

              <div className={styles.sliderGrid}>
                <label className={styles.sliderCard}>
                  <span className={styles.sliderTop}><span className={styles.sliderLabel}>年齡</span><span className={styles.sliderValue}>{age}</span></span>
                  <input type="range" min="5" max="60" value={age} onChange={(e) => setAge(Number(e.target.value))} />
                </label>

                <label className={styles.sliderCard}>
                  <span className={styles.sliderTop}><span className={styles.sliderLabel}>身高</span><span className={styles.sliderValue}>{height} cm</span></span>
                  <input type="range" min="120" max="200" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
                </label>

                <label className={styles.sliderCard}>
                  <span className={styles.sliderTop}><span className={styles.sliderLabel}>體重</span><span className={styles.sliderValue}>{weight} kg</span></span>
                  <input type="range" min="30" max="120" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
                </label>

                <label className={styles.sliderCard}>
                  <span className={styles.sliderTop}><span className={styles.sliderLabel}>氣溫</span><span className={styles.sliderValue}>{temp}°C</span></span>
                  <input type="range" min="0" max="35" value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
                </label>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.generatorSceneHead}>
                <div>
                  <div className={styles.blockTitle}>快速情境</div>
                  <div className={styles.generatorSceneSub}>依照性別與成人 / 兒童自動切換更合理的情境選項。</div>
                </div>
                <button className={showCelebs ? styles.activePill : styles.pill} onClick={() => setShowCelebs((v) => !v)}>
                  名人靈感
                </button>
              </div>

              {!showCelebs ? (
                <div className={styles.sceneGrid}>
                  {quickScenes.map((scene) => (
                    <button
                      key={scene.id}
                      className={selectedScene === scene.id && !selectedCeleb ? styles.sceneCardActive : styles.sceneCard}
                      onClick={() => {
                        setSelectedScene(scene.id);
                        setSelectedCeleb("");
                      }}
                    >
                      <span className={styles.sceneCardTitle}>{scene.label}</span>
                      <span className={styles.sceneCardHint}>{scene.hint}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.celebGrid}>
                  {baseCelebs.map((celeb) => (
                    <button
                      key={celeb.id}
                      className={selectedCeleb === celeb.id ? styles.sceneCardActive : styles.sceneCard}
                      onClick={() => setSelectedCeleb(celeb.id)}
                    >
                      <span className={styles.sceneCardTitle}>{celeb.label}</span>
                      <span className={styles.sceneCardHint}>用其風格輪廓轉化成你的版本</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.historySection}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>Activity</div>
            <h2 className={styles.sectionTitle}>最近活動</h2>
          </div>
        </div>

        <div className={styles.activityGrid}>
          <div className={styles.historyBlock}>
            <div className={styles.historyTitleRow}>
              <div className={styles.historyTitle}>最近生成</div>
              <div className={styles.historyCount}>{recent.length} 筆</div>
            </div>
            {recent.length ? (
              <div className={styles.activityList}>
                {recent.slice(0, 4).map((item) => (
                  <ActivityMiniCard
                    key={item.id}
                    item={item}
                    onOpen={() => item.image_url && setZoomSrc(item.image_url)}
                    onApply={() => applyPreset(item)}
                    onShare={() => shareItem(item)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyText}>目前沒有最近生成資料。</div>
            )}
          </div>

          <div className={styles.historyBlock}>
            <div className={styles.historyTitleRow}>
              <div className={styles.historyTitle}>我的最愛預覽</div>
              <div className={styles.historyCount}>{favorites.length} 筆</div>
            </div>
            {favorites.length ? (
              <div className={styles.activityList}>
                {favorites.slice(0, 4).map((item) => (
                  <ActivityMiniCard
                    key={item.id}
                    item={item}
                    onOpen={() => item.image_url && setZoomSrc(item.image_url)}
                    onApply={() => applyPreset(item)}
                    onShare={() => shareItem(item)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyText}>目前沒有收藏資料。</div>
            )}
          </div>
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
