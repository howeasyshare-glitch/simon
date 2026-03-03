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
};

type OutfitRow = {
  id: string;
  created_at?: string;
  share_slug?: string | null;
  is_public?: boolean;
  image_url?: string | null;
  image_path?: string | null;
  summary?: string | null;
  style?: any;
  spec?: any;
};

type SpecResp = { ok?: boolean; spec?: any; error?: string; detail?: any; items?: any[]; summary?: string };
type ImgResp = { ok?: boolean; image_url?: string; mime?: string; error?: string; detail?: any };

const LS_FAV_KEY = "findoutfit:fav_v1";

function makeSlug() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 10);
}

function extractPublicStoragePath(imageUrl: string) {
  // https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path...>
  const marker = "/storage/v1/object/public/";
  const i = imageUrl.indexOf(marker);
  if (i < 0) return { bucket: "", path: "" };
  const rest = imageUrl.slice(i + marker.length);
  const firstSlash = rest.indexOf("/");
  if (firstSlash < 0) return { bucket: rest, path: "" };
  return { bucket: rest.slice(0, firstSlash), path: rest.slice(firstSlash + 1) };
}

function readFavs(): string[] {
  try {
    const raw = localStorage.getItem(LS_FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeFavs(ids: string[]) {
  try {
    localStorage.setItem(LS_FAV_KEY, JSON.stringify(Array.from(new Set(ids)).slice(0, 200)));
  } catch {}
}

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);

  // Explore
  const [explore, setExplore] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);

  // Recent / fav
  const [recent, setRecent] = useState<OutfitRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [favMap, setFavMap] = useState<Record<string, OutfitRow>>({}); // outfit cache

  // Header UI
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  // Modal preview
  const [zoomOpen, setZoomOpen] = useState(false);

  // Form (依你說的：性別男/女/中性、類別成人/兒童、名人依性別、配色保留)
  const [gender, setGender] = useState<"male" | "female" | "neutral">("male");
  const [category, setCategory] = useState<"adult" | "child">("adult");

  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  const [styleId, setStyleId] = useState<string>("casual"); // 舊 API 期待 style (casual/minimal/street/sporty/smart)
  const [paletteId, setPaletteId] = useState<string>("mono-dark");

  const [styleVariant, setStyleVariant] = useState<string>(""); // 名人靈感/品牌等 variant

  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // Flow
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [currentOutfitId, setCurrentOutfitId] = useState<string>("");
  const [currentShareUrl, setCurrentShareUrl] = useState<string>("");

  const generatorRef = useRef<HTMLElement | null>(null);

  const isAuthed = !!(me && (me as any).ok);
  const email = (me as any)?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  const celebrityOptions = useMemo(() => {
    if (gender === "male") return ["celeb-gd-street", "celeb-jungkook-street", "celeb-v-minimal"];
    if (gender === "female") return ["celeb-iu-casual", "celeb-jennie-minimal", "celeb-lisa-sporty"];
    // neutral：取混合池
    return ["celeb-iu-casual", "celeb-jennie-minimal", "celeb-gd-street", "celeb-lisa-sporty"];
  }, [gender]);

  const payload = useMemo(() => {
    return {
      gender,
      category,
      age,
      height,
      weight,
      temp,
      style: styleId,
      styleVariant: styleVariant || undefined,
      paletteId,
      withBag,
      withHat,
      withCoat,
    };
  }, [gender, category, age, height, weight, temp, styleId, styleVariant, paletteId, withBag, withHat, withCoat]);

  async function refreshMe() {
    try {
      const r = await apiFetch("/api/me?ts=" + Date.now(), { method: "GET" });
      if (r.status === 401) {
        setMe({ ok: false, error: "unauthorized" });
        return;
      }
      const text = await r.text();
      const j = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();
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

  async function loadExplore() {
    setLoadingExplore(true);
    try {
      const data = await apiGetJson<{ ok: boolean; items: ExploreItem[] }>(
        "/api/explore?limit=6&sort=like&ts=" + Date.now()
      );
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
      const data = await apiGetJson<{ ok: boolean; items: OutfitRow[] }>(
        "/api/outfits?op=list&limit=10&ts=" + Date.now()
      );
      setRecent(data?.items || []);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }

  useEffect(() => {
    // 初次
    loadExplore();
    // fav ids
    setFavIds(typeof window !== "undefined" ? readFavs() : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRecent();
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

      if (zoomOpen) {
        const modal = document.querySelector(`.${styles.modalCard}`);
        if (modal && !modal.contains(t)) setZoomOpen(false);
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
  }, [userMenuOpen, mobileMenuOpen, zoomOpen]);

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

  function toggleFav(outfitId: string, row?: OutfitRow) {
    const current = readFavs();
    const exists = current.includes(outfitId);
    const next = exists ? current.filter((x) => x !== outfitId) : [outfitId, ...current];
    writeFavs(next);
    setFavIds(next);

    if (row) {
      setFavMap((m) => ({ ...m, [outfitId]: row }));
    }
  }

  async function ensurePublicShareForOutfit(outfitId: string) {
    const slug = makeSlug();
    const updated = await apiPostJson<{ ok: boolean; item?: OutfitRow }>(
      `/api/outfits?op=update&id=${encodeURIComponent(outfitId)}`,
      { is_public: true, share_slug: slug }
    );
    const shareUrl = `/share/${slug}`;
    setCurrentShareUrl(shareUrl);
    return shareUrl;
  }

  async function persistGeneratedOutfitToDb({ image_url, specObj }: { image_url: string; specObj: any }) {
    // 這裡用你的舊版 /api/outfits?op=create
    // 會把它寫到 DB，之後 Explore / Share / Recent 就都有來源
    const { bucket, path } = extractPublicStoragePath(image_url);

    const created = await apiPostJson<{ ok: boolean; item?: OutfitRow }>(`/api/outfits?op=create`, {
      // 盡量提供多欄位，後端如果不吃也沒關係
      image_url,
      image_bucket: bucket || undefined,
      image_path: path || undefined,

      is_public: false,
      share_slug: null,

      style: payload,
      spec: specObj,
      summary: specObj?.summary || "",
      products: specObj?.products || null,
    });

    const id = created?.item?.id;
    if (!id) throw new Error("outfits create failed: missing id");

    const shareUrl = await ensurePublicShareForOutfit(id);

    setCurrentOutfitId(id);
    setCurrentShareUrl(shareUrl);

    // 重新載入展示
    loadExplore();
    loadRecent();

    return { id, shareUrl };
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
      // 1) Spec（你後端目前吃的是扁平欄位，不要包 payload）
      const specResp = await apiPostJson<SpecResp>("/api/generate-outfit-spec", payload);
      if (!specResp || (specResp as any).ok === false) throw new Error((specResp as any)?.error || "SPEC failed");

      // 後端回傳可能是 {items, summary, credits_left...} 或 {spec:{...}}
      const specObj = (specResp as any).spec || specResp;
      setSpec(specObj);

      // 2) Image（同樣用扁平欄位，並帶 outfitSpec）
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

      // 3) Persist → 讓 Explore/Share/Recent 都有資料
      setStatus("正在建立分享與公開牆…");
      await persistGeneratedOutfitToDb({ image_url: url, specObj });

      setStatus("完成 ✅");
    } catch (e: any) {
      setStatus("生成失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleApplyStyleFromItem(item: ExploreItem | OutfitRow) {
    // 會把 style 內容帶入（你說套用會將所有屬性帶入）
    const s = (item as any)?.style || {};
    // 容錯：舊資料可能是 styleId / style / gender 等
    if (s.gender) setGender(s.gender);
    if (s.category) setCategory(s.category);
    if (typeof s.age === "number") setAge(s.age);
    if (typeof s.height === "number") setHeight(s.height);
    if (typeof s.weight === "number") setWeight(s.weight);
    if (typeof s.temp === "number") setTemp(s.temp);
    if (s.style) setStyleId(s.style);
    if (s.styleId) setStyleId(s.styleId);
    if (s.paletteId) setPaletteId(s.paletteId);
    if (s.styleVariant) setStyleVariant(s.styleVariant);
    if (s.withBag !== undefined) setWithBag(!!s.withBag);
    if (s.withHat !== undefined) setWithHat(!!s.withHat);
    if (s.withCoat !== undefined) setWithCoat(!!s.withCoat);

    setStatus("已套用這套穿搭的設定 ✅");
    scrollToGenerator();
  }

  const previewSrc = imageUrl || "";

  // 收藏卡片資料：優先用 recent + explore 做補齊，剩下用 favMap
  const favRows = useMemo(() => {
    const byId: Record<string, OutfitRow> = { ...favMap };
    for (const r of recent) byId[r.id] = byId[r.id] || r;
    for (const e of explore) {
      if (e.id) byId[e.id] = byId[e.id] || ({ id: e.id, share_slug: e.share_slug, image_url: e.image_url, style: e.style } as any);
    }
    return favIds.map((id) => byId[id]).filter(Boolean);
  }, [favIds, favMap, recent, explore]);

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

      {/* ===== Top showcase (展示 + 精選 + 最近/收藏) ===== */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.h1}>幫你找到最棒的穿搭</h1>
          <p className={styles.p}>設定條件 → 一鍵生成 → 分享或收藏。上方區塊以「展示」為主。</p>

          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={scrollToGenerator}>
              開始設定
            </button>
            <a className={styles.secondaryBtn} href="/explore">
              先逛 Explore
            </a>
          </div>

          {!!status && <div className={styles.status}>{status}</div>}

          {/* Recent + Favorites */}
          <div className={styles.showcaseBlock}>
            <div className={styles.showcaseTop}>
              <div className={styles.showcaseTitle}>最近 10 個生成</div>
              <button className={styles.ghostBtn} onClick={loadRecent}>
                重新整理
              </button>
            </div>

            {loadingRecent ? (
              <div className={styles.muted}>載入中…</div>
            ) : recent.length ? (
              <div className={styles.smallGrid}>
                {recent.map((r) => {
                  const share = r.share_slug ? `/share/${r.share_slug}` : "";
                  const img = r.image_url || "";
                  const isFav = favIds.includes(r.id);
                  return (
                    <div key={r.id} className={styles.smallCard}>
                      <a className={styles.smallThumb} href={share || "/my"}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={img} alt="" /> : <div className={styles.thumbEmpty} />}
                      </a>
                      <div className={styles.smallActions}>
                        <button
                          className={styles.smallBtn}
                          onClick={() => toggleFav(r.id, r)}
                          aria-pressed={isFav}
                        >
                          {isFav ? "已收藏" : "收藏"}
                        </button>
                        <button className={styles.smallBtn} onClick={() => handleApplyStyleFromItem(r)}>
                          套用
                        </button>
                        {share ? (
                          <a className={styles.smallBtnLink} href={share}>
                            分享
                          </a>
                        ) : (
                          <span className={styles.smallBtnLinkDisabled}>未分享</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.muted}>尚未生成（登入後生成一次就會出現）</div>
            )}
          </div>

          <div className={styles.showcaseBlock}>
            <div className={styles.showcaseTop}>
              <div className={styles.showcaseTitle}>我的最愛</div>
              <div className={styles.showcaseHint}>（暫用本機收藏；之後可升級 DB）</div>
            </div>

            {favRows.length ? (
              <div className={styles.smallGrid}>
                {favRows.slice(0, 10).map((r) => {
                  const share = r.share_slug ? `/share/${r.share_slug}` : "";
                  const img = r.image_url || "";
                  return (
                    <div key={r.id} className={styles.smallCard}>
                      <a className={styles.smallThumb} href={share || "/my"}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={img} alt="" /> : <div className={styles.thumbEmpty} />}
                      </a>
                      <div className={styles.smallActions}>
                        <button className={styles.smallBtn} onClick={() => toggleFav(r.id, r)}>
                          取消
                        </button>
                        <button className={styles.smallBtn} onClick={() => handleApplyStyleFromItem(r)}>
                          套用
                        </button>
                        {share ? (
                          <a className={styles.smallBtnLink} href={share}>
                            分享
                          </a>
                        ) : (
                          <span className={styles.smallBtnLinkDisabled}>未分享</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.muted}>先在「最近生成」按「收藏」就會出現在這裡</div>
            )}
          </div>

          {/* Explore highlight moved here */}
          <div className={styles.showcaseBlock}>
            <div className={styles.showcaseTop}>
              <div className={styles.showcaseTitle}>公開穿搭精選</div>
              <button className={styles.ghostBtn} onClick={loadExplore}>
                重新整理
              </button>
            </div>

            {loadingExplore ? (
              <div className={styles.muted}>載入中…</div>
            ) : explore.length ? (
              <div className={styles.exploreGrid}>
                {explore.map((it) => {
                  const shareUrl = it.share_slug ? `/share/${it.share_slug}` : "/explore";
                  const isFav = favIds.includes(it.id);
                  return (
                    <div key={it.id} className={styles.exploreWrap}>
                      <a className={styles.exploreCard} href={shareUrl}>
                        <div className={styles.exploreThumb}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                        </div>
                        <div className={styles.exploreMeta}>
                          <div className={styles.exploreTitle}>查看</div>
                          <div className={styles.exploreSub}>{it.style?.style || it.style?.styleId || "—"}</div>
                        </div>
                      </a>

                      <div className={styles.exploreActions}>
                        <button className={styles.chipBtn} onClick={() => toggleFav(it.id, it as any)} aria-pressed={isFav}>
                          {isFav ? "已喜歡" : "喜歡"}
                        </button>
                        <a className={styles.chipBtnLink} href={shareUrl}>
                          分享
                        </a>
                        <button className={styles.chipBtn} onClick={() => handleApplyStyleFromItem(it as any)}>
                          套用風格
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.muted}>目前沒有資料（生成後會自動出現在精選）</div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className={styles.heroRight}>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div className={styles.previewTitle}>預覽</div>
              <div className={styles.previewSub}>點擊圖片可放大</div>
            </div>

            <button
              className={styles.previewBoxBtn}
              onClick={() => previewSrc && setZoomOpen(true)}
              disabled={!previewSrc}
              aria-label="Open preview"
            >
              <div className={styles.previewBox}>
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.previewImg} src={previewSrc} alt="outfit preview" />
                ) : (
                  <div className={styles.previewEmpty}>
                    <div className={styles.previewEmptyTitle}>還沒有生成圖</div>
                    <div className={styles.previewEmptyDesc}>完成設定後按「立即生成」</div>
                  </div>
                )}
              </div>
            </button>

            <div className={styles.previewActions}>
              {previewSrc ? (
                <>
                  <a
                    className={styles.primaryBtn}
                    href={currentShareUrl || "#"}
                    onClick={(e) => {
                      if (!currentShareUrl) {
                        e.preventDefault();
                        setStatus("尚未建立分享連結，請先生成一次。");
                      }
                    }}
                  >
                    分享
                  </a>
                  <button
                    className={styles.ghostBtn}
                    onClick={() => {
                      if (!currentOutfitId) {
                        setStatus("尚未建立 outfit，請先生成一次。");
                        return;
                      }
                      toggleFav(currentOutfitId);
                      setStatus("已加入最愛 ✅");
                    }}
                  >
                    加入最愛
                  </button>
                </>
              ) : (
                <div className={styles.muted}>生成後會出現「分享 / 加入最愛」</div>
              )}
            </div>

            {/* Debug (不影響版面) */}
            <details className={styles.debug}>
              <summary>Debug</summary>
              <div className={styles.debugBody}>
                <div className={styles.debugLine}>isAuthed: {String(isAuthed)}</div>
                <div className={styles.debugLine}>outfitId: {currentOutfitId || "—"}</div>
                <div className={styles.debugLine}>shareUrl: {currentShareUrl || "—"}</div>
                <div className={styles.debugLine}>imageUrl: {imageUrl ? "yes" : "no"}</div>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ===== Main (generator + info + products placeholder) ===== */}
      <main className={styles.mainGrid}>
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>穿搭條件</div>

          <div className={styles.sectionTitle}>性別</div>
          <div className={styles.segRow}>
            <button
              className={`${styles.segBtn} ${gender === "male" ? styles.segBtnActive : ""}`}
              onClick={() => setGender("male")}
            >
              男
            </button>
            <button
              className={`${styles.segBtn} ${gender === "female" ? styles.segBtnActive : ""}`}
              onClick={() => setGender("female")}
            >
              女
            </button>
            <button
              className={`${styles.segBtn} ${gender === "neutral" ? styles.segBtnActive : ""}`}
              onClick={() => setGender("neutral")}
            >
              中性
            </button>
          </div>

          <div className={styles.sectionTitle}>類別</div>
          <div className={styles.segRow}>
            <button
              className={`${styles.segBtn} ${category === "adult" ? styles.segBtnActive : ""}`}
              onClick={() => setCategory("adult")}
            >
              成人
            </button>
            <button
              className={`${styles.segBtn} ${category === "child" ? styles.segBtnActive : ""}`}
              onClick={() => setCategory("child")}
            >
              兒童
            </button>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <div className={styles.label}>年齡</div>
              <input className={styles.input} type="number" value={age} onChange={(e) => setAge(parseInt(e.target.value || "0", 10) || 0)} />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>身高（cm）</div>
              <input className={styles.input} type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value || "0", 10) || 0)} />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>體重（kg）</div>
              <input className={styles.input} type="number" value={weight} onChange={(e) => setWeight(parseInt(e.target.value || "0", 10) || 0)} />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>溫度（°C）</div>
              <input className={styles.input} type="number" value={temp} onChange={(e) => setTemp(parseInt(e.target.value || "0", 10) || 0)} />
            </label>
          </div>

          <div className={styles.sectionTitle}>穿搭情境</div>
          <div className={styles.chipRow}>
            {[
              { id: "casual", name: "日常" },
              { id: "minimal", name: "極簡" },
              { id: "street", name: "街頭" },
              { id: "sporty", name: "運動" },
              { id: "smart", name: "Smart" },
            ].map((o) => (
              <button
                key={o.id}
                className={`${styles.chip} ${styleId === o.id ? styles.chipActive : ""}`}
                onClick={() => setStyleId(o.id)}
              >
                {o.name}
              </button>
            ))}
          </div>

          <div className={styles.sectionTitle}>名人靈感</div>
          <div className={styles.chipRow}>
            <button
              className={`${styles.chip} ${!styleVariant ? styles.chipActive : ""}`}
              onClick={() => setStyleVariant("")}
            >
              無
            </button>
            {celebrityOptions.map((id) => (
              <button
                key={id}
                className={`${styles.chip} ${styleVariant === id ? styles.chipActive : ""}`}
                onClick={() => setStyleVariant(id)}
              >
                {id.replace("celeb-", "").replaceAll("-", " ").toUpperCase()}
              </button>
            ))}
          </div>

          <div className={styles.sectionTitle}>配色</div>
          <div className={styles.chipRow}>
            {[
              { id: "mono-dark", name: "黑灰" },
              { id: "mono-light", name: "白灰" },
              { id: "earth", name: "大地" },
              { id: "denim", name: "丹寧" },
            ].map((o) => (
              <button
                key={o.id}
                className={`${styles.chip} ${paletteId === o.id ? styles.chipActive : ""}`}
                onClick={() => setPaletteId(o.id)}
              >
                {o.name}
              </button>
            ))}
          </div>

          <div className={styles.toggles}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={withBag} onChange={(e) => setWithBag(e.target.checked)} />
              <span>包包</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={withHat} onChange={(e) => setWithHat(e.target.checked)} />
              <span>帽子</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={withCoat} onChange={(e) => setWithCoat(e.target.checked)} />
              <span>外套</span>
            </label>
          </div>

          <div className={styles.stickyAction}>
            <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>
              立即生成
            </button>
            {!isAuthed && <div className={styles.smallHint}>未登入無法生成，請先 Google 登入</div>}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>生成資訊</div>

          <div className={styles.kv}>
            <div className={styles.k}>狀態</div>
            <div className={styles.v}>{status || "—"}</div>

            <div className={styles.k}>Share</div>
            <div className={styles.v}>
              {currentShareUrl ? (
                <a className={styles.inlineLink} href={currentShareUrl}>
                  {currentShareUrl}
                </a>
              ) : (
                <span className={styles.muted}>尚未建立</span>
              )}
            </div>

            <div className={styles.k}>Spec</div>
            <div className={styles.v}>
              {spec ? <pre className={styles.pre}>{JSON.stringify(spec, null, 2)}</pre> : <span className={styles.muted}>尚未生成</span>}
            </div>
          </div>

          <div className={styles.panelTitle} style={{ marginTop: 18 }}>
            購買路徑
          </div>
          <div className={styles.muted}>
            這區先保留（你說舊版有「上衣/褲子/鞋子」連到賣場）。等你把舊版 products 產出邏輯那支 API
            也貼上來，我再把這區完整接回。
          </div>
        </section>
      </main>

      {/* ===== Modal Preview ===== */}
      {zoomOpen && previewSrc && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalTop}>
              <div className={styles.modalTitle}>預覽放大</div>
              <button className={styles.modalClose} onClick={() => setZoomOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.modalImg} src={previewSrc} alt="preview large" />
            </div>
            <div className={styles.modalBottom}>
              {currentShareUrl ? (
                <a className={styles.primaryBtn} href={currentShareUrl}>
                  前往分享頁
                </a>
              ) : (
                <span className={styles.muted}>尚未建立分享連結</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
