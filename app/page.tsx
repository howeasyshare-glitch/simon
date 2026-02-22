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

type SpecResp = { error?: string; detail?: any; credits_left?: number; is_tester?: boolean; summary?: string; items?: any[] };
type ImgResp = { error?: string; detail?: any; image?: string; mime?: string; aspectRatio?: string; imageSize?: string };

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [explore, setExplore] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);

  // Header UI
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  // Form
  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  // 你 UI 叫 styleId / paletteId，但後端吃的是 style（required）、styleVariant（optional）
  const [styleId, setStyleId] = useState<string>("street");
  const [paletteId, setPaletteId] = useState<string>("mono-dark"); // 目前後端未用到，先保留 UI
  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // Flow
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);

  // 預覽圖：用 data URL
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

  // ✅ 後端真正需要的 body（root keys）
  // /generate-outfit-spec 需要: gender, age, height, weight, style, temp, withBag/withHat/withCoat (styleVariant optional)
  const apiBody = useMemo(() => {
    const safeAge = Number.isFinite(age) ? age : 25;
    const safeHeight = Number.isFinite(height) ? height : 165;
    const safeWeight = Number.isFinite(weight) ? weight : 55;
    const safeTemp = Number.isFinite(temp) ? temp : 22;

    return {
      gender,
      age: safeAge,
      height: safeHeight,
      weight: safeWeight,

      // ✅ 後端吃 style，不吃 styleId
      style: styleId,

      // ✅ 後端吃 temp，不吃 temperature
      temp: safeTemp,

      withBag,
      withHat,
      withCoat,

      // 可選：目前你 UI 沒給 variant，就先不送或送 undefined
      // styleVariant: "brand-uniqlo" | ...
    };
  }, [gender, age, height, weight, temp, styleId, withBag, withHat, withCoat]);

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

    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Explore preview
  useEffect(() => {
    (async () => {
      setLoadingExplore(true);
      try {
        const data = await apiGetJson<{ ok: boolean; items: ExploreItem[] }>(
          "/api/explore?limit=5&sort=like&ts=" + Date.now()
        );
        setExplore(data?.items || []);
      } catch {
        setExplore([]);
      } finally {
        setLoadingExplore(false);
      }
    })();
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

  async function handleGenerate() {
    if (!isAuthed) {
      setStatus("請先登入後才能生成。");
      return;
    }

    setStatus("正在分析條件…");
    setSpec(null);
    setPreviewSrc("");

    try {
      // 1) Spec：後端直接吃 root keys（gender/age/height/weight/style/temp...）
      const specResp = await apiPostJson<SpecResp>("/api/generate-outfit-spec", apiBody);
      if (!specResp || (specResp as any).error) throw new Error((specResp as any)?.error || "SPEC failed");

      // generate-outfit-spec 回傳形狀：{summary, items, credits_left, ...}
      const s = {
        summary: (specResp as any).summary || "",
        items: Array.isArray((specResp as any).items) ? (specResp as any).items : [],
      };
      setSpec({ ...specResp, ...s });

      // 2) Image：後端要求 outfitSpec（且 outfitSpec.items 必須非空）
      setStatus("正在生成穿搭圖…");
      const imgBody = {
        ...apiBody,
        outfitSpec: s,
        // 可選：你後端支援這兩個
        // aspectRatio: "9:16",
        // imageSize: "1K",
      };

      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", imgBody);
      if (!imgResp || (imgResp as any).error) throw new Error((imgResp as any)?.error || "IMAGE failed");

      // ✅ 後端回傳：{image, mime}
      const b64 = (imgResp as any).image || "";
      const mime = (imgResp as any).mime || "image/png";
      if (!b64) throw new Error("No image returned");

      setPreviewSrc(`data:${mime};base64,${b64}`);

      setStatus("完成 ✅");
    } catch (e: any) {
      setStatus("生成失敗：" + (e?.message || "Unknown error"));
    }
  }

  const email = (me as any)?.user?.email || "";
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

      {/* ✅ 左上縮小：變成薄導引列（不再占大卡） */}
      <section
        className={styles.hero}
        style={{
          gridTemplateColumns: "1fr",
          padding: "12px 18px 6px",
          gap: 10,
        }}
      >
        <div className={styles.heroLeft} style={{ padding: 14 }}>
          <h1 className={styles.h1} style={{ fontSize: 26, marginBottom: 8 }}>
            幫你找到最棒的穿搭
          </h1>
          <p className={styles.p} style={{ marginBottom: 10 }}>
            選條件 → 一鍵生成。結果會顯示在右側預覽。
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
        </div>
      </section>

      {/* ✅ 主工作區：左=條件 / 右=預覽（sticky） */}
      <main className={styles.mainGrid} style={{ paddingTop: 8 }}>
        <section className={styles.panel} ref={generatorRef as any}>
          <div className={styles.panelTitle}>條件設定</div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <div className={styles.label}>性別</div>
              <select className={styles.select} value={gender} onChange={(e) => setGender(e.target.value as any)}>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
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
                <option value="street">街頭</option>
                <option value="casual">休閒</option>
                <option value="minimal">極簡</option>
                <option value="formal">正式（目前後端未對應）</option>
              </select>
              <div className={styles.smallHint}>
                後端 styleMap 支援：casual / minimal / street / sporty / smart（formal 可能會回到預設 casual）。
              </div>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>配色（目前後端未使用）</div>
              <select className={styles.select} value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
                <option value="mono-dark">黑灰</option>
                <option value="mono-light">白灰</option>
                <option value="earth">大地</option>
                <option value="denim">丹寧</option>
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

          {/* ✅ Debug 不影響版面：只有 ?debug=1 才出現，而且折疊 */}
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

      {/* Explore 精選 */}
      <section className={styles.panel} style={{ maxWidth: 1200, margin: "0 auto 28px" }}>
        <div className={styles.panelTitle}>公開穿搭精選</div>

        {loadingExplore ? (
          <div className={styles.muted}>載入中…</div>
        ) : explore.length ? (
          <div className={styles.exploreGrid}>
            {explore.map((it) => (
              <a
                key={it.id}
                className={styles.exploreCard}
                href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}
              >
                <div className={styles.exploreThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                </div>
                <div className={styles.exploreMeta}>
                  <div className={styles.exploreTitle}>{it.share_slug ? "查看分享" : "查看"}</div>
                  <div className={styles.exploreSub}>{it.style?.styleId || it.style?.id || "—"}</div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className={styles.muted}>目前沒有資料</div>
        )}
      </section>
    </div>
  );
}
