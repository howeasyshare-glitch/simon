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

type SpecResp = { ok?: boolean; spec?: any; error?: string; detail?: any };
type ImgResp = { ok?: boolean; image_base64?: string; image_url?: string; error?: string; detail?: any };

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
  const [styleId, setStyleId] = useState<string>("street");
  const [paletteId, setPaletteId] = useState<string>("mono-dark");
  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // Flow
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");

  const generatorRef = useRef<HTMLElement | null>(null);

  const isAuthed = !!(me && (me as any).ok);

  /**
   * ✅ 修 Missing parameters 的核心：
   * 同時送 camelCase + snake_case + temperature alias
   * 讓後端不管檢查哪套 key 都會命中
   */
  const payload = useMemo(() => {
    const safeAge = Number.isFinite(age) ? age : 25;
    const safeHeight = Number.isFinite(height) ? height : 165;
    const safeWeight = Number.isFinite(weight) ? weight : 55;
    const safeTemp = Number.isFinite(temp) ? temp : 22;

    return {
      // camelCase（你原本用的）
      gender,
      age: safeAge,
      height: safeHeight,
      weight: safeWeight,
      temp: safeTemp,
      styleId,
      paletteId,
      withBag,
      withHat,
      withCoat,

      // snake_case（後端常見檢查）
      style_id: styleId,
      palette_id: paletteId,
      with_bag: withBag,
      with_hat: withHat,
      with_coat: withCoat,

      // 常見別名（有些用 temperature）
      temperature: safeTemp,
    };
  }, [gender, age, height, weight, temp, styleId, paletteId, withBag, withHat, withCoat]);

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

  useEffect(() => {
    refreshMe();

    // 登入狀態變化就刷新（登入/登出/自動 refresh）
    const { data } = supabaseBrowser.auth.onAuthStateChange(() => {
      refreshMe();
    });

    return () => {
      data.subscription.unsubscribe();
    };
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

      // user menu
      if (userMenuOpen) {
        const wrap = avatarWrapRef.current;
        if (wrap && !wrap.contains(t)) setUserMenuOpen(false);
      }

      // mobile menu
      // 點到 header 之外就關
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
    setImageUrl("");
    setImageBase64("");

    try {
      // Debug：如果還 missing parameters，你可以開 console 看 payload
      // console.log("generate payload =>", payload);

      // 1) Spec
      const specResp = await apiPostJson<SpecResp>("/api/generate-outfit-spec", { payload });
      if (!specResp || specResp.ok === false) throw new Error(specResp?.error || "SPEC failed");
      const s = (specResp as any).spec ?? specResp;
      setSpec(s);

      // 2) Image
      setStatus("正在生成穿搭圖…");
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
    if (imageBase64) return imageBase64;
    return "";
  }, [imageUrl, imageBase64]);

  const email = (me as any)?.user?.email || "";
  const avatarLetter = (email ? email[0] : "U").toUpperCase();
  const credits = (me as any)?.credits_left ?? "-";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>

        <div className={styles.headerRight}>
          {/* Desktop nav（在右側 cluster，貼近頭像） */}
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

      {/* ✅ Hero 改成更像導引列：短、清楚，避免像一個「功能區塊」 */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.h1}>幫你找到最棒的穿搭</h1>
          <p className={styles.p}>選條件 → 一鍵生成。結果會顯示在右側預覽。</p>

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

        {/* ✅ 右上：預覽 + 狀態 + Spec（折疊）合併成一張卡，避免四格切割 */}
        <div className={styles.heroRight}>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div className={styles.previewTitle}>預覽</div>
              <div className={styles.previewSub}>生成後會顯示在這裡</div>
            </div>

            <div className={styles.previewBox}>
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.previewImg} src={previewSrc} alt="outfit preview" />
              ) : (
                <div className={styles.previewEmpty}>
                  <div className={styles.previewEmptyTitle}>還沒有生成圖</div>
                  <div className={styles.previewEmptyDesc}>先到下方設定條件，再按「立即生成」</div>
                </div>
              )}
            </div>

            {/* ✅ 狀態 + Spec（折疊） */}
            <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>狀態</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{status || "—"}</div>

              {spec && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", opacity: 0.9, fontWeight: 900 }}>
                    展開 Spec
                  </summary>
                  <pre className={styles.pre} style={{ marginTop: 10 }}>
                    {JSON.stringify(spec, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Actions（目前仍保留跳頁，之後可接真正 share/save） */}
            <div className={styles.previewActions}>
              {previewSrc ? (
                <>
                  <a className={styles.primaryBtn} href="/share">
                    分享
                  </a>
                  <a className={styles.ghostBtn} href="/my">
                    存到我的穿搭
                  </a>
                </>
              ) : (
                <div className={styles.muted}>完成設定後，在左下的「立即生成」產生圖片</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ✅ 主工作區只保留：左=條件設定 / 右=（移除原生成資訊 panel） */}
      <main className={styles.mainGrid}>
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
                <option value="formal">正式</option>
              </select>
            </label>

            <label className={styles.field}>
              <div className={styles.label}>配色</div>
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

          {/* ✅ 唯一的生成按鈕 */}
          <div className={styles.stickyAction}>
            <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>
              立即生成
            </button>
            {!isAuthed && <div className={styles.smallHint}>未登入無法生成，請先 Google 登入</div>}
          </div>
        </section>

        {/* ✅ 右欄改成「提示/小抄」，不再是生成資訊大卡，讓版面更順 */}
        <section className={styles.panel}>
          <div className={styles.panelTitle}>小提示</div>
          <div className={styles.kv}>
            <div className={styles.k}>建議</div>
            <div className={styles.v}>
              先選風格與配色，再用溫度調整外套/層次。
              <br />
              如果生成失敗，先確認已登入，或稍後再試一次。
            </div>

            <div className={styles.k}>目前條件</div>
            <div className={styles.v}>
              <pre className={styles.pre}>{JSON.stringify(payload, null, 2)}</pre>
              <div className={styles.smallHint}>（這裡是 debug 用：若後端說缺參數，可直接對照）</div>
            </div>
          </div>
        </section>
      </main>

      {/* ✅ Explore 精選移到 mainGrid 下方：動線更自然 */}
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
