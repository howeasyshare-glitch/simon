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
  is_public?: boolean;
};

type ImgResp = {
  ok?: boolean;
  image_base64?: string;
  image_url?: string;
  image_path?: string;
  storage_path?: string;
  error?: string;
  detail?: any;
};

type Gender = "male" | "female" | "neutral";
type Audience = "adult" | "child";

const SCENES: Record<
  Audience,
  Record<Gender, Array<{ id: string; title: string; style: string; palette: string; variant?: string }>>
> = {
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
    { id: "celeb-jungkook", title: "Jungkook", style: "casual", palette: "mono-dark", variant: "celeb-jungkook-casual" },
    { id: "celeb-v", title: "V", style: "smart", palette: "mono-dark", variant: "celeb-v-smart" },
  ],
  neutral: [
    { id: "celeb-gd", title: "GD", style: "street", palette: "denim", variant: "celeb-gd-street" },
    { id: "celeb-jennie", title: "Jennie", style: "minimal", palette: "mono-dark", variant: "celeb-jennie-minimal" },
    { id: "celeb-iu", title: "IU", style: "casual", palette: "cream-warm", variant: "celeb-iu-casual" },
  ],
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatDate(ts?: string) {
  if (!ts) return "剛剛";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "剛剛";
  return d.toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);

  const [explore, setExplore] = useState<OutfitRow[]>([]);
  const [recent, setRecent] = useState<OutfitRow[]>([]);
  const [favorites, setFavorites] = useState<OutfitRow[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  const [gender, setGender] = useState<Gender>("female");
  const [audience, setAudience] = useState<Audience>("adult");
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  const [style, setStyle] = useState<string>("casual");
  const [palette, setPalette] = useState<string>("mono-dark");
  const [styleVariant, setStyleVariant] = useState<string>("");

  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [selectedCelebId, setSelectedCelebId] = useState<string>("");

  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [products, setProducts] = useState<any>(null);

  const [imageUrl, setImageUrl] = useState<string>("");
  const [imagePath, setImagePath] = useState<string>("");
  const [currentOutfitId, setCurrentOutfitId] = useState<string>("");
  const [currentShareUrl, setCurrentShareUrl] = useState<string>("");
  const [isFavoritedCurrent, setIsFavoritedCurrent] = useState(false);

  const [zoomOpen, setZoomOpen] = useState(false);

  const generatorRef = useRef<HTMLElement | null>(null);
  const isAuthed = !!(me && (me as any).ok);

  const email = (me as any)?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  const scenes = useMemo(() => SCENES[audience]?.[gender] || [], [audience, gender]);
  const celebs = useMemo(() => CELEBS[gender] || [], [gender]);

  const previewSrc = imageUrl || "";
  const activePresetLabel = useMemo(() => {
    const scene = scenes.find((s) => s.id === selectedSceneId);
    if (scene) return scene.title;
    const celeb = celebs.find((c) => c.id === selectedCelebId);
    if (celeb) return celeb.title;
    return "";
  }, [scenes, celebs, selectedSceneId, selectedCelebId]);

  const sliderAccent = "#C26752";

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

  useEffect(() => {
    loadExplore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setSelectedCelebId("");
    } else {
      setSelectedCelebId(p.id);
      setSelectedSceneId("");
    }
    setStatus(`已套用靈感：${p.id}`);
    scrollToGenerator();
  }

  async function persistGeneratedOutfitToDb(args: { image_url?: string; image_path?: string; specObj: any }) {
    const created = await apiPostJson<{ ok: boolean; item?: OutfitRow }>(`/api/data?op=outfits.create`, {
      image_url: args.image_url || "",
      image_path: args.image_path || "",
      is_public: true,
      spec: args.specObj,
      style: { style, palette, styleVariant: styleVariant || null, audience, gender },
      summary: args.specObj?.summary || "",
      products: null,
    });

    const outfitId = created?.item?.id || "";
    setCurrentOutfitId(outfitId);

    const shareSlug = created?.item?.share_slug || "";
    const shareUrl = shareSlug ? `${window.location.origin}/share/${shareSlug}` : "";
    setCurrentShareUrl(shareUrl);

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

    await loadExplore();
    await loadRecent();
  }

  async function handleCopyShare() {
    if (!currentShareUrl) {
      setStatus("尚未建立分享連結");
      return;
    }
    try {
      await navigator.clipboard.writeText(currentShareUrl);
      setStatus("已複製分享連結 ✅");
    } catch {
      setStatus("複製失敗（瀏覽器限制）");
    }
  }

  async function handleFavoriteCurrent() {
    if (!currentOutfitId) {
      setStatus("尚未建立 outfit，不能加入最愛");
      return;
    }

    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }

      const result = await apiPostJson<{ ok?: boolean; liked?: boolean }>(`/api/data?op=outfits.like`, {
        outfit_id: currentOutfitId,
        anon_id: anonId,
      });

      if (result?.ok) {
        setIsFavoritedCurrent(!!result.liked);
        setStatus(result?.liked ? "已加入最愛 ✅" : "已在最愛中");
        await loadFavorites();
        await loadExplore();
      } else {
        setStatus("加入最愛失敗");
      }
    } catch (e: any) {
      setStatus("加入最愛失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleExploreLike(outfitId: string) {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }

      const result = await apiPostJson<{ ok?: boolean; liked?: boolean }>(`/api/data?op=outfits.like`, {
        outfit_id: outfitId,
        anon_id: anonId,
      });

      if (result?.ok) {
        setStatus(result?.liked ? "已加入最愛 ✅" : "已在最愛中");
        await loadFavorites();
        await loadExplore();
      } else {
        setStatus("加入最愛失敗");
      }
    } catch (e: any) {
      setStatus("加入最愛失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleExploreShare(it: OutfitRow) {
    try {
      if (!it?.id) {
        setStatus("分享失敗：缺少 outfit id");
        return;
      }

      if (!it?.is_public || !it?.share_slug) {
        setStatus("這筆穿搭尚未公開，不能分享");
        return;
      }

      await apiPostJson(`/api/data?op=outfits.share`, {
        outfit_id: it.id,
      });

      const shareUrl = `${window.location.origin}/share/${it.share_slug}`;
      await navigator.clipboard.writeText(shareUrl);
      setStatus("已複製分享連結 ✅");
      await loadExplore();
    } catch (e: any) {
      setStatus("分享失敗：" + (e?.message || "Unknown error"));
    }
  }

  function getRecentHref(it: OutfitRow) {
    if (it?.is_public && it?.share_slug) {
      return `/share/${it.share_slug}`;
    }
    return "/my";
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
    setIsFavoritedCurrent(false);

    try {
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
      const path = (imgResp as any).image_path || (imgResp as any).storage_path || "";
      if (!url && !path) throw new Error("IMAGE failed: missing image_url/storage_path");

      if (url) setImageUrl(url);
      if (path) setImagePath(path);

      setStatus("正在建立分享與公開牆…");
      await persistGeneratedOutfitToDb({ image_url: url, image_path: path, specObj });

      setStatus("完成 ✅");
    } catch (e: any) {
      setStatus("生成失敗：" + (e?.message || "Unknown error"));
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>

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
                  <button
                    className={styles.userItemBtn}
                    onClick={() => {
                      setUserMenuOpen(false);
                      scrollToGenerator();
                    }}
                  >
                    開始生成
                  </button>
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

      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>AI Outfit Generator</div>
          <h1 className={styles.h1}>先逛靈感，再一鍵生成你的穿搭</h1>
          <p className={styles.p}>
            從公開精選挑一個喜歡的方向，直接套用到你的條件裡，讓生成更快更準。
          </p>

          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={scrollToGenerator}>
              開始設定
            </button>
            <a className={styles.secondaryBtn} href="/explore">
              先逛 Explore
            </a>
          </div>

          {!!status && <div className={styles.status}>{status}</div>}

          <div className={styles.featuredBox}>
            <div className={styles.featuredTop}>
              <div>
                <div className={styles.featuredTitle}>公開穿搭精選</div>
                <div className={styles.featuredSub}>先挑一個方向，再把風格帶進生成器</div>
              </div>
            </div>

            {loadingExplore ? (
              <div className={styles.muted}>載入中…</div>
            ) : explore.length ? (
              <div className={styles.exploreGrid}>
                {explore.map((it) => {
                  const st = it.style || {};
                  const title = st.style || st.styleId || st.id || "Outfit";
                  return (
                    <div key={it.id} className={styles.exploreCard}>
                      <a
                        href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}
                        className={styles.exploreLink}
                      >
                        <div className={styles.exploreThumb}>
                          {it.image_url ? <img src={it.image_url} alt={title} /> : <div className={styles.thumbEmpty} />}
                        </div>
                        <div className={styles.exploreMeta}>
                          <div className={styles.exploreTitle}>{title}</div>
                          <div className={styles.exploreSub}>
                            {it.summary || `${st.palette || "palette"} · ${formatDate(it.created_at)}`}
                          </div>
                        </div>
                      </a>

                      <div className={styles.exploreActions}>
                        <a
                          className={styles.smallBtn}
                          href={it.is_public && it.share_slug ? `/share/${it.share_slug}` : "/explore"}
                        >
                          查看
                        </a>
                        <button className={styles.smallBtn} onClick={() => handleExploreLike(it.id)}>
                          Like
                        </button>
                        <button className={styles.smallBtn} onClick={() => handleExploreShare(it)}>
                          分享
                        </button>
                        <button
                          className={styles.smallBtnPrimary}
                          onClick={() =>
                            applyPreset({
                              kind: "scene",
                              id: "from-explore",
                              style: st.style || st.styleId || "casual",
                              palette: st.palette || "mono-dark",
                              variant: st.styleVariant || "",
                            })
                          }
                        >
                          套用風格
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.muted}>目前沒有資料</div>
            )}
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div>
                <div className={styles.previewTitle}>本次生成預覽</div>
                <div className={styles.previewSub}>生成完成後會顯示在這裡，點圖可放大</div>
              </div>
              {activePresetLabel ? <div className={styles.activePreset}>已套用：{activePresetLabel}</div> : null}
            </div>

            <div className={styles.previewBox}>
              {previewSrc ? (
                <img
                  className={styles.previewImg}
                  src={previewSrc}
                  alt="outfit preview"
                  onClick={() => setZoomOpen(true)}
                />
              ) : (
                <div className={styles.previewEmpty}>
                  <div className={styles.previewEmptyTitle}>還沒有生成圖</div>
                  <div className={styles.previewEmptyDesc}>在下方設定條件後按下「立即生成」</div>
                </div>
              )}
            </div>

            <div className={styles.previewSummary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>風格</span>
                <span className={styles.summaryValue}>{style}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>配色</span>
                <span className={styles.summaryValue}>{palette}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>狀態</span>
                <span className={styles.summaryValue}>{status || "尚未開始"}</span>
              </div>
            </div>

            <div className={styles.previewActions}>
              {previewSrc ? (
                <>
                  {currentShareUrl ? (
                    <a className={styles.primaryBtn} href={currentShareUrl} target="_blank" rel="noreferrer">
                      開啟分享頁
                    </a>
                  ) : (
                    <span className={styles.muted}>尚未建立分享頁</span>
                  )}

                  {currentShareUrl ? (
                    <button className={styles.ghostBtn} onClick={handleCopyShare}>
                      複製連結
                    </button>
                  ) : null}

                  <button
                    className={styles.secondaryBtn}
                    onClick={handleFavoriteCurrent}
                    disabled={!currentOutfitId || isFavoritedCurrent}
                    title={isFavoritedCurrent ? "已加入最愛" : "加入最愛"}
                  >
                    {isFavoritedCurrent ? "已加入最愛" : "加到最愛"}
                  </button>

                  <button className={styles.secondaryBtn} onClick={handleGenerate}>
                    重新生成
                  </button>
                </>
              ) : (
                <div className={styles.muted}>完成設定後，右邊會顯示成果卡</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className={styles.mainStack}>
        <section className={styles.generatorPanel} ref={generatorRef as any}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelEyebrow}>Generator</div>
              <div className={styles.panelTitle}>設定你的穿搭條件</div>
            </div>
          </div>

          <div className={styles.generatorGrid}>
            <div className={styles.generatorMain}>
              <div className={styles.block}>
                <div className={styles.blockTitle}>性別</div>
                <div className={styles.segRow}>
                  {(["female", "male", "neutral"] as Gender[]).map((g) => {
                    const active = gender === g;
                    return (
                      <button
                        key={g}
                        className={`${styles.segBtn} ${active ? styles.segBtnActive : ""}`}
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
              </div>

              <div className={styles.block}>
                <div className={styles.blockTitle}>對象</div>
                <div className={styles.segRow}>
                  {(["adult", "child"] as Audience[]).map((a) => {
                    const active = audience === a;
                    return (
                      <button
                        key={a}
                        className={`${styles.segBtn} ${active ? styles.segBtnActive : ""}`}
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
              </div>

              <div className={styles.block}>
                <div className={styles.blockTitle}>穿搭情境</div>
                <div className={styles.choiceGrid}>
                  {scenes.map((s) => {
                    const active = selectedSceneId === s.id;
                    return (
                      <button
                        key={s.id}
                        className={`${styles.choiceBtn} ${active ? styles.choiceBtnActive : ""}`}
                        onClick={() =>
                          applyPreset({ kind: "scene", id: s.id, style: s.style, palette: s.palette, variant: s.variant })
                        }
                      >
                        <div className={styles.choiceTitle}>{s.title}</div>
                        <div className={styles.choiceSub}>
                          {s.style} · {s.palette}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.block}>
                <div className={styles.blockTitle}>名人靈感（只抓風格，不模仿臉）</div>
                <div className={styles.choiceGrid}>
                  {celebs.map((c) => {
                    const active = selectedCelebId === c.id;
                    return (
                      <button
                        key={c.id}
                        className={`${styles.choiceBtn} ${active ? styles.choiceBtnActive : ""}`}
                        onClick={() =>
                          applyPreset({ kind: "celeb", id: c.id, style: c.style, palette: c.palette, variant: c.variant })
                        }
                      >
                        <div className={styles.choiceTitle}>{c.title}</div>
                        <div className={styles.choiceSub}>
                          {c.style} · {c.variant}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <details className={styles.advancedBox}>
                <summary className={styles.advancedSummary}>進階設定</summary>

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
              </details>
            </div>

            <aside className={styles.generatorSide}>
              <div className={styles.sideCard}>
                <div className={styles.sideTitle}>目前設定</div>
                <div className={styles.kvCompact}>
                  <div>風格</div>
                  <div>{style}</div>
                  <div>配色</div>
                  <div>{palette}</div>
                  <div>對象</div>
                  <div>{audience === "adult" ? "成人" : "兒童"}</div>
                  <div>性別</div>
                  <div>{gender === "female" ? "女" : gender === "male" ? "男" : "中性"}</div>
                </div>

                {activePresetLabel ? <div className={styles.activePresetBlock}>已套用靈感：{activePresetLabel}</div> : null}

                <div className={styles.stickyAction}>
                  <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>
                    立即生成
                  </button>
                  {!isAuthed && <div className={styles.smallHint}>未登入無法生成，請先 Google 登入</div>}
                </div>
              </div>

              <details className={styles.debugPanel}>
                <summary className={styles.debugSummary}>查看生成資訊</summary>

                <div className={styles.debugSection}>
                  <div className={styles.debugLabel}>狀態</div>
                  <div className={styles.debugValue}>{status || "—"}</div>
                </div>

                <div className={styles.debugSection}>
                  <div className={styles.debugLabel}>Outfit</div>
                  <div className={styles.debugValue}>
                    {currentOutfitId ? (
                      <div className={styles.debugList}>
                        <div>ID：{currentOutfitId}</div>
                        {imagePath ? <div>image_path：{imagePath}</div> : null}
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
                </div>

                <div className={styles.debugSection}>
                  <div className={styles.debugLabel}>Spec</div>
                  <div className={styles.debugValue}>
                    {spec ? <pre className={styles.pre}>{JSON.stringify(spec, null, 2)}</pre> : <span className={styles.muted}>尚未生成</span>}
                  </div>
                </div>

                <div className={styles.debugSection}>
                  <div className={styles.debugLabel}>購買路徑</div>
                  <div className={styles.debugValue}>
                    {products ? (
                      <pre className={styles.pre}>{JSON.stringify(products, null, 2)}</pre>
                    ) : (
                      <span className={styles.muted}>尚未取得（需 /api/data?op=products 對應 custom_products）</span>
                    )}
                  </div>
                </div>
              </details>
            </aside>
          </div>
        </section>

        <section className={styles.shelfSection}>
          <div className={styles.shelfHead}>
            <div>
              <div className={styles.panelTitle}>最近 10 個生成</div>
              <div className={styles.sectionSub}>快速回看你最近產生的穿搭</div>
            </div>
            <a className={styles.secondaryBtn} href="/my">
              看更多
            </a>
          </div>

          {loadingRecent ? (
            <div className={styles.muted}>載入中…</div>
          ) : recent.length ? (
            <div className={styles.shelfGrid}>
              {recent.map((it) => (
                <a key={it.id} className={styles.miniCard} href={getRecentHref(it)}>
                  <div className={styles.miniThumb}>
                    {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                  </div>
                  <div className={styles.miniMeta}>
                    <div className={styles.miniTitle}>{it.style?.style || it.style?.styleId || "Outfit"}</div>
                    <div className={styles.miniSub}>
                      {formatDate(it.created_at)} · {it.is_public && it.share_slug ? "已公開" : "未公開"}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className={styles.muted}>尚無資料</div>
          )}
        </section>

        <section className={styles.shelfSection}>
          <div className={styles.shelfHead}>
            <div>
              <div className={styles.panelTitle}>我的最愛</div>
              <div className={styles.sectionSub}>收藏後的靈感可以再回來重用</div>
            </div>
          </div>

          {loadingFav ? (
            <div className={styles.muted}>載入中…</div>
          ) : favorites.length ? (
            <div className={styles.shelfGrid}>
              {favorites.map((it) => (
                <a key={it.id} className={styles.miniCard} href={it.share_slug ? `/share/${it.share_slug}` : "/my"}>
                  <div className={styles.miniThumb}>
                    {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                  </div>
                  <div className={styles.miniMeta}>
                    <div className={styles.miniTitle}>{it.style?.style || it.style?.styleId || "Outfit"}</div>
                    <div className={styles.miniSub}>{it.summary || "已收藏"}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className={styles.muted}>尚無資料（通常來自 outfit_likes）</div>
          )}
        </section>
      </main>

      {zoomOpen && previewSrc && (
        <div className={styles.modalBackdrop} onClick={() => setZoomOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTop}>
              <div className={styles.modalTitle}>預覽大圖</div>
              <button className={styles.modalClose} onClick={() => setZoomOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <img src={previewSrc} alt="zoom" className={styles.modalImg} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
