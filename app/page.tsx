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

type SpecResp = { ok?: boolean; spec?: any; error?: string; detail?: any };
type ImgResp = { ok?: boolean; image_base64?: string; image_url?: string; error?: string; detail?: any };

type Gender = "male" | "female" | "neutral";
type AgeGroup = "adult" | "child";

const STYLE_OPTIONS = [
  { id: "street", label: "街頭" },
  { id: "casual", label: "休閒" },
  { id: "minimal", label: "極簡" },
  { id: "formal", label: "正式" },
] as const;

const PALETTES = [
  { id: "mono-dark", label: "黑灰" },
  { id: "mono-light", label: "白灰" },
  { id: "earth", label: "大地" },
  { id: "denim", label: "丹寧" },
] as const;

// ===== 情境/名人（你之後可用 index.html 真資料替換這兩個）=====
const SCENES: Record<AgeGroup, string[]> = {
  adult: ["休閒", "通勤", "約會", "運動", "旅行", "正式場合"],
  child: ["上學", "戶外玩樂", "運動", "聚會", "旅行", "正式場合"],
};

const CELEBS: Record<Gender, readonly string[]> = {
  male: ["GD", "BTS", "V", "Jungkook"],
  female: ["Lisa", "IU", "Jennie", "Karina"],
  neutral: ["GD", "BTS", "V", "Jungkook", "Lisa", "IU", "Jennie", "Karina"] as const,
};

function stableRandomPick<T>(arr: readonly T[], k: number, seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;

  const a = [...arr];
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
  // ✅ session 為登入真相（不被 /api/me 影響）
  const [session, setSession] = useState<any>(null);
  const isAuthed = !!session?.access_token;

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

  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  const [styleId, setStyleId] = useState<string>("street");
  const [paletteId, setPaletteId] = useState<string>("mono-dark");

  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // 情境/名人：單選（避免多選 bug）
  const [selectedScene, setSelectedScene] = useState<string>("");
  const [selectedCeleb, setSelectedCeleb] = useState<string>("");

  // Flow
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");

  // Preview zoom
  const [zoomOpen, setZoomOpen] = useState(false);

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

  const sceneOptions = useMemo(() => SCENES[ageGroup], [ageGroup]);

  const celebOptions = useMemo(() => {
    if (gender === "male") return CELEBS.male.slice();
    if (gender === "female") return CELEBS.female.slice();
    const seed = session?.user?.id || "anon-neutral";
    return stableRandomPick(CELEBS.neutral, 4, seed);
  }, [gender, session]);

  const payload = useMemo(() => {
    // ✅ 保留你原本後端常用欄位命名（styleId/paletteId/withBag...）
    // ✅ 並額外帶入 ageGroup / scene / celeb（index.html 內容你之後可替換）
    return {
      gender,
      ageGroup,
      age,
      height,
      weight,
      temp,
      styleId,
      paletteId,
      withBag,
      withHat,
      withCoat,
      scene: selectedScene || undefined,
      celebrity: selectedCeleb || undefined,
    };
  }, [gender, ageGroup, age, height, weight, temp, styleId, paletteId, withBag, withHat, withCoat, selectedScene, selectedCeleb]);

  // ===== auth/session init =====
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

  // ✅ /api/me：自己帶 Bearer（不再 Missing bearer token）
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
        // ⚠️ 拿不到 me 不等於未登入，只代表 credits/email 讀不到
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

  // ===== explore =====
  async function refreshExplore() {
    setLoadingExplore(true);
    setExploreError("");
    try {
      const data = await apiGetJson<{ ok?: boolean; items?: ExploreItem[] }>("/api/explore?limit=10&sort=like&ts=" + Date.now());
      setExplore(data?.items || []);
    } catch (e: any) {
      setExplore([]);
      setExploreError(e?.message || "Explore 載入失敗");
    } finally {
      setLoadingExplore(false);
    }
  }

  useEffect(() => {
    refreshExplore();
  }, []);

  async function trackExploreAction(action: "like" | "share" | "apply", id: string, meta?: any) {
    try {
      await apiPostJson("/api/explore", { action, id, meta });
    } catch {
      // ignore
    }
  }

  async function handleLike(it: ExploreItem) {
    setExplore((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, like_count: Number(x.like_count || 0) + 1 } : x))
    );
    await trackExploreAction("like", it.id);
  }

  async function handleShareExplore(it: ExploreItem) {
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

    if (typeof p?.styleId === "string") setStyleId(p.styleId);
    if (typeof p?.paletteId === "string") setPaletteId(p.paletteId);

    setWithBag(!!p?.withBag);
    setWithHat(!!p?.withHat);
    setWithCoat(!!p?.withCoat);

    setSelectedScene("");
    setSelectedCeleb("");
    setStatus("已套用這套穿搭的條件 ✅");

    trackExploreAction("apply", it.id, { style: it.style });

    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ===== menus close =====
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
        setZoomOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen, mobileMenuOpen]);

  // ===== auth actions =====
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

  // ===== scenario/celeb (single select) =====
  function pickScene(val: string) {
    setSelectedScene(val);
    setSelectedCeleb("");
    setStatus(`已選：穿搭情境 / ${val} ✅`);

    // 如果你想情境自動影響 styleId，可在這裡加 mapping
    // 目前不強行覆蓋 styleId，避免和既有後端邏輯衝突
  }

  function pickCeleb(val: string) {
    setSelectedCeleb(val);
    setSelectedScene("");
    setStatus(`已選：名人靈感 / ${val} ✅`);
    // 同上：不強行改 styleId，避免破壞既有生成邏輯
  }

  // ===== generate =====
  async function handleGenerate() {
    if (!isAuthed) {
      setStatus("請先登入後才能生成。");
      return;
    }

    setStatus("正在分析條件…");
    setSpec(null);
    setImageUrl("");
    setImageBase64("");

    try {
      // ✅ 保留你原本後端 contract：{ payload }
      const specResp = await apiPostJson<SpecResp>("/api/generate-outfit-spec", { payload });
      if (!specResp || specResp.ok === false) throw new Error(specResp?.error || "SPEC failed");
      const s = (specResp as any).spec ?? specResp;
      setSpec(s);

      setStatus("正在生成穿搭圖…");
      // ✅ 保留你原本後端 contract：{ payload, spec }
      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", { payload, spec: s });
      if (!imgResp || imgResp.ok === false) throw new Error(imgResp?.error || "IMAGE failed");

      const b64 = (imgResp as any).image_base64 || "";
      const url = (imgResp as any).image_url || "";
      if (url) setImageUrl(url);
      if (b64) setImageBase64(b64);

      setStatus("完成 ✅");
    } catch (e: any) {
      setStatus("生成失敗：" + (e?.message || "Unknown error"));
    }
  }

  const previewSrc = useMemo(() => {
    if (imageUrl) return imageUrl;
    if (imageBase64) return imageBase64; // 若後端回的是完整 dataurl，OK；若只回 base64，你後端先前已處理成 dataurl 也 OK
    return "";
  }, [imageUrl, imageBase64]);

  // ===== share/download (after generate) =====
  async function handleShareImage() {
    if (!previewSrc) return;

    try {
      const anyNav: any = navigator as any;
      if (anyNav.share && previewSrc.startsWith("data:")) {
        const res = await fetch(previewSrc);
        const blob = await res.blob();
        const file = new File([blob], "findoutfit.png", { type: blob.type || "image/png" });
        await anyNav.share({ title: "findoutfit", files: [file] });
        setStatus("已開啟分享 ✅");
        return;
      }
    } catch {
      // ignore
    }

    try {
      await navigator.clipboard.writeText(previewSrc);
      setStatus("已複製分享資料 ✅");
    } catch {
      setStatus("無法自動分享，請使用下載後分享");
    }
  }

  function handleDownloadImage() {
    if (!previewSrc) return;
    const a = document.createElement("a");
    a.href = previewSrc;
    a.download = "findoutfit.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus("已下載 ✅");
  }

  // ===== shop links =====
  const shoppingGroups = useMemo(() => {
    const items: any[] = Array.isArray(spec?.items) ? spec.items : Array.isArray(spec?.outfit?.items) ? spec.outfit.items : [];
    const groups: Record<string, any[]> = {};
    for (const it of items) {
      const slot = (it?.slot || it?.category || "item").toString();
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(it);
    }
    return groups;
  }, [spec]);

  function buildShopUrl(item: any) {
    const direct =
      item?.buy_url ||
      item?.product_url ||
      item?.url ||
      item?.affiliate_url ||
      item?.market_url;

    if (typeof direct === "string" && direct.startsWith("http")) return direct;

    const name = (item?.generic_name || item?.name || item?.title || "").toString().trim();
    const color = (item?.color || "").toString().trim();
    const q = encodeURIComponent([color, name].filter(Boolean).join(" "));
    return `https://www.google.com/search?tbm=shop&q=${q}`;
  }

  const email = (me as any)?.user?.email || session?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  return (
    <div className={styles.page}>
      {/* ===== Header ===== */}
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>

        <nav className={styles.nav}>
          <a className={styles.navLink} href="/explore">Explore</a>
          <a className={styles.navLink} href="/my">我的穿搭</a>
          <a className={styles.navLink} href="/settings">設定</a>
        </nav>

        <div className={styles.headerRight}>
          <button
            className={styles.iconBtn}
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open menu"
          >
            <span className={styles.burger} />
          </button>

          {isAuthed ? (
            <div className={styles.avatarWrap} ref={avatarWrapRef}>
              <button
                className={styles.avatarBtn}
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-label="User menu"
              >
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

      {/* ===== Showcase (Explore) ===== */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroTopRow}>
            <div>
              <h1 className={styles.h1}>公開穿搭精選</h1>
              <p className={styles.p}>你可以喜歡、分享、或套用這套風格到下方條件。</p>
            </div>
            <div className={styles.heroActions}>
              <button className={styles.secondaryBtn} onClick={refreshExplore}>
                重新載入
              </button>
              <button className={styles.primaryBtn} onClick={scrollToGenerator}>
                開始生成
              </button>
            </div>
          </div>

          {!!status && <div className={styles.status}>{status}</div>}
          {!!exploreError && <div className={styles.errorHint}>Explore 載入失敗：{exploreError}</div>}

          {loadingExplore ? (
            <div className={styles.muted}>載入中…</div>
          ) : explore.length ? (
            <div className={styles.exploreGridHero}>
              {explore.map((it) => (
                <div key={it.id} className={styles.exploreCardHero}>
                  <a
                    className={styles.exploreTopLink}
                    href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}
                  >
                    <div className={styles.exploreThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                    </div>
                    <div className={styles.exploreMeta}>
                      <div className={styles.exploreTitle}>{it.summary?.title || (it.share_slug ? "查看分享" : "查看")}</div>
                      <div className={styles.exploreSub}>{it.style?.styleId || it.style?.id || it.style?.style || "—"}</div>
                    </div>
                  </a>

                  <div className={styles.exploreActionsRow}>
                    <button className={styles.smallBtn} onClick={() => handleLike(it)}>
                      喜歡{typeof it.like_count === "number" ? ` · ${it.like_count}` : ""}
                    </button>
                    <button className={styles.smallBtn} onClick={() => handleShareExplore(it)}>
                      分享
                    </button>
                    <button className={styles.smallBtnPrimary} onClick={() => applyStyleToForm(it)}>
                      套用風格
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.muted}>目前沒有資料</div>
          )}
        </div>
      </section>

      {/* ===== Main ===== */}
      <main className={styles.mainGrid}>
        {/* Left: Conditions */}
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>穿搭條件</div>

          <div className={styles.block}>
            <div className={styles.labelRow}>
              <div className={styles.label}>性別</div>
            </div>
            <div className={styles.segmentedRow}>
              <button className={`${styles.segBtn} ${gender === "male" ? styles.segOn : ""}`} onClick={() => setGender("male")}>
                男
              </button>
              <button className={`${styles.segBtn} ${gender === "female" ? styles.segOn : ""}`} onClick={() => setGender("female")}>
                女
              </button>
              <button className={`${styles.segBtn} ${gender === "neutral" ? styles.segOn : ""}`} onClick={() => setGender("neutral")}>
                中性
              </button>
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.labelRow}>
              <div className={styles.label}>類別</div>
            </div>
            <div className={styles.segmentedRow2}>
              <button className={`${styles.segBtn} ${ageGroup === "adult" ? styles.segOn : ""}`} onClick={() => setAgeGroup("adult")}>
                成人
              </button>
              <button className={`${styles.segBtn} ${ageGroup === "child" ? styles.segOn : ""}`} onClick={() => setAgeGroup("child")}>
                兒童
              </button>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <div className={styles.label}>年齡：{age}</div>
              <input
                className={styles.range}
                type="range"
                min={ranges.age.min}
                max={ranges.age.max}
                step={ranges.age.step}
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10))}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.label}>身高（cm）：{height}</div>
              <input
                className={styles.range}
                type="range"
                min={ranges.height.min}
                max={ranges.height.max}
                step={ranges.height.step}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value, 10))}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.label}>體重（kg）：{weight}</div>
              <input
                className={styles.range}
                type="range"
                min={ranges.weight.min}
                max={ranges.weight.max}
                step={ranges.weight.step}
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value, 10))}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.label}>溫度（°C）：{temp}</div>
              <input
                className={styles.range}
                type="range"
                min={ranges.temp.min}
                max={ranges.temp.max}
                step={ranges.temp.step}
                value={temp}
                onChange={(e) => setTemp(parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.labelRow}>
              <div className={styles.label}>穿搭情境</div>
              <div className={styles.hint}>（單選）</div>
            </div>
            <div className={styles.presetGrid}>
              {sceneOptions.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.presetCard} ${selectedScene === v ? styles.presetCardActive : ""}`}
                  onClick={() => pickScene(v)}
                >
                  <div className={styles.presetTitle}>{v}</div>
                  <div className={styles.presetSub}>按下套用</div>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.labelRow}>
              <div className={styles.label}>名人靈感</div>
              <div className={styles.hint}>（依性別變化、單選）</div>
            </div>
            <div className={styles.presetGrid}>
              {celebOptions.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.presetCard} ${selectedCeleb === v ? styles.presetCardActive : ""}`}
                  onClick={() => pickCeleb(v)}
                >
                  <div className={styles.presetTitle}>{v}</div>
                  <div className={styles.presetSub}>按下套用</div>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGrid} style={{ marginTop: 10 }}>
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
          </div>

          <div className={styles.toggles}>
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

        {/* Right: Preview + Share + Shop */}
        <section className={styles.panelRight}>
          <div className={styles.panelTitle}>預覽</div>

          <div
            className={`${styles.previewBox} ${previewSrc ? styles.previewClickable : ""}`}
            onClick={() => previewSrc && setZoomOpen(true)}
            title={previewSrc ? "點擊放大" : ""}
          >
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

          <div className={styles.statusRow}>
            <div className={styles.k}>狀態</div>
            <div className={styles.v}>{status || "—"}</div>
          </div>

          {previewSrc && (
            <div className={styles.shareRow}>
              <button className={styles.primaryBtn} onClick={handleShareImage}>
                分享
              </button>
              <button className={styles.secondaryBtn} onClick={handleDownloadImage}>
                下載
              </button>
            </div>
          )}

          <div className={styles.panelTitle} style={{ marginTop: 16 }}>
            購買路徑
          </div>

          {Object.keys(shoppingGroups).length ? (
            <div className={styles.shopList}>
              {Object.entries(shoppingGroups).map(([slot, items]) => (
                <div key={slot} className={styles.shopGroup}>
                  <div className={styles.shopGroupTitle}>{slot}</div>
                  <div className={styles.shopItems}>
                    {(items as any[]).map((it, idx) => {
                      const label =
                        `${it?.brand ? it.brand + " " : ""}${it?.color ? it.color + " " : ""}${it?.name || it?.generic_name || it?.title || "商品"}`.trim();
                      const url = buildShopUrl(it);
                      return (
                        <a key={idx} className={styles.shopItem} href={url} target="_blank" rel="noreferrer">
                          <span>{label}</span>
                          <span className={styles.shopGo}>前往賣場 →</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.muted}>生成後會顯示上衣/褲子/鞋子等分類的賣場連結</div>
          )}
        </section>
      </main>

      {/* Zoom modal */}
      {zoomOpen && (
        <div className={styles.zoomOverlay} onClick={() => setZoomOpen(false)}>
          <div className={styles.zoomModal} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.zoomImg} src={previewSrc} alt="zoom" />
          </div>
        </div>
      )}
    </div>
  );
}
