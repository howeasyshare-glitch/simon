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
  style?: any; // 這裡會帶入原本儲存的 style payload
  like_count?: number;
};

type SpecResp = { error?: string; detail?: any; summary?: string; items?: any[]; credits_left?: number; is_tester?: boolean };
type ImgResp = { error?: string; detail?: any; image?: string; mime?: string; aspectRatio?: string; imageSize?: string };

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);

  // Explore
  const [explore, setExplore] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);

  // Header UI
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  // ✅ Form（補回你說跑掉的欄位）
  const [gender, setGender] = useState<"male" | "female" | "neutral">("male");
  const [scenario, setScenario] = useState<"adult" | "child">("adult"); // 情境：成人/兒童（後端目前不吃，但保留給前端與套用）
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  // 後端吃 style（casual/minimal/street/sporty/smart）
  const [styleId, setStyleId] = useState<string>("street");

  // ✅ 配色保留（後端目前不吃，但你說不錯想保留）
  const [paletteId, setPaletteId] = useState<string>("mono-dark");

  // ✅ 名人靈感（後端吃 styleVariant）
  const [styleVariant, setStyleVariant] = useState<string>(""); // "" or "celeb-iu-casual" etc.

  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // Flow
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);

  // Preview (data url)
  const [previewSrc, setPreviewSrc] = useState<string>("");

  const generatorRef = useRef<HTMLElement | null>(null);
  const isAuthed = !!(me && (me as any).ok);

  // ✅ debug only if URL has ?debug=1
  const debugEnabled = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1";
    } catch {
      return false;
    }
  }, []);

  // ✅ 產生給後端用的 body（保持你已能生成的格式）
  const apiBody = useMemo(() => {
    const safeAge = Number.isFinite(age) ? age : 25;
    const safeHeight = Number.isFinite(height) ? height : 165;
    const safeWeight = Number.isFinite(weight) ? weight : 55;
    const safeTemp = Number.isFinite(temp) ? temp : 22;

    return {
      gender, // 後端會把非 male/female 當 gender-neutral
      age: safeAge,
      height: safeHeight,
      weight: safeWeight,
      style: styleId,
      styleVariant: styleVariant || undefined,
      temp: safeTemp,
      withBag,
      withHat,
      withCoat,

      // 下面是前端自己需要（後端不吃也沒關係）
      scenario,
      paletteId,
    };
  }, [gender, age, height, weight, temp, styleId, styleVariant, withBag, withHat, withCoat, scenario, paletteId]);

  // ========= Auth =========
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

  // ========= Explore =========
  async function refreshExplore() {
    setLoadingExplore(true);
    try {
      const data = await apiGetJson<{ ok: boolean; items: ExploreItem[] }>(
        "/api/explore?limit=10&sort=like&ts=" + Date.now()
      );
      setExplore(data?.items || []);
    } catch {
      setExplore([]);
    } finally {
      setLoadingExplore(false);
    }
  }

  useEffect(() => {
    refreshExplore();
  }, []);

  // ========= UI close =========
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

  // ========= Actions on Explore =========
  async function trackExploreAction(action: "like" | "share" | "apply", id: string, meta?: any) {
    // ⚠️ 你專案原本有 like/share/apply 事件寫入 DB
    // 但這裡我無法確定你後端 API 的 exact 介面，所以採「不影響使用」的方式：
    // - 有 API 就會成功記錄
    // - 沒 API 也不會中斷操作
    try {
      await apiPostJson("/api/explore", { action, id, meta });
    } catch {
      // ignore
    }
  }

  async function handleLike(it: ExploreItem) {
    // optimistic UI（如果你 explore item 有 like_count 就更新一下）
    setExplore((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, like_count: (Number(x.like_count || 0) + 1) as any } : x))
    );
    await trackExploreAction("like", it.id);
    // 你也可以選擇 refreshExplore() 重新抓真實數據
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
    // 允許 s 來自不同版本字段，盡量兼容
    const g = s.gender ?? s.payload?.gender;
    const sc = s.scenario ?? s.payload?.scenario;
    const a = s.age ?? s.payload?.age;
    const h = s.height ?? s.payload?.height;
    const w = s.weight ?? s.payload?.weight;
    const t = s.temp ?? s.payload?.temp ?? s.temperature ?? s.payload?.temperature;
    const st = s.style ?? s.payload?.style ?? s.styleId ?? s.payload?.styleId; // 後端吃 style
    const pv = s.styleVariant ?? s.payload?.styleVariant;
    const pal = s.paletteId ?? s.payload?.paletteId;

    const bag = s.withBag ?? s.payload?.withBag ?? s.with_bag ?? s.payload?.with_bag;
    const hat = s.withHat ?? s.payload?.withHat ?? s.with_hat ?? s.payload?.with_hat;
    const coat = s.withCoat ?? s.payload?.withCoat ?? s.with_coat ?? s.payload?.with_coat;

    if (g === "male" || g === "female" || g === "neutral") setGender(g);
    if (sc === "adult" || sc === "child") setScenario(sc);

    if (Number.isFinite(Number(a))) setAge(Number(a));
    if (Number.isFinite(Number(h))) setHeight(Number(h));
    if (Number.isFinite(Number(w))) setWeight(Number(w));
    if (Number.isFinite(Number(t))) setTemp(Number(t));

    if (typeof st === "string" && st) {
      // 只接受後端支持的 style，否則保留原本
      const allowed = new Set(["casual", "minimal", "street", "sporty", "smart"]);
      if (allowed.has(st)) setStyleId(st);
    }

    if (typeof pv === "string") setStyleVariant(pv);
    if (typeof pal === "string" && pal) setPaletteId(pal);

    setWithBag(!!bag);
    setWithHat(!!hat);
    setWithCoat(!!coat);

    setStatus("已套用這套穿搭的風格與條件 ✅");
    scrollToGenerator();
    trackExploreAction("apply", it.id, { style: it.style });
  }

  // ========= Generate =========
  async function handleGenerate() {
    if (!isAuthed) {
      setStatus("請先登入後才能生成。");
      return;
    }

    setStatus("正在分析條件…");
    setSpec(null);
    setPreviewSrc("");

    try {
      // 1) Spec
      const specResp = await apiPostJson<SpecResp>("/api/generate-outfit-spec", apiBody);
      if (!specResp || (specResp as any).error) throw new Error((specResp as any)?.error || "SPEC failed");

      const s = {
        summary: (specResp as any).summary || "",
        items: Array.isArray((specResp as any).items) ? (specResp as any).items : [],
      };
      setSpec({ ...specResp, ...s });

      // 2) Image
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

  // ========= 購買路徑（依 slot 分類） =========
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

  // ========= Header derived =========
  const email = (me as any)?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  return (
    <div className={styles.page}>
      {/* ===== Header ===== */}
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

      {/* ===== Top showcase: 公開穿搭精選（把原本底部搬上來） ===== */}
      <section
        className={styles.hero}
        style={{
          gridTemplateColumns: "1fr",
          padding: "12px 18px 10px",
          gap: 12,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div className={styles.heroLeft} style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h1 className={styles.h1} style={{ fontSize: 22, margin: 0 }}>
                公開穿搭精選
              </h1>
              <p className={styles.p} style={{ margin: "6px 0 0" }}>
                點「套用風格」會把這套穿搭的條件帶入下方，直接生成你自己的版本。
              </p>
            </div>

            {/* ✅ 只留一個不吵的 CTA：開始生成 */}
            <button className={styles.primaryBtn} onClick={scrollToGenerator}>
              開始生成
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {loadingExplore ? (
              <div className={styles.muted}>載入中…</div>
            ) : explore.length ? (
              <div className={styles.exploreGrid} style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                {explore.map((it) => (
                  <div
                    key={it.id}
                    className={styles.exploreCard}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                    }}
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
                        <div className={styles.exploreSub}>
                          {it.style?.style || it.style?.styleId || it.style?.id || "—"}
                        </div>
                      </div>
                    </a>

                    {/* ✅ 每張卡片底下三個按鈕：喜歡/分享/套用風格 */}
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
              <div className={styles.muted}>目前沒有資料</div>
            )}
          </div>

          {!!status && <div className={styles.status}>{status}</div>}
        </div>
      </section>

      {/* ===== Main workspace ===== */}
      <main className={styles.mainGrid} style={{ paddingTop: 8 }}>
        {/* 左：條件設定（補回你說跑掉的欄位） */}
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>條件設定</div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <div className={styles.label}>性別</div>
              <select className={styles.select} value={gender} onChange={(e) => setGender(e.target.value as any)}>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="neutral">中性</option>
              </select>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>情境</div>
              <select className={styles.select} value={scenario} onChange={(e) => setScenario(e.target.value as any)}>
                <option value="adult">成人</option>
                <option value="child">兒童</option>
              </select>
              <div className={styles.smallHint}>（目前後端不使用，但可被「套用風格」帶入）</div>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>年齡</div>
              <input
                className={styles.input}
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value || "0", 10) || 0)}
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>身高（cm）</div>
              <input
                className={styles.input}
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value || "0", 10) || 0)}
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>體重（kg）</div>
              <input
                className={styles.input}
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value || "0", 10) || 0)}
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>溫度（°C）</div>
              <input
                className={styles.input}
                type="number"
                value={temp}
                onChange={(e) => setTemp(parseInt(e.target.value || "0", 10) || 0)}
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>風格</div>
              <select className={styles.select} value={styleId} onChange={(e) => setStyleId(e.target.value)}>
                <option value="casual">休閒</option>
                <option value="minimal">極簡</option>
                <option value="street">街頭</option>
                <option value="sporty">運動</option>
                <option value="smart">Smart Casual</option>
              </select>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>配色（保留）</div>
              <select className={styles.select} value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
                <option value="mono-dark">黑灰</option>
                <option value="mono-light">白灰</option>
                <option value="earth">大地</option>
                <option value="denim">丹寧</option>
              </select>
              <div className={styles.smallHint}>（目前後端不使用，但可用於之後 prompt 強化）</div>
            </label>

            <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <div className={styles.label}>名人靈感（可選）</div>
              <select className={styles.select} value={styleVariant} onChange={(e) => setStyleVariant(e.target.value)}>
                <option value="">無</option>
                <option value="celeb-iu-casual">IU（休閒）</option>
                <option value="celeb-jennie-minimal">Jennie（極簡）</option>
                <option value="celeb-gd-street">GD（街頭）</option>
                <option value="celeb-lisa-sporty">Lisa（運動）</option>
              </select>
              <div className={styles.smallHint}>選了會套用後端的 styleVariant prompt（不會生成名人臉）。</div>
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

          {/* ✅ 生成後：購買路徑（依上衣/褲子/鞋子等 slot 分類） */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>購買路徑</div>

            {!spec?.items?.length ? (
              <div className={styles.muted}>生成後會在這裡顯示「上衣 / 下身 / 鞋子 / 配件」等分類的購買連結</div>
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

          {/* ✅ Debug：不影響版面（?debug=1 才會出現） */}
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
