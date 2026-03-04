"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { apiFetch, apiGetJson, apiPostJson } from "../lib/apiFetch";

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
  spec?: any;
  like_count?: number;
  share_count?: number;
  apply_count?: number;
  share_url?: string;
};

type OutfitRow = {
  id: string;
  created_at?: string;
  image_url?: string;
  image_path?: string;
  share_slug?: string | null;
  is_public?: boolean;
  summary?: string;
  style?: any;
  spec?: any;
  products?: any;
  share_url?: string;
};

type SpecResp = { ok?: boolean; spec?: any; error?: string; detail?: any };
type ImgResp = { ok?: boolean; image_base64?: string; image_url?: string; error?: string; detail?: any };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function safeJson(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * 你先用這份 mapping（之後貼 index.html 的資料，我再幫你完全對齊）
 * - gender: male/female/neutral
 * - category: adult/child
 * - scenario / celebrity: 依 gender / category 變化
 */
const SCENARIO_OPTIONS: Record<string, { label: string; value: string }[]> = {
  "male:adult": [
    { label: "通勤上班", value: "commute" },
    { label: "約會", value: "date" },
    { label: "周末休閒", value: "weekend" },
    { label: "運動健身", value: "sport" },
  ],
  "female:adult": [
    { label: "通勤上班", value: "commute" },
    { label: "約會", value: "date" },
    { label: "周末休閒", value: "weekend" },
    { label: "聚會派對", value: "party" },
  ],
  "neutral:adult": [
    { label: "通勤上班", value: "commute" },
    { label: "周末休閒", value: "weekend" },
    { label: "極簡日常", value: "minimal_daily" },
    { label: "街頭走跳", value: "street" },
  ],
  "male:child": [
    { label: "上學日常", value: "school" },
    { label: "運動活動", value: "sport" },
    { label: "戶外踏青", value: "outdoor" },
    { label: "聚會生日", value: "party" },
  ],
  "female:child": [
    { label: "上學日常", value: "school" },
    { label: "戶外踏青", value: "outdoor" },
    { label: "聚會生日", value: "party" },
    { label: "可愛日常", value: "cute" },
  ],
  "neutral:child": [
    { label: "上學日常", value: "school" },
    { label: "戶外踏青", value: "outdoor" },
    { label: "運動活動", value: "sport" },
    { label: "簡約舒適", value: "comfy" },
  ],
};

const CELEB_OPTIONS: Record<string, { label: string; value: string }[]> = {
  male: [
    { label: "GD", value: "celeb-gd-street" },
    { label: "BTS V", value: "celeb-v" },
    { label: "Jungkook", value: "celeb-jungkook" },
  ],
  female: [
    { label: "Jennie", value: "celeb-jennie-minimal" },
    { label: "IU", value: "celeb-iu-casual" },
    { label: "Lisa", value: "celeb-lisa-sporty" },
  ],
  neutral: [
    { label: "Karina", value: "celeb-karina" },
    { label: "IU", value: "celeb-iu-casual" },
    { label: "GD", value: "celeb-gd-street" },
  ],
};

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);

  // Explore featured
  const [explore, setExplore] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);

  // Personal
  const [tab, setTab] = useState<"featured" | "recent" | "fav">("featured");
  const [recent, setRecent] = useState<OutfitRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [favorites, setFavorites] = useState<OutfitRow[]>([]);
  const [loadingFav, setLoadingFav] = useState(false);

  // Header UI
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  // Debug drawer
  const [debugOpen, setDebugOpen] = useState(false);

  // Form (對齊舊版概念：性別/類別(成人/兒童)/情境/名人/配色…)
  const [gender, setGender] = useState<"male" | "female" | "neutral">("female");
  const [category, setCategory] = useState<"adult" | "child">("adult");

  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  // style 仍然保留（你的後端 generate-outfit-spec 需要 style）
  const [style, setStyle] = useState<"casual" | "minimal" | "street" | "sporty" | "smart">("casual");

  // palette 保留（你說多出來不錯）
  const [paletteId, setPaletteId] = useState<string>("mono-dark");

  // 新版：情境/名人
  const [scenario, setScenario] = useState<string>("");
  const [celebrity, setCelebrity] = useState<string>("");

  // accessories
  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // Flow state
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>("");

  // Outfit state
  const [currentOutfitId, setCurrentOutfitId] = useState<string>("");
  const [currentShareUrl, setCurrentShareUrl] = useState<string>("");

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  const generatorRef = useRef<HTMLElement | null>(null);

  const isAuthed = !!(me && (me as any).ok);
  const email = (me as any)?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  const scenarioKey = `${gender}:${category}`;
  const scenarioOptions = SCENARIO_OPTIONS[scenarioKey] || [];
  const celebOptions = CELEB_OPTIONS[gender] || [];

  // 送給後端的 payload（扁平欄位）
  const payload = useMemo(() => {
    return {
      gender,
      category,
      age,
      height,
      weight,
      temp,
      style,
      paletteId,
      scenario,
      // 後端目前叫 styleVariant：我們把 celebrity 作為 styleVariant（舊版概念）
      styleVariant: celebrity || null,
      withBag,
      withHat,
      withCoat,
    };
  }, [gender, category, age, height, weight, temp, style, paletteId, scenario, celebrity, withBag, withHat, withCoat]);

  // -------------------------
  // Auth
  // -------------------------
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

  useEffect(() => {
    refreshMe();

    const { data } = supabaseBrowser.auth.onAuthStateChange(() => {
      refreshMe();
    });

    return () => {
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogleLogin() {
    try {
      setStatus("");
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

  // -------------------------
  // Data loaders
  // -------------------------
  async function loadExplore() {
    setLoadingExplore(true);
    try {
      const data = await apiGetJson<{ ok: boolean; items: ExploreItem[] }>("/api/explore?limit=10&sort=like&ts=" + Date.now());
      setExplore(data?.items || []);
    } catch {
      setExplore([]);
    } finally {
      setLoadingExplore(false);
    }
  }

  async function loadRecent() {
    if (!isAuthed) {
      setRecent([]);
      return;
    }
    setLoadingRecent(true);
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>("/api/outfits?op=recent&limit=10&ts=" + Date.now());
      setRecent(data?.items || []);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }

  async function loadFav() {
    if (!isAuthed) {
      setFavorites([]);
      return;
    }
    // 你舊版如果有 /api/favorites 或 /api/outfits?op=favorites，這裡會吃到；
    // 否則就顯示空狀態
    setLoadingFav(true);
    try {
      const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>("/api/outfits?op=favorites&limit=10&ts=" + Date.now());
      setFavorites(data?.items || []);
    } catch {
      setFavorites([]);
    } finally {
      setLoadingFav(false);
    }
  }

  useEffect(() => {
    loadExplore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 登入狀態改變才拉個人資料
    loadRecent();
    loadFav();
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
        setPreviewOpen(false);
        setDebugOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen, mobileMenuOpen]);

  // -------------------------
  // UX helpers
  // -------------------------
  function scrollToGenerator() {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyFromExplore(it: ExploreItem) {
    // 若 Explore 的 style 裡存了你當初的 payload，就能一鍵套用
    const s = (it as any)?.style || {};
    if (s.gender) setGender(s.gender);
    if (s.category) setCategory(s.category);
    if (typeof s.age === "number") setAge(s.age);
    if (typeof s.height === "number") setHeight(s.height);
    if (typeof s.weight === "number") setWeight(s.weight);
    if (typeof s.temp === "number") setTemp(s.temp);
    if (s.style) setStyle(s.style);
    if (s.paletteId) setPaletteId(s.paletteId);
    if (s.scenario) setScenario(s.scenario);
    if (s.styleVariant) setCelebrity(s.styleVariant);

    if (typeof s.withBag === "boolean") setWithBag(s.withBag);
    if (typeof s.withHat === "boolean") setWithHat(s.withHat);
    if (typeof s.withCoat === "boolean") setWithCoat(s.withCoat);

    setStatus("已套用風格，請確認條件後再生成。");
    scrollToGenerator();
  }

  // -------------------------
  // Generate flow
  // -------------------------
  async function persistGeneratedOutfitToDb({ image_url, specObj }: { image_url: string; specObj: any }) {
    // 這裡假設你的 image_url 是 public storage url
    // 若你後端已回 image_path / outfit_id，也可以直接用（你之前說現在拿得到 outfit id / image_path）
    const created = await apiPostJson<{ ok: boolean; item?: OutfitRow }>(`/api/outfits?op=create`, {
      image_url,
      // 讓後端存下你前端條件（對應 explore apply）
      style: payload,
      spec: specObj,
      summary: specObj?.summary || "",
      products: specObj?.products || null,
    });

    const id = created?.item?.id;
    if (!id) throw new Error("outfits create failed: missing id");

    setCurrentOutfitId(id);
    setCurrentShareUrl("");

    return { outfitId: id };
  }

  async function publishShare(outfitId: string) {
    const r = await apiPostJson<{ ok: boolean; share_url?: string; share_slug?: string }>(
      `/api/outfits?op=publish&id=${encodeURIComponent(outfitId)}`,
      {}
    );
    const shareUrl = r?.share_url || (r?.share_slug ? `/share/${r.share_slug}` : "");
    if (!shareUrl) throw new Error("publish failed: missing share_url");
    setCurrentShareUrl(shareUrl);
    return shareUrl;
  }

  async function handleGenerate() {
    if (!isAuthed) {
      setStatus("請先登入後才能生成。");
      return;
    }

    setStatus("正在分析條件…");
    setSpec(null);
    setImageUrl("");
    setCurrentOutfitId("");
    setCurrentShareUrl("");

    try {
      // 1) Spec（後端吃扁平欄位）
      const specResp = await apiPostJson<SpecResp>("/api/generate-outfit-spec", payload);
      if (!specResp || (specResp as any).ok === false) throw new Error((specResp as any)?.error || "SPEC failed");

      const specObj: any = (specResp as any).spec || specResp;
      setSpec(specObj);

      // 2) Image（帶 outfitSpec）
      setStatus("正在生成穿搭圖…");
      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", {
        ...payload,
        outfitSpec: { items: specObj?.items || [], summary: specObj?.summary || "" },
        aspectRatio: "9:16",
        imageSize: "1K",
      });

      if (!imgResp || (imgResp as any).ok === false) throw new Error((imgResp as any)?.error || "IMAGE failed");

      const url = (imgResp as any).image_url || "";
      if (!url) throw new Error("IMAGE failed: missing image_url");

      setImageUrl(url);

      // 3) Save outfit (private)
      setStatus("正在保存到我的最近生成…");
      const persisted = await persistGeneratedOutfitToDb({ image_url: url, specObj });

      // 4) Refresh personal lists
      await loadRecent();

      setStatus("完成 ✅（可按「分享」公開到 Explore）");
      setTab("recent");

      return persisted;
    } catch (e: any) {
      setStatus("生成失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleShare() {
    try {
      if (!isAuthed) {
        setStatus("請先登入後才能分享。");
        return;
      }
      if (!currentOutfitId) {
        setStatus("尚未有可分享的作品。請先生成。");
        return;
      }
      setStatus("正在發布到公開穿搭…");
      const url = await publishShare(currentOutfitId);
      setStatus("已發布 ✅");
      // publish 後 explore 會抓到（因為 is_public=true + share_slug not null）
      await loadExplore();
      window.location.href = url;
    } catch (e: any) {
      setStatus("分享失敗：" + (e?.message || "Unknown error"));
    }
  }

  const previewSrc = useMemo(() => imageUrl || "", [imageUrl]);

  // -------------------------
  // Buttons styles helpers
  // -------------------------
  function SegButton({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        className={`${styles.segBtn} ${active ? styles.segBtnActive : ""}`}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  // -------------------------
  // (Optional) Explore actions (如果你後端有做 like/share/apply op 才會真的生效)
  // -------------------------
  async function postExploreAction(op: "like" | "share" | "apply", id: string) {
    try {
      await apiPostJson(`/api/explore?op=${op}&id=${encodeURIComponent(id)}`, {});
      loadExplore();
    } catch (e: any) {
      setStatus(`${op} 失敗：` + (e?.message || "Unknown error"));
    }
  }

  return (
    <div className={styles.page}>
      {/* ================= Header ================= */}
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>

        {/* ✅ Links 靠右並貼近頭像：放到 headerRight */}
        <div className={styles.headerRight}>
          {/* Desktop nav */}
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
            <button className={styles.primaryBtn} onClick={handleGoogleLogin}>
              Google 登入
            </button>
          )}
        </div>

        {/* Mobile menu panel */}
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

      {/* ================= Hero ================= */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.h1}>幫你找到最棒的穿搭</h1>
          <p className={styles.p}>選條件 → 一鍵生成 → 分享到公開牆。精選會依收藏/互動排序。</p>

          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={scrollToGenerator}>
              開始設定
            </button>
            <a className={styles.secondaryBtn} href="/explore">
              先逛 Explore
            </a>
          </div>

          {!!status && <div className={styles.status}>{status}</div>}

          {/* ✅ 公開穿搭精選：放在展示區（你要求合併） */}
          <div className={styles.featuredBox}>
            <div className={styles.featuredTop}>
              <div className={styles.featuredTitle}>公開穿搭精選</div>
              <div className={styles.featuredSub}>依收藏/分享/套用等互動排序</div>
            </div>

            {loadingExplore ? (
              <div className={styles.muted}>載入中…</div>
            ) : explore.length ? (
              <div className={styles.exploreGrid}>
                {explore.slice(0, 10).map((it) => (
                  <div key={it.id} className={styles.exploreCard}>
                    <a className={styles.exploreThumb} href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                    </a>

                    <div className={styles.exploreMeta}>
                      <div className={styles.exploreMetaRow}>
                        <div className={styles.exploreTitle}>{it.share_slug ? "查看分享" : "查看"}</div>
                        <div className={styles.exploreCounts}>
                          <span>♥ {it.like_count ?? 0}</span>
                          <span>↗ {it.share_count ?? 0}</span>
                          <span>✓ {it.apply_count ?? 0}</span>
                        </div>
                      </div>
                      <div className={styles.exploreSub}>{it.style?.scenario || it.style?.style || "—"}</div>

                      <div className={styles.exploreActions}>
                        <button className={styles.smallBtn} onClick={() => postExploreAction("like", it.id)}>
                          喜歡
                        </button>
                        <button className={styles.smallBtn} onClick={() => postExploreAction("share", it.id)}>
                          分享
                        </button>
                        <button className={styles.smallBtnPrimary} onClick={() => applyFromExplore(it)}>
                          套用風格
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.muted}>目前沒有公開精選（需要先分享公開作品）</div>
            )}
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div className={styles.previewTitle}>預覽</div>
              <div className={styles.previewSub}>生成後顯示在這裡（點圖可放大）</div>
            </div>

            <div className={styles.previewBox}>
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.previewImg}
                  src={previewSrc}
                  alt="outfit preview"
                  onClick={() => setPreviewOpen(true)}
                />
              ) : (
                <div className={styles.previewEmpty}>
                  <div className={styles.previewEmptyTitle}>還沒有生成圖</div>
                  <div className={styles.previewEmptyDesc}>先到下方設定條件，再按「立即生成」</div>
                </div>
              )}
            </div>

            <div className={styles.previewActions}>
              {previewSrc ? (
                <>
                  <button className={styles.primaryBtn} onClick={handleShare}>
                    分享到公開牆
                  </button>
                  {currentShareUrl ? (
                    <a className={styles.ghostBtn} href={currentShareUrl}>
                      打開分享頁
                    </a>
                  ) : (
                    <span className={styles.muted}>分享後會產生分享頁連結</span>
                  )}
                </>
              ) : (
                <div className={styles.muted}>完成設定後，在下方按「立即生成」</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= Main ================= */}
      <main className={styles.mainGrid}>
        {/* ===== Left: generator ===== */}
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>穿搭條件</div>

          {/* 性別 */}
          <div className={styles.block}>
            <div className={styles.blockTitle}>性別</div>
            <div className={styles.segRow}>
              <SegButton active={gender === "male"} onClick={() => setGender("male")}>
                男
              </SegButton>
              <SegButton active={gender === "female"} onClick={() => setGender("female")}>
                女
              </SegButton>
              <SegButton active={gender === "neutral"} onClick={() => setGender("neutral")}>
                中性
              </SegButton>
            </div>
          </div>

          {/* 類別 */}
          <div className={styles.block}>
            <div className={styles.blockTitle}>類別</div>
            <div className={styles.segRow}>
              <SegButton active={category === "adult"} onClick={() => setCategory("adult")}>
                成人
              </SegButton>
              <SegButton active={category === "child"} onClick={() => setCategory("child")}>
                兒童
              </SegButton>
            </div>
          </div>

          {/* 身材 */}
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <div className={styles.label}>年齡</div>
              <input className={styles.input} type="number" value={age} onChange={(e) => setAge(clamp(parseInt(e.target.value || "0", 10) || 0, 1, 99))} />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>身高（cm）</div>
              <input className={styles.input} type="number" value={height} onChange={(e) => setHeight(clamp(parseInt(e.target.value || "0", 10) || 0, 80, 220))} />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>體重（kg）</div>
              <input className={styles.input} type="number" value={weight} onChange={(e) => setWeight(clamp(parseInt(e.target.value || "0", 10) || 0, 20, 200))} />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>溫度（°C）</div>
              <input className={styles.input} type="number" value={temp} onChange={(e) => setTemp(clamp(parseInt(e.target.value || "0", 10) || 0, -10, 45))} />
            </label>
          </div>

          {/* 風格（保留，後端需要） */}
          <div className={styles.block}>
            <div className={styles.blockTitle}>基本風格</div>
            <div className={styles.segRow}>
              {(["casual", "minimal", "street", "sporty", "smart"] as const).map((v) => (
                <SegButton key={v} active={style === v} onClick={() => setStyle(v)}>
                  {v === "casual" ? "休閒" : v === "minimal" ? "極簡" : v === "street" ? "街頭" : v === "sporty" ? "運動" : "Smart"}
                </SegButton>
              ))}
            </div>
          </div>

          {/* 配色 */}
          <div className={styles.block}>
            <div className={styles.blockTitle}>配色</div>
            <select className={styles.select} value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
              <option value="mono-dark">黑灰</option>
              <option value="mono-light">白灰</option>
              <option value="earth">大地</option>
              <option value="denim">丹寧</option>
            </select>
          </div>

          {/* 情境 */}
          <div className={styles.block}>
            <div className={styles.blockTitle}>穿搭情境</div>
            <div className={styles.choiceGrid}>
              {scenarioOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.choiceBtn} ${scenario === opt.value ? styles.choiceBtnActive : ""}`}
                  onClick={() => setScenario((cur) => (cur === opt.value ? "" : opt.value))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className={styles.smallHint}>（同一時間只選一個；再點一次可取消）</div>
          </div>

          {/* 名人 */}
          <div className={styles.block}>
            <div className={styles.blockTitle}>名人靈感</div>
            <div className={styles.choiceGrid}>
              {celebOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.choiceBtn} ${celebrity === opt.value ? styles.choiceBtnActive : ""}`}
                  onClick={() => setCelebrity((cur) => (cur === opt.value ? "" : opt.value))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className={styles.smallHint}>（只做穿搭靈感，不生成名人臉）</div>
          </div>

          {/* accessories */}
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

          {/* one generate */}
          <div className={styles.stickyAction}>
            <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>
              立即生成
            </button>
            {!isAuthed && <div className={styles.smallHint}>未登入無法生成，請先 Google 登入</div>}
          </div>
        </section>

        {/* ===== Right: tab panels ===== */}
        <section className={styles.panel}>
          <div className={styles.panelTopRow}>
            <div className={styles.panelTitle}>我的內容</div>

            <div className={styles.tabRow}>
              <button
                type="button"
                className={`${styles.tabBtn} ${tab === "featured" ? styles.tabBtnActive : ""}`}
                onClick={() => setTab("featured")}
              >
                公開精選
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${tab === "recent" ? styles.tabBtnActive : ""}`}
                onClick={() => {
                  setTab("recent");
                  loadRecent();
                }}
              >
                最新生成
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${tab === "fav" ? styles.tabBtnActive : ""}`}
                onClick={() => {
                  setTab("fav");
                  loadFav();
                }}
              >
                我的最愛
              </button>
            </div>
          </div>

          {tab === "featured" && (
            <div className={styles.tabBody}>
              <div className={styles.kv}>
                <div className={styles.k}>提示</div>
                <div className={styles.v}>
                  公開精選只會顯示 <b>is_public=true</b> 且有 <b>share_slug</b> 的作品（你按「分享」才會出現在這裡）。
                </div>
              </div>

              <div className={styles.miniGrid}>
                {explore.slice(0, 8).map((it) => (
                  <a key={it.id} className={styles.miniCard} href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}>
                    <div className={styles.miniThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                    </div>
                    <div className={styles.miniMeta}>
                      <div className={styles.miniTitle}>{it.summary?.slice?.(0, 24) || "查看"}</div>
                      <div className={styles.miniSub}>{it.style?.scenario || it.style?.style || "—"}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {tab === "recent" && (
            <div className={styles.tabBody}>
              {!isAuthed ? (
                <div className={styles.muted}>請先登入以查看最新生成。</div>
              ) : loadingRecent ? (
                <div className={styles.muted}>載入中…</div>
              ) : recent.length ? (
                <div className={styles.miniGrid}>
                  {recent.map((it) => (
                    <a
                      key={it.id}
                      className={styles.miniCard}
                      href={it.share_slug ? `/share/${it.share_slug}` : "#"}
                      onClick={(e) => {
                        if (!it.share_slug) e.preventDefault();
                      }}
                    >
                      <div className={styles.miniThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                      </div>
                      <div className={styles.miniMeta}>
                        <div className={styles.miniTitle}>{it.summary?.slice?.(0, 24) || "未命名穿搭"}</div>
                        <div className={styles.miniSub}>
                          {it.share_slug ? "已分享" : "未分享（按右上分享）"}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className={styles.muted}>尚未有生成紀錄</div>
              )}
            </div>
          )}

          {tab === "fav" && (
            <div className={styles.tabBody}>
              {!isAuthed ? (
                <div className={styles.muted}>請先登入以查看我的最愛。</div>
              ) : loadingFav ? (
                <div className={styles.muted}>載入中…</div>
              ) : favorites.length ? (
                <div className={styles.miniGrid}>
                  {favorites.map((it) => (
                    <a key={it.id} className={styles.miniCard} href={it.share_slug ? `/share/${it.share_slug}` : "/my"}>
                      <div className={styles.miniThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                      </div>
                      <div className={styles.miniMeta}>
                        <div className={styles.miniTitle}>{it.summary?.slice?.(0, 24) || "我的最愛"}</div>
                        <div className={styles.miniSub}>{it.share_slug ? "分享作品" : "私人收藏"}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className={styles.muted}>目前沒有最愛（如果你還沒接 favorites API，這裡會是空的）</div>
              )}
            </div>
          )}

          {/* 生成資訊（不再占大版位，收成可折疊 debug） */}
          <div className={styles.bottomHintRow}>
            <button type="button" className={styles.debugBtn} onClick={() => setDebugOpen((v) => !v)}>
              {debugOpen ? "關閉 Debug" : "開啟 Debug"}
            </button>
            <span className={styles.muted}>
              Debug 不影響排版；生成/分享出錯時再打開看 detail
            </span>
          </div>
        </section>
      </main>

      {/* ================= Preview Modal ================= */}
      {previewOpen && (
        <div className={styles.modalBackdrop} onClick={() => setPreviewOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTop}>
              <div className={styles.modalTitle}>預覽放大</div>
              <button className={styles.modalClose} onClick={() => setPreviewOpen(false)}>
                關閉
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.modalImg} src={previewSrc} alt="preview" />
            </div>
          </div>
        </div>
      )}

      {/* ================= Debug Drawer (fixed) ================= */}
      {debugOpen && (
        <div className={styles.debugDrawer}>
          <div className={styles.debugTop}>
            <div className={styles.debugTitle}>Debug</div>
            <button className={styles.debugClose} onClick={() => setDebugOpen(false)}>
              ✕
            </button>
          </div>

          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>Auth</div>
            <pre className={styles.debugPre}>{safeJson(me)}</pre>
          </div>

          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>payload</div>
            <pre className={styles.debugPre}>{safeJson(payload)}</pre>
          </div>

          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>spec</div>
            <pre className={styles.debugPre}>{spec ? safeJson(spec) : "—"}</pre>
          </div>

          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>outfit</div>
            <pre className={styles.debugPre}>
              {safeJson({ currentOutfitId, currentShareUrl, imageUrl })}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
