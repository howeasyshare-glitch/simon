"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { apiFetch, apiGetJson, apiPostJson } from "../lib/apiFetch";

type MeResp =
  | { ok: true; user?: { id: string; email?: string }; credits_left?: number; is_tester?: boolean }
  | { ok?: false; error?: string };

type OutfitRow = {
  id: string;
  created_at?: string;
  share_slug?: string | null;
  image_url?: string;
  image_path?: string | null;
  summary?: string | null;
  spec?: any;
  style?: any;
  products?: any;
  like_count?: number;
  share_count?: number;
  apply_count?: number;
  share_url?: string;
};

type SpecResp = { ok?: boolean; spec?: any; error?: string; detail?: any };
type ImgResp = { ok?: boolean; image_base64?: string; image_url?: string; image_path?: string; error?: string; detail?: any };

type Gender = "male" | "female" | "neutral";
type Audience = "adult" | "child";

/** ======= Scenario / Celebrity preset data (移植自舊版概念；你可再對齊 index.html 的完整資料) ======= */
const SCENES: Record<Audience, Record<Gender, Array<{ id: string; title: string; style: string; palette: string; variant?: string }>>> =
  {
    adult: {
      male: [
        { id: "scene-commute", title: "日常 / 上學", style: "casual", palette: "mono-dark", variant: "scene-commute" },
        { id: "scene-outdoor", title: "戶外玩樂", style: "casual", palette: "earth", variant: "scene-outdoor" },
        { id: "scene-sport", title: "運動 / 體育課", style: "sporty", palette: "bright", variant: "scene-sport" },
        { id: "scene-party", title: "聚會 / 生日", style: "street", palette: "denim", variant: "scene-party" },
        { id: "scene-travel", title: "旅行", style: "casual", palette: "earth", variant: "scene-travel" },
        { id: "scene-formal", title: "正式場合", style: "smart", palette: "mono-dark", variant: "scene-formal" },
      ],
      female: [
        { id: "scene-commute", title: "日常 / 上學", style: "casual", palette: "mono-light", variant: "scene-commute" },
        { id: "scene-date", title: "約會", style: "minimal", palette: "cream-warm", variant: "scene-date" },
        { id: "scene-outdoor", title: "戶外玩樂", style: "casual", palette: "earth", variant: "scene-outdoor" },
        { id: "scene-party", title: "聚會 / 生日", style: "street", palette: "bright", variant: "scene-party" },
        { id: "scene-travel", title: "旅行", style: "casual", palette: "earth", variant: "scene-travel" },
        { id: "scene-formal", title: "正式場合", style: "smart", palette: "mono-dark", variant: "scene-formal" },
      ],
      neutral: [
        { id: "scene-commute", title: "日常 / 通勤", style: "smart", palette: "mono-dark", variant: "scene-commute" },
        { id: "scene-minimal", title: "極簡 / 乾淨", style: "minimal", palette: "mono-light", variant: "scene-minimal" },
        { id: "scene-street", title: "街頭 / 層次", style: "street", palette: "denim", variant: "scene-street" },
        { id: "scene-sport", title: "運動 / 輕機能", style: "sporty", palette: "bright", variant: "scene-sport" },
      ],
    },
    child: {
      male: [
        { id: "kid-school", title: "校園", style: "casual", palette: "bright", variant: "kid-school" },
        { id: "kid-sport", title: "運動", style: "sporty", palette: "bright", variant: "kid-sport" },
        { id: "kid-travel", title: "旅行", style: "casual", palette: "earth", variant: "kid-travel" },
      ],
      female: [
        { id: "kid-school", title: "校園", style: "casual", palette: "bright", variant: "kid-school" },
        { id: "kid-outdoor", title: "戶外", style: "casual", palette: "earth", variant: "kid-outdoor" },
        { id: "kid-party", title: "聚會", style: "smart", palette: "cream-warm", variant: "kid-party" },
      ],
      neutral: [
        { id: "kid-school", title: "校園", style: "casual", palette: "bright", variant: "kid-school" },
        { id: "kid-sport", title: "運動", style: "sporty", palette: "bright", variant: "kid-sport" },
        { id: "kid-travel", title: "旅行", style: "casual", palette: "earth", variant: "kid-travel" },
      ],
    },
  };

const CELEBS: Record<Gender, Array<{ id: string; title: string; style: string; palette: string; variant: string }>> = {
  female: [
    { id: "celeb-iu", title: "IU", style: "casual", palette: "cream-warm", variant: "celeb-iu-casual" },
    { id: "celeb-jennie", title: "Jennie", style: "minimal", palette: "mono-dark", variant: "celeb-jennie-minimal" },
    { id: "celeb-lisa", title: "Lisa", style: "sporty", palette: "bright", variant: "celeb-lisa-sporty" },
  ],
  male: [
    { id: "celeb-gd", title: "GD", style: "street", palette: "denim", variant: "celeb-gd-street" },
    { id: "celeb-jungkook", title: "Jungkook", style: "casual", palette: "mono-dark", variant: "celeb-jungkook-casual" as any },
    { id: "celeb-v", title: "V", style: "smart", palette: "mono-dark", variant: "celeb-v-smart" as any },
  ],
  neutral: [
    { id: "celeb-gd", title: "GD", style: "street", palette: "denim", variant: "celeb-gd-street" },
    { id: "celeb-jennie", title: "Jennie", style: "minimal", palette: "mono-dark", variant: "celeb-jennie-minimal" },
    { id: "celeb-iu", title: "IU", style: "casual", palette: "cream-warm", variant: "celeb-iu-casual" },
  ],
};

/** ======= helpers ======= */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);

  // Explore / Recent / Favorites
  const [explore, setExplore] = useState<OutfitRow[]>([]);
  const [recent, setRecent] = useState<OutfitRow[]>([]);
  const [favorites, setFavorites] = useState<OutfitRow[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  // Header UI
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  // Form (match old concept)
  const [gender, setGender] = useState<Gender>("female");
  const [audience, setAudience] = useState<Audience>("adult");

  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  // Style/palette (keep palette)
  const [style, setStyle] = useState<string>("casual");
  const [palette, setPalette] = useState<string>("mono-dark");

  // Style variant (scene/celebrity/brand). 「不顯示，但會自動帶入」
  const [styleVariant, setStyleVariant] = useState<string>("");

  // toggles
  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // selection single (prevent multi-select)
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [selectedCelebId, setSelectedCelebId] = useState<string>("");

  // Flow
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [products, setProducts] = useState<any>(null);

  const [imageUrl, setImageUrl] = useState<string>("");
  const [imagePath, setImagePath] = useState<string>("");
  const [currentOutfitId, setCurrentOutfitId] = useState<string>("");
  const [currentShareUrl, setCurrentShareUrl] = useState<string>("");

  // preview modal
  const [zoomOpen, setZoomOpen] = useState(false);

  const generatorRef = useRef<HTMLElement | null>(null);

  const isAuthed = !!(me && (me as any).ok);

  const payload = useMemo(() => {
    return {
      gender,
      audience,
      age,
      height,
      weight,
      temp,
      style,
      palette,
      styleVariant: styleVariant || undefined,
      withBag,
      withHat,
      withCoat,
    };
  }, [gender, audience, age, height, weight, temp, style, palette, styleVariant, withBag, withHat, withCoat]);

  // ✅ 用 apiFetch 會自動帶 Authorization: Bearer <token>
  async function refreshMe() {
    try {
      const r = await apiFetch("/api/me?ts=" + Date.now(), { method: "GET" });
      if (r.status === 401) {
        setMe({ ok: false, error: "unauthorized" });
        return;
      }
      const text = await r.text();
      let j: any = null;
      try {
        j = JSON.parse(text);
      } catch {
        j = null;
      }
      if (!r.ok) {
        setMe({ ok: false, error: j?.error || text || `HTTP ${r.status}` });
        return;
      }
      setMe(j);
    } catch (e: any) {
      setMe({ ok: false, error: e?.message || "me fetch failed" });
    }
  }

  async function loadExplore() {
    setLoadingExplore(true);
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>(
        "/api/data?op=explore&limit=8&sort=like&ts=" + Date.now()
      );
      setExplore(data?.items || []);
    } catch {
      setExplore([]);
    } finally {
      setLoadingExplore(false);
    }
  }

  async function loadRecent() {
    if (!isAuthed) return;
    setLoadingRecent(true);
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>(
        "/api/data?op=outfits.recent&limit=10&ts=" + Date.now()
      );
      setRecent(data?.items || []);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }

  async function loadFavorites() {
  setLoadingFav(true);
  try {
    let anonId = localStorage.getItem("findoutfit_anon_id");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("findoutfit_anon_id", anonId);
    }

    const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>(
      `/api/data?op=outfits.favorites&limit=10&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`
    );

    setFavorites(data?.items || []);
  } catch {
    setFavorites([]);
  } finally {
    setLoadingFav(false);
  }
}

  useEffect(() => {
    refreshMe();
    const { data } = supabaseBrowser.auth.onAuthStateChange(() => {
      refreshMe();
      // after login/logout refresh lists
      setTimeout(() => {
        loadRecent();
        loadFavorites();
      }, 350);
    });
    return () => {
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initial explore
  useEffect(() => {
    loadExplore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load user lists when authed
  useEffect(() => {
    if (isAuthed) {
      loadRecent();
      loadFavorites();
    } else {
      setRecent([]);
      setFavorites([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

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

  async function handleGoogleLogin() {
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
    setStatus("已登出");
    setUserMenuOpen(false);
  }

  function scrollToGenerator() {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyPreset(p: { style: string; palette: string; variant?: string; kind: "scene" | "celeb"; id: string }) {
    setStyle(p.style);
    setPalette(p.palette);
    setStyleVariant(p.variant || "");
    if (p.kind === "scene") {
      setSelectedSceneId(p.id);
      setSelectedCelebId(""); // ensure single selection across groups
    } else {
      setSelectedCelebId(p.id);
      setSelectedSceneId("");
    }
    scrollToGenerator();
  }

  async function persistGeneratedOutfitToDb(args: { image_url?: string; image_path?: string; specObj: any }) {
    // create
    const created = await apiPostJson<{ ok: boolean; outfit?: OutfitRow }>(`/api/data?op=outfits.create`, {
      image_url: args.image_url || "",
      image_path: args.image_path || "",
      is_public: true,
      spec: args.specObj,
      style: { style, palette, styleVariant: styleVariant || null, audience, gender },
      summary: args.specObj?.summary || "",
      products: null,
      // share_slug 可由後端產生也可由前端不帶
    });

    const outfitId = created?.outfit?.id || "";
    setCurrentOutfitId(outfitId);

    const shareSlug = created?.outfit?.share_slug || "";
    const shareUrl = shareSlug ? `${window.location.origin}/share/${shareSlug}` : "";
    setCurrentShareUrl(shareUrl);

    // products mapping (optional)
    try {
      const prod = await apiPostJson<{ ok?: boolean; products?: any }>(`/api/data?op=products`, {
        items: args.specObj?.items || [],
        limitPerSlot: 4,
      });

      if (prod?.products && outfitId) {
        setProducts(prod.products);
        await apiPostJson(`/api/data?op=outfits.update&id=${encodeURIComponent(outfitId)}`, {
          products: prod.products,
        });
      } else {
        setProducts(null);
      }
    } catch {
      setProducts(null);
    }

    // refresh lists
    loadExplore();
    loadRecent();
  }

  async function handleGenerate() {
    if (!isAuthed) {
      setStatus("請先登入後才能生成。");
      return;
    }

    setStatus("正在分析條件…");
    setSpec(null);
    setProducts(null);
    setImageUrl("");
    setImagePath("");
    setCurrentOutfitId("");
    setCurrentShareUrl("");

    try {
      // 1) Spec：後端吃扁平欄位（不要包 payload）
      const specResp = await apiPostJson<any>("/api/generate-outfit-spec", {
        gender,
        age,
        height,
        weight,
        style,
        styleVariant: styleVariant || undefined,
        temp,
        withBag,
        withHat,
        withCoat,
      });

      const specObj = (specResp as any).spec || specResp;
      setSpec(specObj);

      // 2) Image：帶 outfitSpec
      setStatus("正在生成穿搭圖…");
      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", {
        gender,
        age,
        height,
        weight,
        style,
        styleVariant: styleVariant || undefined,
        temp,
        withBag,
        withHat,
        withCoat,
        outfitSpec: { items: specObj?.items || [], summary: specObj?.summary || "" },
        aspectRatio: "9:16",
        imageSize: "1K",
      });

      const url = (imgResp as any).image_url || "";
      const path = (imgResp as any).image_path || "";
      if (!url && !path) throw new Error("IMAGE failed: missing image_url/image_path");

      if (url) setImageUrl(url);
      if (path) setImagePath(path);

      // 3) Persist → 讓 Explore/Share/Recent 都有資料
      setStatus("正在建立分享與公開牆…");
      await persistGeneratedOutfitToDb({ image_url: url, image_path: path, specObj });

      setStatus("完成 ✅");
    } catch (e: any) {
      setStatus("生成失敗：" + (e?.message || "Unknown error"));
    }
  }

  const email = (me as any)?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  const scenes = useMemo(() => {
    return SCENES[audience]?.[gender] || [];
  }, [audience, gender]);

  const celebs = useMemo(() => {
    return CELEBS[gender] || [];
  }, [gender]);

  const previewSrc = imageUrl || "";

  const sliderAccent = "#C26752"; // 你目前偏紅棕的系統配色（更搭深色 UI）

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>

        {/* Desktop nav */}
        <nav className={styles.nav}>
          <a className={styles.navLink} href="/explore">Explore</a>
          <a className={styles.navLink} href="/my">我的穿搭</a>
          <a className={styles.navLink} href="/settings">設定</a>
        </nav>

        <div className={styles.headerRight}>
          {/* Mobile menu btn */}
          <button
            className={styles.iconBtn}
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open menu"
          >
            <span className={styles.burger} />
          </button>

          {/* Auth area */}
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

                  <a className={styles.userItem} href="/my" onClick={() => setUserMenuOpen(false)}>我的穿搭</a>
                  <a className={styles.userItem} href="/settings" onClick={() => setUserMenuOpen(false)}>設定</a>

                  {/* 你提到：最近/最愛放哪裡更好 → 我先放在 menu 裡，畫面最乾淨 */}
                  <button
                    className={styles.userItemBtn}
                    onClick={() => {
                      setUserMenuOpen(false);
                      scrollToGenerator();
                    }}
                  >
                    開始生成
                  </button>

                  <button className={styles.userItemBtn} onClick={handleLogout}>登出</button>
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

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <a className={styles.mobileItem} href="/explore" onClick={() => setMobileMenuOpen(false)}>Explore</a>
            <a className={styles.mobileItem} href="/my" onClick={() => setMobileMenuOpen(false)}>我的穿搭</a>
            <a className={styles.mobileItem} href="/settings" onClick={() => setMobileMenuOpen(false)}>設定</a>

            <div className={styles.mobileDivider} />

            {isAuthed ? (
              <button className={styles.mobileItemBtn} onClick={handleLogout}>登出</button>
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

      {/* ===== Hero: left = showcase + explore picks, right = preview ===== */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.h1}>公開穿搭精選</h1>
          <p className={styles.p}>
            先逛逛精選，喜歡就「套用風格」帶入你的生成條件。
          </p>

          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={scrollToGenerator}>開始設定</button>
            <a className={styles.secondaryBtn} href="/explore">先逛 Explore</a>
          </div>

          {!!status && <div className={styles.status}>{status}</div>}

          <div style={{ marginTop: 14 }}>
            {loadingExplore ? (
              <div className={styles.muted}>載入中…</div>
            ) : explore.length ? (
              <div className={styles.exploreGrid}>
                {explore.map((it) => (
                  <div
                    key={it.id}
                    className={styles.exploreCard}
                    style={{ cursor: "default" }}
                  >
                    <a
                      href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div className={styles.exploreThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                      </div>
                      <div className={styles.exploreMeta}>
                        <div className={styles.exploreTitle}>查看</div>
                        <div className={styles.exploreSub}>{it.style?.styleId || it.style?.style || it.style?.id || "—"}</div>
                      </div>
                    </a>

                    {/* actions (lightweight, no hover flash) */}
                    <div style={{ display: "flex", gap: 8, padding: "0 10px 10px" }}>
                      <button
                        className={styles.secondaryBtn}
                        style={{ padding: "8px 10px" }}
                        onClick={() => {
                          // 喜歡：先只做「加入 favorites」(需 data.js 支援 op=outfits.like)
                          // 目前先不阻塞功能：提示
                          setStatus("喜歡功能：請在 data.js 補上 outfits.like（用 outfit_likes 表）");
                        }}
                      >
                        喜歡
                      </button>

                      <button
                        className={styles.secondaryBtn}
                        style={{ padding: "8px 10px" }}
                        onClick={async () => {
                          const url = it.share_slug ? `${window.location.origin}/share/${it.share_slug}` : "";
                          if (!url) return;
                          try {
                            await navigator.clipboard.writeText(url);
                            setStatus("已複製分享連結 ✅");
                          } catch {
                            setStatus("複製失敗（瀏覽器限制）");
                          }
                        }}
                      >
                        分享
                      </button>

                      <button
                        className={styles.primaryBtn}
                        style={{ padding: "8px 10px" }}
                        onClick={() => {
                          const st = it.style || {};
                          applyPreset({
                            kind: "scene",
                            id: "from-explore",
                            style: st.style || st.styleId || "casual",
                            palette: st.palette || "mono-dark",
                            variant: st.styleVariant || "",
                          });
                        }}
                      >
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
        </div>

        <div className={styles.heroRight}>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div className={styles.previewTitle}>預覽</div>
              <div className={styles.previewSub}>生成後會顯示在這裡，點圖片可放大</div>
            </div>

            <div className={styles.previewBox} style={{ position: "relative" }}>
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.previewImg}
                  src={previewSrc}
                  alt="outfit preview"
                  style={{ objectFit: "contain" }} // ✅ 不裁切、不溢出
                  onClick={() => setZoomOpen(true)}
                />
              ) : (
                <div className={styles.previewEmpty}>
                  <div className={styles.previewEmptyTitle}>還沒有生成圖</div>
                  <div className={styles.previewEmptyDesc}>到下方設定條件，再按「立即生成」</div>
                </div>
              )}
            </div>

            <div className={styles.previewActions}>
              {previewSrc ? (
                <>
                  {currentShareUrl ? (
                    <a className={styles.primaryBtn} href={currentShareUrl} target="_blank" rel="noreferrer">
                      分享頁
                    </a>
                  ) : (
                    <span className={styles.muted}>尚未建立分享頁</span>
                  )}

                  {currentShareUrl ? (
                    <button
                      className={styles.ghostBtn}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(currentShareUrl);
                          setStatus("已複製分享連結 ✅");
                        } catch {
                          setStatus("複製失敗（瀏覽器限制）");
                        }
                      }}
                    >
                      複製連結
                    </button>
                  ) : null}
                </>
              ) : (
                <div className={styles.muted}>完成設定後，在下方按「立即生成」</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Main ===== */}
      <main className={styles.mainGrid}>
        {/* LEFT: Generator */}
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>穿搭條件</div>

          {/* Gender buttons (single-select; hover should be subtle by CSS, not JS) */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {(["female", "male", "neutral"] as Gender[]).map((g) => {
              const active = gender === g;
              return (
                <button
                  key={g}
                  className={active ? styles.primaryBtn : styles.secondaryBtn}
                  style={{
                    padding: "10px 12px",
                    // active hover 不要差太多：用同色系（CSS 你再調 hover）
                    opacity: active ? 1 : 0.92,
                  }}
                  onClick={() => {
                    setGender(g);
                    setSelectedSceneId("");
                    setSelectedCelebId("");
                    setStyleVariant("");
                  }}
                >
                  {g === "female" ? "女" : g === "male" ? "男" : "中性"}
                </button>
              );
            })}
          </div>

          {/* Audience */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {(["adult", "child"] as Audience[]).map((a) => {
              const active = audience === a;
              return (
                <button
                  key={a}
                  className={active ? styles.primaryBtn : styles.secondaryBtn}
                  style={{ padding: "10px 12px", opacity: active ? 1 : 0.92 }}
                  onClick={() => {
                    setAudience(a);
                    setSelectedSceneId("");
                    setSelectedCelebId("");
                    setStyleVariant("");
                  }}
                >
                  {a === "adult" ? "成人" : "兒童"}
                </button>
              );
            })}
          </div>

          {/* Sliders (use inline accent) */}
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <div className={styles.label}>年齡</div>
              <input
                className={styles.input}
                type="range"
                min={5}
                max={60}
                value={clamp(age, 5, 60)}
                onChange={(e) => setAge(parseInt(e.target.value || "0", 10) || 0)}
                style={{ accentColor: sliderAccent }}
              />
              <div className={styles.muted}>{age}</div>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>身高（cm）</div>
              <input
                className={styles.input}
                type="range"
                min={120}
                max={200}
                value={clamp(height, 120, 200)}
                onChange={(e) => setHeight(parseInt(e.target.value || "0", 10) || 0)}
                style={{ accentColor: sliderAccent }}
              />
              <div className={styles.muted}>{height}</div>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>體重（kg）</div>
              <input
                className={styles.input}
                type="range"
                min={30}
                max={120}
                value={clamp(weight, 30, 120)}
                onChange={(e) => setWeight(parseInt(e.target.value || "0", 10) || 0)}
                style={{ accentColor: sliderAccent }}
              />
              <div className={styles.muted}>{weight}</div>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>氣溫（°C）</div>
              <input
                className={styles.input}
                type="range"
                min={0}
                max={35}
                value={clamp(temp, 0, 35)}
                onChange={(e) => setTemp(parseInt(e.target.value || "0", 10) || 0)}
                style={{ accentColor: sliderAccent }}
              />
              <div className={styles.muted}>{temp}</div>
            </label>
          </div>

          {/* Scenes */}
          <div style={{ marginTop: 14 }}>
            <div className={styles.panelTitle} style={{ marginBottom: 10 }}>穿搭情境</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {scenes.map((s) => {
                const active = selectedSceneId === s.id;
                return (
                  <button
                    key={s.id}
                    className={active ? styles.primaryBtn : styles.secondaryBtn}
                    style={{
                      textAlign: "left",
                      padding: "14px 14px",
                      borderRadius: 16,
                      opacity: active ? 1 : 0.9,
                    }}
                    onClick={() => applyPreset({ kind: "scene", id: s.id, style: s.style, palette: s.palette, variant: s.variant })}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{s.title}</div>
                    <div className={styles.muted}>{s.style} · {s.palette}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Celebs */}
          <div style={{ marginTop: 16 }}>
            <div className={styles.panelTitle} style={{ marginBottom: 10 }}>名人靈感（風格靈感，不模仿臉）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {celebs.map((c) => {
                const active = selectedCelebId === c.id;
                return (
                  <button
                    key={c.id}
                    className={active ? styles.primaryBtn : styles.secondaryBtn}
                    style={{
                      textAlign: "left",
                      padding: "14px 14px",
                      borderRadius: 16,
                      opacity: active ? 1 : 0.9,
                    }}
                    onClick={() => applyPreset({ kind: "celeb", id: c.id, style: c.style, palette: c.palette, variant: c.variant })}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{c.title}</div>
                    <div className={styles.muted}>{c.style} · {c.variant}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style + Palette */}
          <div className={styles.formGrid} style={{ marginTop: 16 }}>
            <label className={styles.field}>
              <div className={styles.label}>風格</div>
              <select className={styles.select} value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="casual">Casual</option>
                <option value="minimal">Minimal</option>
                <option value="street">Street</option>
                <option value="sporty">Sporty</option>
                <option value="smart">Smart Casual</option>
              </select>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>配色</div>
              <select className={styles.select} value={palette} onChange={(e) => setPalette(e.target.value)}>
                <option value="mono-dark">黑灰</option>
                <option value="mono-light">白灰</option>
                <option value="earth">大地</option>
                <option value="denim">丹寧</option>
                <option value="bright">亮色</option>
                <option value="cream-warm">奶油暖</option>
              </select>
            </label>
          </div>

          {/* Accessories */}
          <div className={styles.toggles} style={{ marginTop: 14 }}>
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

          {/* Single generate CTA */}
          <div className={styles.stickyAction}>
            <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>
              立即生成
            </button>
            {!isAuthed && <div className={styles.smallHint}>未登入無法生成，請先 Google 登入</div>}
          </div>
        </section>

        {/* RIGHT: Info + Recent + Favorites + Products */}
        <section className={styles.panel}>
          <div className={styles.panelTitle}>生成資訊</div>

          <div className={styles.kv}>
            <div className={styles.k}>狀態</div>
            <div className={styles.v}>{status || "—"}</div>

            <div className={styles.k}>Outfit</div>
            <div className={styles.v}>
              {currentOutfitId ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div><b>ID</b>：{currentOutfitId}</div>
                  {imagePath ? <div><b>image_path</b>：{imagePath}</div> : null}
                  {currentShareUrl ? (
                    <a className={styles.navLink} href={currentShareUrl} target="_blank" rel="noreferrer">
                      開啟分享頁
                    </a>
                  ) : (
                    <span className={styles.muted}>尚未建立分享頁</span>
                  )}
                </div>
              ) : (
                <span className={styles.muted}>尚未建立</span>
              )}
            </div>

            <div className={styles.k}>Spec</div>
            <div className={styles.v}>
              {spec ? <pre className={styles.pre}>{JSON.stringify(spec, null, 2)}</pre> : <span className={styles.muted}>尚未生成</span>}
            </div>

            <div className={styles.k}>購買路徑</div>
            <div className={styles.v}>
              {products ? (
                <pre className={styles.pre}>{JSON.stringify(products, null, 2)}</pre>
              ) : (
                <span className={styles.muted}>尚未取得（需 /api/data?op=products 實作對應 custom_products）</span>
              )}
            </div>
          </div>

          {/* Recent + Favorites (compact, does not disturb layout) */}
          <div className={styles.panelTitle} style={{ marginTop: 18 }}>
            最近 10 個生成
          </div>
          {loadingRecent ? (
            <div className={styles.muted}>載入中…</div>
          ) : recent.length ? (
            <div className={styles.exploreGrid} style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
              {recent.map((it) => (
                <a key={it.id} className={styles.exploreCard} href={it.share_slug ? `/share/${it.share_slug}` : "/my"}>
                  <div className={styles.exploreThumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                  </div>
                  <div className={styles.exploreMeta}>
                    <div className={styles.exploreTitle}>查看</div>
                    <div className={styles.exploreSub}>{it.style?.style || it.style?.styleId || "—"}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className={styles.muted}>尚無資料</div>
          )}

          <div className={styles.panelTitle} style={{ marginTop: 18 }}>
            我的最愛
          </div>
          {loadingFav ? (
            <div className={styles.muted}>載入中…</div>
          ) : favorites.length ? (
            <div className={styles.exploreGrid} style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
              {favorites.map((it) => (
                <a key={it.id} className={styles.exploreCard} href={it.share_slug ? `/share/${it.share_slug}` : "/my"}>
                  <div className={styles.exploreThumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                  </div>
                  <div className={styles.exploreMeta}>
                    <div className={styles.exploreTitle}>查看</div>
                    <div className={styles.exploreSub}>{it.style?.style || it.style?.styleId || "—"}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className={styles.muted}>尚無資料（通常來自 outfit_likes）</div>
          )}
        </section>
      </main>

      {/* zoom modal */}
      {zoomOpen && previewSrc && (
        <div
          onClick={() => setZoomOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 200,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(900px, 96vw)",
              height: "min(92vh, 1200px)",
              background: "rgba(20,22,24,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <button
              onClick={() => setZoomOpen(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✕
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="zoom"
              style={{ width: "100%", height: "100%", objectFit: "contain", background: "rgba(0,0,0,0.3)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
