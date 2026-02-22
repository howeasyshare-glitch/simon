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
  like_count?: number;
};

type SpecResp = { error?: string; detail?: any; summary?: string; items?: any[]; credits_left?: number; is_tester?: boolean };
type ImgResp = { error?: string; detail?: any; image?: string; mime?: string; aspectRatio?: string; imageSize?: string };

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
  { id: "cream-warm", label: "奶油暖" }, // index.html 常見
  { id: "bright", label: "明亮" },
] as const;

type UiStyleSource = "none" | "scene" | "celeb";

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);

  // Explore
  const [explore, setExplore] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [exploreError, setExploreError] = useState<string>("");

  // Header UI
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  // ✅ Form (參考 index.html)
  const [gender, setGender] = useState<"male" | "female" | "neutral">("female");
  const [ageGroup, setAgeGroup] = useState<"adult" | "child">("adult");

  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  // style / palette / variant
  const [styleId, setStyleId] = useState<string>("casual");
  const [paletteId, setPaletteId] = useState<string>("mono-dark");
  const [styleVariant, setStyleVariant] = useState<string>(""); // 名人/品牌靈感
  const [uiStyleSource, setUiStyleSource] = useState<UiStyleSource>("none"); // scene/celeb

  // add-ons
  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // Flow
  const [status, setStatus] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  const [spec, setSpec] = useState<any>(null);
  const [previewSrc, setPreviewSrc] = useState<string>("");

  const generatorRef = useRef<HTMLElement | null>(null);
  const isAuthed = !!(me && (me as any).ok);

  const debugEnabled = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1";
    } catch {
      return false;
    }
  }, []);

  // ✅ 成人/兒童 slider 範圍（參考 index.html 的邏輯）
  const ranges = useMemo(() => {
    if (ageGroup === "child") {
      return {
        age: { min: 4, max: 16, step: 1, def: 10 },
        height: { min: 95, max: 170, step: 1, def: 140 },
        weight: { min: 12, max: 70, step: 1, def: 35 },
        temp: { min: 0, max: 35, step: 1, def: 22 },
      };
    }
    return {
      age: { min: 18, max: 60, step: 1, def: 28 },
      height: { min: 145, max: 195, step: 1, def: 165 },
      weight: { min: 40, max: 110, step: 1, def: 60 },
      temp: { min: 0, max: 35, step: 1, def: 22 },
    };
  }, [ageGroup]);

  // 切換成人/兒童時，自動把值拉回合理範圍
  useEffect(() => {
    setAge((v) => clamp(v, ranges.age.min, ranges.age.max));
    setHeight((v) => clamp(v, ranges.height.min, ranges.height.max));
    setWeight((v) => clamp(v, ranges.weight.min, ranges.weight.max));
    setTemp((v) => clamp(v, ranges.temp.min, ranges.temp.max));

    // 如果你希望切換時直接套預設值，改成下面這段即可：
    // setAge(ranges.age.def); setHeight(ranges.height.def); setWeight(ranges.weight.def); setTemp(ranges.temp.def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup]);

  // ✅ 後端要的 body（你前面已修好生成，我這裡延用）
  const apiBody = useMemo(() => {
    return {
      gender, // backend: male/female/other => neutral
      age,
      height,
      weight,
      style: styleId,
      styleVariant: styleVariant || undefined,
      temp,
      withBag,
      withHat,
      withCoat,

      // 前端輔助資料（後端忽略也沒關係）
      ageGroup,
      paletteId,
      uiStyleSource,
    };
  }, [gender, age, height, weight, styleId, styleVariant, temp, withBag, withHat, withCoat, ageGroup, paletteId, uiStyleSource]);

  // ====== Auth ======
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
    const { data } = supabaseBrowser.auth.onAuthStateChange(() => refreshMe());
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== Explore (多重 fallback + 顯示錯誤) ======
  async function refreshExplore() {
    setLoadingExplore(true);
    setExploreError("");
    try {
      // 依序嘗試（很多時候只是 query 不支援）
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
      setExploreError((lastErr as any)?.message || "Explore 載入失敗（未知原因）");
    } finally {
      setLoadingExplore(false);
    }
  }

  useEffect(() => {
    refreshExplore();
  }, []);

  // ====== Close menus ======
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

  // ====== Login (把錯誤顯示出來) ======
  async function handleGoogleLogin() {
    setLoginError("");
    setStatus("");
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      setStatus("正在跳轉到 Google 登入…");
    } catch (e: any) {
      const msg = e?.message || "Google 登入失敗（Unknown error）";
      setLoginError(msg);
      setStatus("登入失敗：" + msg);
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

  // ====== Explore actions（不阻斷 UI） ======
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
      setStatus("無法自動複製，請手動複製連結：" + url);
    }
    await trackExploreAction("share", it.id, { url });
  }

  function applyStyleToForm(it: ExploreItem) {
    const s = it?.style || {};

    // 兼容舊資料結構：style 可能本身就是 payload，或 style.payload
    const p = s?.payload || s;

    const g = p?.gender;
    const ag = p?.ageGroup || p?.audienceKey?.split?.("-")?.[0];

    if (g === "male" || g === "female" || g === "neutral") setGender(g);
    if (ag === "adult" || ag === "child") setAgeGroup(ag);

    if (Number.isFinite(Number(p?.age))) setAge(Number(p.age));
    if (Number.isFinite(Number(p?.height))) setHeight(Number(p.height));
    if (Number.isFinite(Number(p?.weight))) setWeight(Number(p.weight));
    if (Number.isFinite(Number(p?.temp))) setTemp(Number(p.temp));

    const st = p?.style || p?.styleId;
    if (typeof st === "string") setStyleId(st);

    if (typeof p?.paletteId === "string") setPaletteId(p.paletteId);
    if (typeof p?.styleVariant === "string") setStyleVariant(p.styleVariant);

    setWithBag(!!p?.withBag);
    setWithHat(!!p?.withHat);
    setWithCoat(!!p?.withCoat);

    setUiStyleSource((p?.uiStyleSource as UiStyleSource) || "none");

    setStatus("已套用這套穿搭的條件 ✅");
    scrollToGenerator();
    trackExploreAction("apply", it.id, { style: it.style });
  }

  // ====== index.html 風格 UI：情境 / 名人 ======
  const scenePresets = useMemo(() => {
    return [
      { label: "日常通勤", style: "smart", styleVariant: "scene-commute", paletteId: "mono-dark", src: "scene" as const },
      { label: "約會", style: "minimal", styleVariant: "scene-date", paletteId: "cream-warm", src: "scene" as const },
      { label: "旅行", style: "casual", styleVariant: "scene-travel", paletteId: "earth", src: "scene" as const },
      { label: "運動", style: "sporty", styleVariant: "scene-gym", paletteId: "bright", src: "scene" as const },
      { label: "聚會", style: "street", styleVariant: "scene-party", paletteId: "denim", src: "scene" as const },
      { label: "校園", style: "casual", styleVariant: "scene-campus", paletteId: "bright", src: "scene" as const },
    ];
  }, []);

  const celebPresets = useMemo(() => {
    // 這裡用你 index.html 常見的命名方式：celeb-xxx-style
    const female = [
      { label: "IU 日常", style: "casual", styleVariant: "celeb-iu-casual", paletteId: "cream-warm", src: "celeb" as const },
      { label: "Jennie 極簡", style: "minimal", styleVariant: "celeb-jennie-minimal", paletteId: "mono-dark", src: "celeb" as const },
      { label: "Lisa 運動", style: "sporty", styleVariant: "celeb-lisa-sporty", paletteId: "bright", src: "celeb" as const },
    ];
    const male = [
      { label: "GD 街頭", style: "street", styleVariant: "celeb-gd-street", paletteId: "mono-dark", src: "celeb" as const },
      { label: "乾淨 Smart", style: "smart", styleVariant: "celeb-smart-clean", paletteId: "mono-light", src: "celeb" as const },
      { label: "機能運動", style: "sporty", styleVariant: "celeb-athleisure", paletteId: "bright", src: "celeb" as const },
    ];
    const neutral = [
      { label: "中性極簡", style: "minimal", styleVariant: "brand-cos", paletteId: "mono-dark", src: "celeb" as const },
      { label: "中性街頭", style: "street", styleVariant: "brand-ader-error", paletteId: "mono-dark", src: "celeb" as const },
      { label: "中性日常", style: "casual", styleVariant: "", paletteId: "mono-dark", src: "celeb" as const },
    ];

    if (gender === "female") return female;
    if (gender === "male") return male;
    return neutral;
  }, [gender]);

  function applyPreset(p: { style: string; styleVariant: string; paletteId: string; src: UiStyleSource }) {
    setStyleId(p.style);
    setStyleVariant(p.styleVariant || "");
    setPaletteId(p.paletteId || "mono-dark");
    setUiStyleSource(p.src);
    setStatus(`已套用：${p.src === "scene" ? "穿搭情境" : "名人靈感"} ✅`);
  }

  // ====== Generate ======
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

  // ====== Shopping links ======
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

  // ====== Header derived ======
  const email = (me as any)?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  // ====== UI helpers ======
  function SegButton(props: { on: boolean; onClick: () => void; children: any }) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        style={{
          flex: 1,
          border: "1px solid rgba(255,255,255,0.12)",
          background: props.on ? "#ffffff" : "rgba(255,255,255,0.06)",
          color: props.on ? "#0b0d12" : "rgba(233,236,243,0.9)",
          borderRadius: 12,
          padding: "10px 10px",
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {props.children}
      </button>
    );
  }

  function SmallCard(props: { active?: boolean; title: string; sub: string; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        style={{
          textAlign: "left",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.10)",
          background: props.active ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.18)",
          padding: 12,
          cursor: "pointer",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 13 }}>{props.title}</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>{props.sub}</div>
      </button>
    );
  }

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
              {!!loginError && (
                <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,120,120,0.95)", maxWidth: 240, textAlign: "right" }}>
                  {loginError}
                </div>
              )}
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

      {/* ===== 上方：公開穿搭精選（展示區） ===== */}
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
              <div className={styles.exploreGrid} style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={styles.exploreCard} style={{ padding: 10 }}>
                    <div className={styles.exploreThumb} />
                    <div style={{ padding: 10, opacity: 0.6 }}>載入中…</div>
                  </div>
                ))}
              </div>
            ) : explore.length ? (
              <div className={styles.exploreGrid} style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                {explore.map((it) => (
                  <div
                    key={it.id}
                    className={styles.exploreCard}
                    style={{ display: "flex", flexDirection: "column" }}
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
                        <div className={styles.exploreTitle}>{it.summary?.title || "公開穿搭"}</div>
                        <div className={styles.exploreSub}>{it.style?.style || it.style?.styleId || "—"}</div>
                      </div>
                    </a>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1.2fr",
                        gap: 8,
                        padding: 10,
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
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
                目前沒有資料（可能 API 回傳不是 items，或 /api/explore 暫時不可用）
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== 主區：條件設定（參考 index.html） + 預覽/購買路徑 ===== */}
      <main className={styles.mainGrid} style={{ paddingTop: 8 }}>
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>穿搭條件</div>

          {/* 性別 segmented */}
          <div style={{ marginBottom: 12 }}>
            <div className={styles.label} style={{ marginBottom: 8 }}>
              性別
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <SegButton on={gender === "female"} onClick={() => setGender("female")}>
                女
              </SegButton>
              <SegButton on={gender === "male"} onClick={() => setGender("male")}>
                男
              </SegButton>
              <SegButton on={gender === "neutral"} onClick={() => setGender("neutral")}>
                中性
              </SegButton>
            </div>
          </div>

          {/* 成人/兒童 segmented */}
          <div style={{ marginBottom: 12 }}>
            <div className={styles.label} style={{ marginBottom: 8 }}>
              類別
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <SegButton on={ageGroup === "adult"} onClick={() => setAgeGroup("adult")}>
                成人
              </SegButton>
              <SegButton on={ageGroup === "child"} onClick={() => setAgeGroup("child")}>
                兒童
              </SegButton>
            </div>
          </div>

          {/* sliders (age/height/weight/temp) */}
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <div className={styles.label}>年齡：{age}</div>
              <input
                className={styles.input}
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
                className={styles.input}
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
                className={styles.input}
                type="range"
                min={ranges.weight.min}
                max={ranges.weight.max}
                step={ranges.weight.step}
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value, 10))}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.label}>氣溫（°C）：{temp}</div>
              <input
                className={styles.input}
                type="range"
                min={ranges.temp.min}
                max={ranges.temp.max}
                step={ranges.temp.step}
                value={temp}
                onChange={(e) => setTemp(parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          {/* 穿搭情境 / 名人靈感（index.html 的核心） */}
          <div style={{ marginTop: 14 }}>
            <div className={styles.label} style={{ marginBottom: 10 }}>
              穿搭情境
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {scenePresets.map((p) => (
                <SmallCard
                  key={p.label}
                  active={uiStyleSource === "scene" && styleVariant === p.styleVariant && styleId === p.style}
                  title={p.label}
                  sub={`${p.style} · ${p.paletteId}`}
                  onClick={() => applyPreset(p)}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className={styles.label} style={{ marginBottom: 10 }}>
              名人靈感（風格靈感，不模仿臉）
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {celebPresets.map((p) => (
                <SmallCard
                  key={p.label}
                  active={uiStyleSource === "celeb" && styleVariant === p.styleVariant && styleId === p.style}
                  title={p.label}
                  sub={`${p.style} · ${p.paletteId}`}
                  onClick={() => applyPreset(p)}
                />
              ))}
            </div>
          </div>

          {/* 風格 + 配色（保留） */}
          <div className={styles.formGrid} style={{ marginTop: 14 }}>
            <label className={styles.field}>
              <div className={styles.label}>風格</div>
              <select className={styles.select} value={styleId} onChange={(e) => { setStyleId(e.target.value); setUiStyleSource("none"); }}>
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
              <input
                className={styles.input}
                placeholder="例如：brand-uniqlo / celeb-iu-casual"
                value={styleVariant}
                onChange={(e) => { setStyleVariant(e.target.value); setUiStyleSource("none"); }}
              />
              <div className={styles.smallHint}>（通常由上面的情境/名人卡自動帶入）</div>
            </label>
          </div>

          {/* 配件 toggle */}
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

        {/* 右：預覽 + 購買路徑 */}
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
              <div className={styles.muted}>生成後會顯示「上衣 / 下身 / 鞋子 / 配件」等分類的購買連結</div>
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

          {debugEnabled && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 900 }}>Debug</summary>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>apiBody</div>
                <pre className={styles.pre}>{JSON.stringify(apiBody, null, 2)}</pre>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>spec</div>
                {spec ? <pre className={styles.pre}>{JSON.stringify(spec, null, 2)}</pre> : <div className={styles.muted}>—</div>}
              </div>
            </details>
          )}
        </section>
      </main>
    </div>
  );
}
