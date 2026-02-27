"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { apiGetJson, apiPostJson } from "../lib/apiFetch";

type MeResp =
  | { ok: true; user?: { id: string; email?: string }; credits_left?: number; is_tester?: boolean }
  | { ok?: false; error?: string };

type ExploreItem = {
  id: string;
  created_at?: string;
  share_slug?: string;
  image_url?: string;
  summary?: any;
  style?: any;
  like_count?: number;
};

type SpecResp = { error?: string; detail?: any; summary?: string; items?: any[] };
type ImgResp = { error?: string; detail?: any; image?: string; mime?: string };

type Gender = "male" | "female" | "neutral";
type AgeGroup = "adult" | "child";

const STYLE_OPTIONS = [
  { id: "casual", label: "休閒" },
  { id: "minimal", label: "極簡" },
  { id: "street", label: "街頭" },
  { id: "sporty", label: "運動" },
  { id: "smart", label: "Smart Casual" },
] as const;

const PALETTES = [
  { id: "mono-dark", label: "黑灰" },
  { id: "mono-light", label: "白灰" },
  { id: "earth", label: "大地" },
  { id: "denim", label: "丹寧" },
  { id: "cream-warm", label: "奶油暖" },
  { id: "bright", label: "明亮" },
] as const;

// === 模擬 index.html 的資料結構（你之後可用 index.html 真資料覆蓋） ===
const STYLE_SOURCES = {
  scene: {
    optionsByAgeGroup: {
      adult: ["休閒", "上班 / 通勤", "約會", "運動", "旅行", "正式場合"],
      kids: ["日常 / 上學", "戶外玩樂", "運動 / 體育課", "聚會 / 生日", "旅行", "正式場合"],
    } as const,
    mapToPayload: (val: string) => {
      const m: Record<string, { style: string; styleVariant: string }> = {
        "休閒": { style: "casual", styleVariant: "" },
        "上班 / 通勤": { style: "smart", styleVariant: "" },
        "約會": { style: "minimal", styleVariant: "" },
        "運動": { style: "sporty", styleVariant: "" },
        "旅行": { style: "casual", styleVariant: "" },
        "正式場合": { style: "smart", styleVariant: "" },

        "日常 / 上學": { style: "casual", styleVariant: "" },
        "戶外玩樂": { style: "casual", styleVariant: "" },
        "運動 / 體育課": { style: "sporty", styleVariant: "" },
        "聚會 / 生日": { style: "street", styleVariant: "" },
      };
      return m[val] || { style: "casual", styleVariant: "" };
    },
  },
  celebrity: {
    optionsByGender: {
      male: ["GD", "BTS", "V", "Jungkook"],
      female: ["Lisa", "IU", "Jennie", "Karina"],
      neutralPool: ["GD", "BTS", "V", "Jungkook", "Lisa", "IU", "Jennie", "Karina"],
    } as const,
    mapToPayload: (val: string) => {
      const m: Record<string, { style: string; styleVariant: string }> = {
        GD: { style: "street", styleVariant: "celeb-gd-street" },
        BTS: { style: "street", styleVariant: "celeb-bts-street" },
        Lisa: { style: "sporty", styleVariant: "celeb-lisa-sporty" },
        IU: { style: "casual", styleVariant: "celeb-iu-casual" },
        Jennie: { style: "minimal", styleVariant: "celeb-jennie-minimal" },
        Karina: { style: "smart", styleVariant: "celeb-karina-smart" },
      };
      return m[val] || { style: "casual", styleVariant: "" };
    },
  },
};

function stableRandomPick<T>(arr: T[], k: number, seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;

  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(k, a.length));
}

export default function Home() {
  // ✅ 真正登入狀態以 supabase session 為準（不再被 /api/me 401 牽連）
  const [session, setSession] = useState<any>(null);
  const isAuthed = !!session?.access_token;

  // 額外 user info（點數、email...），拿不到也不影響登入 UI
  const [me, setMe] = useState<MeResp | null>(null);

  // Explore
  const [explore, setExplore] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [exploreError, setExploreError] = useState("");

  // Header UI
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  // Form
  const [gender, setGender] = useState<Gender>("female");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("adult");

  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(55);
  const [temp, setTemp] = useState(22);

  const [styleId, setStyleId] = useState("smart");
  const [paletteId, setPaletteId] = useState("mono-dark");
  const [styleVariant, setStyleVariant] = useState("");

  const [withBag, setWithBag] = useState(false);
  const [withHat, setWithHat] = useState(false);
  const [withCoat, setWithCoat] = useState(false);

  // ✅ 防止多選：用「卡片值」當選取狀態
  const [selectedScene, setSelectedScene] = useState<string>("");
  const [selectedCeleb, setSelectedCeleb] = useState<string>("");

  // Flow
  const [status, setStatus] = useState("");
  const [spec, setSpec] = useState<any>(null);
  const [previewSrc, setPreviewSrc] = useState("");

  const generatorRef = useRef<HTMLElement | null>(null);

  // ranges
  const ranges = useMemo(() => {
    if (ageGroup === "child") {
      return {
        age: { min: 4, max: 16, step: 1 },
        height: { min: 95, max: 170, step: 1 },
        weight: { min: 12, max: 70, step: 1 },
        temp: { min: 0, max: 35, step: 1 },
      };
    }
    return {
      age: { min: 18, max: 60, step: 1 },
      height: { min: 145, max: 195, step: 1 },
      weight: { min: 40, max: 110, step: 1 },
      temp: { min: 0, max: 35, step: 1 },
    };
  }, [ageGroup]);

  const sceneOptions = useMemo(() => {
    const key = ageGroup === "child" ? "kids" : "adult";
    return STYLE_SOURCES.scene.optionsByAgeGroup[key].slice();
  }, [ageGroup]);

  const celebOptions = useMemo(() => {
    if (gender === "male") return STYLE_SOURCES.celebrity.optionsByGender.male.slice();
    if (gender === "female") return STYLE_SOURCES.celebrity.optionsByGender.female.slice();
    const seed = session?.user?.id || "anon-neutral";
    return stableRandomPick(STYLE_SOURCES.celebrity.optionsByGender.neutralPool, 4, seed);
  }, [gender, session]);

  // ✅ 送 API body
  const apiBody = useMemo(() => {
    return {
      gender,
      age,
      height,
      weight,
      style: styleId,
      styleVariant: styleVariant || undefined,
      temp,
      withBag,
      withHat,
      withCoat,

      // front-only
      ageGroup,
      paletteId,
    };
  }, [gender, age, height, weight, styleId, styleVariant, temp, withBag, withHat, withCoat, ageGroup, paletteId]);

  // ✅ 初始化：同步 session + 監聽狀態變化
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (!mounted) return;
        setSession(data.session || null);
      } catch {
        // ignore
      }
    })();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_evt, s) => {
      setSession(s || null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ✅ /api/me：自己帶 Bearer（不依賴 apiFetch，直接排除 Missing bearer token）
  async function refreshMe() {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        setMe({ ok: false, error: "no_session_token" });
        return;
      }

      const r = await fetch("/api/me?ts=" + Date.now(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await r.text();
      let j: any = null;
      try {
        j = JSON.parse(text);
      } catch {}

      if (!r.ok) {
        // ⚠️ 拿不到 me 也不代表未登入，僅代表 credits/email 讀不到
        setMe({ ok: false, error: j?.error || text || `HTTP ${r.status}` });
        return;
      }

      setMe(j);
    } catch (e: any) {
      setMe({ ok: false, error: e?.message || "me fetch failed" });
    }
  }

  useEffect(() => {
    if (isAuthed) refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  async function refreshExplore() {
    setLoadingExplore(true);
    setExploreError("");
    try {
      const tries = [
        "/api/explore?limit=10&sort=like&ts=" + Date.now(),
        "/api/explore?limit=10&ts=" + Date.now(),
        "/api/explore?limit=5&sort=like&ts=" + Date.now(),
      ];
      let lastErr: any = null;

      for (const url of tries) {
        try {
          const data = await apiGetJson<any>(url);
          const items = data?.items || data?.data?.items || data?.result?.items || [];
          if (Array.isArray(items)) {
            setExplore(items);
            setLoadingExplore(false);
            return;
          }
        } catch (e) {
          lastErr = e;
        }
      }

      setExplore([]);
      setExploreError(lastErr?.message || "Explore 載入失敗");
    } finally {
      setLoadingExplore(false);
    }
  }

  useEffect(() => {
    refreshExplore();
  }, []);

  // Close menus on outside click / Esc
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      if (userMenuOpen) {
        const wrap = avatarWrapRef.current;
        if (wrap && !wrap.contains(t)) setUserMenuOpen(false);
      }

      if (mobileMenuOpen) {
        const header = document.querySelector(`.${styles.header}`);
        if (header && !header.contains(t)) setMobileMenuOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen, mobileMenuOpen]);

  async function handleGoogleLogin() {
    setStatus("");
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: any) {
      setStatus("登入失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    setMe({ ok: false, error: "signed out" });
    setSession(null);
    setStatus("已登出");
    setUserMenuOpen(false);
  }

  function scrollToGenerator() {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function trackExploreAction(action: "like" | "share" | "apply", id: string, meta?: any) {
    try {
      await apiPostJson("/api/explore", { action, id, meta });
    } catch {
      // ignore
    }
  }

  async function handleLike(it: ExploreItem) {
    setExplore((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, like_count: (Number(x.like_count || 0) + 1) as any } : x))
    );
    await trackExploreAction("like", it.id);
  }

  async function handleShare(it: ExploreItem) {
    const url = it.share_slug ? `${window.location.origin}/share/${it.share_slug}` : `${window.location.origin}/explore`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("已複製分享連結 ✅");
    } catch {
      setStatus("無法自動複製，請手動複製：" + url);
    }
    await trackExploreAction("share", it.id, { url });
  }

  function applyStyleToForm(it: ExploreItem) {
    const s = it?.style || {};
    const p = s?.payload || s;

    if (p?.gender === "male" || p?.gender === "female" || p?.gender === "neutral") setGender(p.gender);
    if (p?.ageGroup === "adult" || p?.ageGroup === "child") setAgeGroup(p.ageGroup);

    if (Number.isFinite(Number(p?.age))) setAge(Number(p.age));
    if (Number.isFinite(Number(p?.height))) setHeight(Number(p.height));
    if (Number.isFinite(Number(p?.weight))) setWeight(Number(p.weight));
    if (Number.isFinite(Number(p?.temp))) setTemp(Number(p.temp));

    if (typeof p?.style === "string") setStyleId(p.style);
    if (typeof p?.paletteId === "string") setPaletteId(p.paletteId);
    if (typeof p?.styleVariant === "string") setStyleVariant(p.styleVariant);

    setWithBag(!!p?.withBag);
    setWithHat(!!p?.withHat);
    setWithCoat(!!p?.withCoat);

    setSelectedScene("");
    setSelectedCeleb("");

    setStatus("已套用這套穿搭的條件 ✅");
    scrollToGenerator();
    trackExploreAction("apply", it.id, { style: it.style });
  }

  function pickScene(val: string) {
    setSelectedScene(val);
    setSelectedCeleb("");
    const out = STYLE_SOURCES.scene.mapToPayload(val);
    setStyleId(out.style);
    setStyleVariant(out.styleVariant);
    setStatus(`已選：穿搭情境 / ${val} ✅`);
  }

  function pickCeleb(val: string) {
    setSelectedCeleb(val);
    setSelectedScene("");
    const out = STYLE_SOURCES.celebrity.mapToPayload(val);
    setStyleId(out.style);
    setStyleVariant(out.styleVariant);
    setStatus(`已選：名人靈感 / ${val} ✅`);
  }

  async function handleGenerate() {
    if (!isAuthed) {
      setStatus("請先登入後才能生成。");
      return;
    }

    setStatus("正在分析條件…");
    setSpec(null);
    setPreviewSrc("");

    try {
      const specResp = await apiPostJson<SpecResp>("/api/generate-outfit-spec", apiBody);
      if (!specResp || (specResp as any).error) throw new Error((specResp as any)?.error || "SPEC failed");

      const s = {
        summary: (specResp as any).summary || "",
        items: Array.isArray((specResp as any).items) ? (specResp as any).items : [],
      };
      setSpec({ ...specResp, ...s });

      setStatus("正在生成穿搭圖…");
      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", { ...apiBody, outfitSpec: s });
      if (!imgResp || (imgResp as any).error) throw new Error((imgResp as any)?.error || "IMAGE failed");

      const b64 = (imgResp as any).image || "";
      const mime = (imgResp as any).mime || "image/png";
      if (!b64) throw new Error("No image returned");

      setPreviewSrc(`data:${mime};base64,${b64}`);
      setStatus("完成 ✅");
    } catch (e: any) {
      setStatus("生成失敗：" + (e?.message || "Unknown error"));
    }
  }

  const shoppingGroups = useMemo(() => {
    const items: any[] = Array.isArray(spec?.items) ? spec.items : [];
    const groups: Record<string, any[]> = {};
    for (const it of items) {
      const slot = (it?.slot || "item").toString();
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(it);
    }
    return groups;
  }, [spec]);

  function buildShopUrl(item: any) {
    const name = (item?.generic_name || item?.name || "").toString().trim();
    const color = (item?.color || "").toString().trim();
    const q = encodeURIComponent([color, name].filter(Boolean).join(" "));
    return `https://www.google.com/search?tbm=shop&q=${q}`;
  }

  const email = (me as any)?.user?.email || session?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>

        <div className={styles.headerRight}>
          <nav className={styles.nav}>
            <a className={styles.navLink} href="/explore">
              Explore
            </a>
            <a className={styles.navLink} href="/my">
              我的穿搭
            </a>
            <a className={styles.navLink} href="/settings">
              設定
            </a>
          </nav>

          <button className={styles.iconBtn} onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Open menu">
            <span className={styles.burger} />
          </button>

          {isAuthed ? (
            <div className={styles.avatarWrap} ref={avatarWrapRef}>
              <button className={styles.avatarBtn} onClick={() => setUserMenuOpen((v) => !v)} aria-label="User menu">
                <span className={styles.avatarCircle}>{avatarLetter}</span>
              </button>

              {userMenuOpen && (
                <div className={styles.userMenu}>
                  <div className={styles.userMenuTop}>
                    <div className={styles.userEmail}>{email || "已登入"}</div>
                    <div className={styles.userMeta}>點數：{credits}</div>
                  </div>

                  <a className={styles.userItem} href="/my" onClick={() => setUserMenuOpen(false)}>
                    我的穿搭
                  </a>
                  <a className={styles.userItem} href="/settings" onClick={() => setUserMenuOpen(false)}>
                    設定
                  </a>
                  <button className={styles.userItemBtn} onClick={handleLogout}>
                    登出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.authBox}>
              <div className={styles.authHint}>未登入：可看 Explore，但不能生成</div>
              <button className={styles.primaryBtn} onClick={handleGoogleLogin}>
                Google 登入
              </button>
            </div>
          )}
        </div>

        {mobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <a className={styles.mobileItem} href="/explore" onClick={() => setMobileMenuOpen(false)}>
              Explore
            </a>
            <a className={styles.mobileItem} href="/my" onClick={() => setMobileMenuOpen(false)}>
              我的穿搭
            </a>
            <a className={styles.mobileItem} href="/settings" onClick={() => setMobileMenuOpen(false)}>
              設定
            </a>

            <div className={styles.mobileDivider} />

            {isAuthed ? (
              <button className={styles.mobileItemBtn} onClick={handleLogout}>
                登出
              </button>
            ) : (
              <button
                className={styles.mobilePrimaryBtn}
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleGoogleLogin();
                }}
              >
                Google 登入
              </button>
            )}
          </div>
        )}
      </header>

      {/* ===== 公開穿搭精選 ===== */}
      <section className={styles.hero} style={{ gridTemplateColumns: "1fr", paddingTop: 12, paddingBottom: 8, gap: 10 }}>
        <div className={styles.heroLeft} style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 className={styles.h1} style={{ fontSize: 22, margin: 0 }}>
                公開穿搭精選
              </h1>
              <p className={styles.p} style={{ margin: "6px 0 0" }}>
                喜歡 / 分享 / 套用風格（套用會把所有屬性帶入）
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className={styles.secondaryBtn} onClick={refreshExplore}>
                重新載入
              </button>
              <button className={styles.primaryBtn} onClick={scrollToGenerator}>
                開始生成
              </button>
            </div>
          </div>

          {!!status && <div className={styles.status}>{status}</div>}
          {!!exploreError && (
            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,120,120,0.95)" }}>
              Explore 載入失敗：{exploreError}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {loadingExplore ? (
              <div className={styles.muted}>載入中…</div>
            ) : explore.length ? (
              <div className={styles.exploreGrid} style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                {explore.map((it) => (
                  <div key={it.id} className={styles.exploreCard} style={{ display: "flex", flexDirection: "column" }}>
                    <a href={it.share_slug ? `/share/${it.share_slug}` : "/explore"} style={{ textDecoration: "none", color: "inherit" }}>
                      <div className={styles.exploreThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                      </div>
                      <div className={styles.exploreMeta}>
                        <div className={styles.exploreTitle}>{it.summary?.title || "公開穿搭"}</div>
                        <div className={styles.exploreSub}>{it.style?.style || it.style?.styleId || "—"}</div>
                      </div>
                    </a>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 8, padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <button className={styles.secondaryBtn as any} onClick={() => handleLike(it)} style={{ width: "100%" }}>
                        喜歡{typeof it.like_count === "number" ? ` · ${it.like_count}` : ""}
                      </button>
                      <button className={styles.secondaryBtn as any} onClick={() => handleShare(it)} style={{ width: "100%" }}>
                        分享
                      </button>
                      <button className={styles.primaryBtn as any} onClick={() => applyStyleToForm(it)} style={{ width: "100%" }}>
                        套用風格
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.muted} style={{ marginTop: 8 }}>
                目前沒有資料
              </div>
            )}
          </div>
        </div>
      </section>

      <main className={styles.mainGrid} style={{ paddingTop: 8 }}>
        {/* ===== 左：條件 ===== */}
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>穿搭條件</div>

          {/* 性別 */}
          <div style={{ marginBottom: 12 }}>
            <div className={styles.label} style={{ marginBottom: 8 }}>
              性別
            </div>
            <div className={styles.segmentedRow}>
              <button className={`${styles.segBtn} ${gender === "female" ? styles.segOn : ""}`} onClick={() => setGender("female")}>
                女
              </button>
              <button className={`${styles.segBtn} ${gender === "male" ? styles.segOn : ""}`} onClick={() => setGender("male")}>
                男
              </button>
              <button className={`${styles.segBtn} ${gender === "neutral" ? styles.segOn : ""}`} onClick={() => setGender("neutral")}>
                中性
              </button>
            </div>
          </div>

          {/* 類別 */}
          <div style={{ marginBottom: 12 }}>
            <div className={styles.label} style={{ marginBottom: 8 }}>
              類別
            </div>
            <div className={styles.segmentedRow}>
              <button className={`${styles.segBtn} ${ageGroup === "adult" ? styles.segOn : ""}`} onClick={() => setAgeGroup("adult")}>
                成人
              </button>
              <button className={`${styles.segBtn} ${ageGroup === "child" ? styles.segOn : ""}`} onClick={() => setAgeGroup("child")}>
                兒童
              </button>
            </div>
          </div>

          {/* sliders */}
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <div className={styles.label}>年齡：{age}</div>
              <input className={styles.range} type="range" min={ranges.age.min} max={ranges.age.max} step={ranges.age.step} value={age} onChange={(e) => setAge(parseInt(e.target.value, 10))} />
            </div>

            <div className={styles.field}>
              <div className={styles.label}>身高（cm）：{height}</div>
              <input className={styles.range} type="range" min={ranges.height.min} max={ranges.height.max} step={ranges.height.step} value={height} onChange={(e) => setHeight(parseInt(e.target.value, 10))} />
            </div>

            <div className={styles.field}>
              <div className={styles.label}>體重（kg）：{weight}</div>
              <input className={styles.range} type="range" min={ranges.weight.min} max={ranges.weight.max} step={ranges.weight.step} value={weight} onChange={(e) => setWeight(parseInt(e.target.value, 10))} />
            </div>

            <div className={styles.field}>
              <div className={styles.label}>氣溫（°C）：{temp}</div>
              <input className={styles.range} type="range" min={ranges.temp.min} max={ranges.temp.max} step={ranges.temp.step} value={temp} onChange={(e) => setTemp(parseInt(e.target.value, 10))} />
            </div>
          </div>

          {/* 情境 */}
          <div style={{ marginTop: 14 }}>
            <div className={styles.label} style={{ marginBottom: 10 }}>
              穿搭情境
            </div>
            <div className={styles.presetGrid}>
              {sceneOptions.map((v) => {
                const mapped = STYLE_SOURCES.scene.mapToPayload(v);
                const active = selectedScene === v;
                return (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.presetCard} ${active ? styles.presetCardActive : ""}`}
                    onClick={() => pickScene(v)}
                  >
                    <div className={styles.presetTitle}>{v}</div>
                    <div className={styles.presetSub}>{mapped.style}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 名人 */}
          <div style={{ marginTop: 14 }}>
            <div className={styles.label} style={{ marginBottom: 10 }}>
              名人靈感（風格靈感，不模仿臉）
            </div>
            <div className={styles.presetGrid}>
              {celebOptions.map((v) => {
                const mapped = STYLE_SOURCES.celebrity.mapToPayload(v);
                const active = selectedCeleb === v;
                return (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.presetCard} ${active ? styles.presetCardActive : ""}`}
                    onClick={() => pickCeleb(v)}
                  >
                    <div className={styles.presetTitle}>{v}</div>
                    <div className={styles.presetSub}>
                      {mapped.style}
                      {mapped.styleVariant ? ` · ${mapped.styleVariant}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 風格 / 配色 / 變體 */}
          <div className={styles.formGrid} style={{ marginTop: 14 }}>
            <label className={styles.field}>
              <div className={styles.label}>風格</div>
              <select className={styles.select} value={styleId} onChange={(e) => setStyleId(e.target.value)}>
                {STYLE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>配色</div>
              <select className={styles.select} value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
                {PALETTES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <div className={styles.label}>風格變體（品牌 / 名人）</div>
              <input className={styles.input} value={styleVariant} onChange={(e) => setStyleVariant(e.target.value)} />
              <div className={styles.smallHint}>（通常由上面情境/名人卡自動帶入）</div>
            </label>
          </div>

          <div className={styles.toggles} style={{ marginTop: 12 }}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={withBag} onChange={(e) => setWithBag(e.target.checked)} />
              <span>加包包</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={withHat} onChange={(e) => setWithHat(e.target.checked)} />
              <span>加帽子</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={withCoat} onChange={(e) => setWithCoat(e.target.checked)} />
              <span>加外套</span>
            </label>
          </div>

          <div className={styles.stickyAction}>
            <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>
              立即生成
            </button>
            {!isAuthed && <div className={styles.smallHint}>未登入無法生成，請先 Google 登入</div>}
          </div>
        </section>

        {/* ===== 右：預覽 + 購買 ===== */}
        <section className={styles.panel} style={{ position: "sticky", top: 76, alignSelf: "start" }}>
          <div className={styles.panelTitle}>預覽</div>

          <div className={styles.previewBox} style={{ borderRadius: 14, overflow: "hidden" }}>
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.previewImg} src={previewSrc} alt="outfit preview" />
            ) : (
              <div className={styles.previewEmpty}>
                <div className={styles.previewEmptyTitle}>還沒有生成圖</div>
                <div className={styles.previewEmptyDesc}>完成左側條件後，按「立即生成」</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
            <b>狀態：</b> {status || "—"}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>購買路徑</div>
            {!spec?.items?.length ? (
              <div className={styles.muted}>生成後會顯示分類購買連結</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(shoppingGroups).map(([slot, items]) => (
                  <div key={slot} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{slot}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(items as any[]).map((it, idx) => {
                        const label = `${it?.color ? it.color + " " : ""}${it?.generic_name || it?.name || "item"}`;
                        return (
                          <a
                            key={idx}
                            className={styles.userItem}
                            href={buildShopUrl(it)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.08)",
                              background: "rgba(0,0,0,0.18)",
                            }}
                          >
                            {label} → 搜尋購買
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
