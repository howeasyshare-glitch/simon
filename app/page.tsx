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
    ],
    female: [
      { id: "scene-commute", title: "日常 / 上學", style: "casual", palette: "mono-light", variant: "scene-commute" },
      { id: "scene-date", title: "約會", style: "minimal", palette: "cream-warm", variant: "scene-date" },
      { id: "scene-party", title: "聚會 / 生日", style: "street", palette: "bright", variant: "scene-party" },
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
    ],
    female: [
      { id: "kid-school", title: "校園", style: "casual", palette: "bright", variant: "kid-school" },
      { id: "kid-party", title: "聚會", style: "smart", palette: "cream-warm", variant: "kid-party" },
    ],
    neutral: [
      { id: "kid-school", title: "校園", style: "casual", palette: "bright", variant: "kid-school" },
      { id: "kid-sport", title: "運動", style: "sporty", palette: "bright", variant: "kid-sport" },
    ],
  },
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatDate(ts?: string) {
  if (!ts) return "剛剛";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "剛剛";
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
}

function likedKey(outfitId: string) {
  return `liked_outfit_${outfitId}`;
}

function sharedKey(outfitId: string) {
  return `shared_outfit_${outfitId}`;
}

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [explore, setExplore] = useState<OutfitRow[]>([]);
  const [recent, setRecent] = useState<OutfitRow[]>([]);
  const [favorites, setFavorites] = useState<OutfitRow[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  const [gender, setGender] = useState<Gender>("female");
  const [audience, setAudience] = useState<Audience>("adult");
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);

  const [style, setStyle] = useState<string>("casual");
  const [palette, setPalette] = useState<string>("mono-dark");
  const [styleVariant, setStyleVariant] = useState<string>("");
  const [appliedPresetName, setAppliedPresetName] = useState("");

  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [products, setProducts] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imagePath, setImagePath] = useState<string>("");
  const [currentOutfitId, setCurrentOutfitId] = useState<string>("");
  const [currentShareUrl, setCurrentShareUrl] = useState<string>("");
  const [isFavoritedCurrent, setIsFavoritedCurrent] = useState(false);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState("");

  const generatorRef = useRef<HTMLElement | null>(null);
  const isAuthed = !!(me && (me as any).ok);
  const email = (me as any)?.user?.email || "";

  const scenes = useMemo(() => SCENES[audience]?.[gender] || [], [audience, gender]);

  async function authGetJson<T>(url: string): Promise<T> {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    const r = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    const text = await r.text();
    const j = text ? JSON.parse(text) : {};
    if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
    return j;
  }

  async function refreshMe() {
    try {
      const r = await apiFetch("/api/me?ts=" + Date.now(), { method: "GET" });
      if (r.status === 401) {
        setMe({ ok: false, error: "unauthorized" });
        return;
      }
      const text = await r.text();
      const j = text ? JSON.parse(text) : null;
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
      const data = await authGetJson<{ ok: boolean; items: OutfitRow[] }>(
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
    loadExplore();
    loadFavorites();
    const { data } = supabaseBrowser.auth.onAuthStateChange(() => {
      refreshMe();
      setTimeout(() => {
        loadRecent();
        loadFavorites();
      }, 350);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthed) loadRecent();
  }, [isAuthed]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("findoutfit_apply_preset");
      if (!raw) return;
      const preset = JSON.parse(raw);
      if (preset?.style) setStyle(preset.style);
      if (preset?.palette) setPalette(preset.palette);
      if (preset?.styleVariant) setStyleVariant(preset.styleVariant);
      if (preset?.label) {
        setAppliedPresetName(preset.label);
        setStatus(`已套用靈感：${preset.label}`);
      }
      localStorage.removeItem("findoutfit_apply_preset");
      setTimeout(() => {
        generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch {}
  }, []);

  function applyPreset(p: { style: string; palette: string; variant?: string; label?: string }) {
    setStyle(p.style);
    setPalette(p.palette);
    setStyleVariant(p.variant || "");
    setAppliedPresetName(p.label || "");
    setStatus(`已套用靈感：${p.label || p.style}`);
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function persistGeneratedOutfitToDb(args: { image_url?: string; image_path?: string; specObj: any }) {
    const created = await apiPostJson<{ ok: boolean; outfit?: OutfitRow }>(`/api/data?op=outfits.create`, {
      image_url: args.image_url || "",
      image_path: args.image_path || "",
      is_public: true,
      spec: args.specObj,
      style: { style, palette, styleVariant: styleVariant || null, audience, gender },
      summary: args.specObj?.summary || "",
      products: null,
    });

    const outfitId = created?.outfit?.id || "";
    setCurrentOutfitId(outfitId);
    const shareSlug = created?.outfit?.share_slug || "";
    setCurrentShareUrl(shareSlug ? `${window.location.origin}/share/${shareSlug}` : "");

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
        gender, age, height, weight, style, styleVariant: styleVariant || undefined, temp, withBag, withHat, withCoat,
      });

      const specObj = (specResp as any).spec || specResp;
      setSpec(specObj);

      setStatus("正在生成穿搭圖…");
      const imgResp = await apiPostJson<ImgResp>("/api/generate-image", {
        gender, age, height, weight, style, styleVariant: styleVariant || undefined, temp, withBag, withHat, withCoat,
        outfitSpec: { items: specObj?.items || [], summary: specObj?.summary || "" },
        aspectRatio: "9:16", imageSize: "1K",
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
      const alreadyLiked = localStorage.getItem(likedKey(currentOutfitId)) === "1";
      const op = alreadyLiked ? "outfits.unlike" : "outfits.like";

      const result = await apiPostJson<{ ok?: boolean; liked?: boolean; like_count?: number }>(`/api/data?op=${op}`, {
        outfit_id: currentOutfitId,
        anon_id: anonId,
      });

      if (result?.ok) {
        if (alreadyLiked) {
          localStorage.removeItem(likedKey(currentOutfitId));
          setIsFavoritedCurrent(false);
          setStatus("已取消最愛");
        } else {
          localStorage.setItem(likedKey(currentOutfitId), "1");
          setIsFavoritedCurrent(true);
          setStatus("已加入最愛 ✅");
        }
        await loadFavorites();
        await loadExplore();
      }
    } catch (e: any) {
      setStatus("收藏操作失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleCopyShare() {
    if (!currentShareUrl || !currentOutfitId) return;
    try {
      const shareKey = sharedKey(currentOutfitId);
      if (localStorage.getItem(shareKey) !== "1") {
        await apiPostJson(`/api/data?op=outfits.share`, { outfit_id: currentOutfitId });
        localStorage.setItem(shareKey, "1");
      }
      await navigator.clipboard.writeText(currentShareUrl);
      setStatus("已複製分享連結 ✅");
      await loadExplore();
    } catch (e: any) {
      setStatus("分享失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleExploreLike(it: OutfitRow) {
    try {
      let anonId = localStorage.getItem("findoutfit_anon_id");
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem("findoutfit_anon_id", anonId);
      }
      const alreadyLiked = localStorage.getItem(likedKey(it.id)) === "1";
      const op = alreadyLiked ? "outfits.unlike" : "outfits.like";
      const data = await apiPostJson<{ ok?: boolean; liked?: boolean; like_count?: number }>(`/api/data?op=${op}`, {
        outfit_id: it.id,
        anon_id: anonId,
      });
      if (!data?.ok) return;

      if (alreadyLiked) localStorage.removeItem(likedKey(it.id));
      else localStorage.setItem(likedKey(it.id), "1");

      setExplore((prev) => prev.map((x) => x.id === it.id ? { ...x, like_count: data.like_count ?? x.like_count } : x));
      await loadFavorites();
    } catch (e: any) {
      setStatus("收藏操作失敗：" + (e?.message || "Unknown error"));
    }
  }

  async function handleExploreShare(it: OutfitRow) {
    try {
      if (!it.share_slug) return;
      const key = sharedKey(it.id);
      if (localStorage.getItem(key) !== "1") {
        const data = await apiPostJson<{ ok?: boolean; share_count?: number }>(`/api/data?op=outfits.share`, {
          outfit_id: it.id,
        });
        if (data?.ok) {
          setExplore((prev) => prev.map((x) => x.id === it.id ? { ...x, share_count: data.share_count ?? x.share_count } : x));
        }
        localStorage.setItem(key, "1");
      }
      await navigator.clipboard.writeText(`${window.location.origin}/share/${it.share_slug}`);
      setStatus("已複製分享連結 ✅");
    } catch (e: any) {
      setStatus("分享失敗：" + (e?.message || "Unknown error"));
    }
  }

  const previewSrc = imageUrl || "";
  const strong = { color: "rgba(255,255,255,0.96)" } as const;
  const sub = { color: "rgba(255,255,255,0.84)" } as const;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>
        <nav className={styles.nav}>
          <a className={styles.navLink} href="/explore">Explore</a>
          <a className={styles.navLink} href="/my">我的穿搭</a>
          <a className={styles.navLink} href="/settings">設定</a>
        </nav>
        <div className={styles.headerRight}>
          {isAuthed ? <div className={styles.authHint} style={sub}>{email}</div> : (
            <button className={styles.primaryBtn} onClick={async () => {
              const redirectTo = `${window.location.origin}/auth/callback`;
              await supabaseBrowser.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
            }}>Google 登入</button>
          )}
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow} style={sub}>AI Outfit Generator</div>
          <h1 className={styles.h1} style={strong}>先逛靈感，再一鍵生成你的穿搭</h1>
          <p className={styles.p} style={sub}>公開穿搭精選會顯示高互動作品；Explore 可查看全部並排序。</p>
          {!!status && <div className={styles.status} style={strong}>{status}</div>}

          <div className={styles.featuredBox}>
            <div className={styles.featuredTop}>
              <div>
                <div className={styles.featuredTitle} style={strong}>公開穿搭精選</div>
                <div className={styles.featuredSub} style={sub}>首頁顯示精選作品，支援 like / 分享 / 套用 / 放大</div>
              </div>
            </div>

            {loadingExplore ? <div className={styles.muted} style={sub}>載入中…</div> : (
              <div className={styles.exploreGrid}>
                {explore.map((it) => {
                  const st = it.style || {};
                  const title = st.style || "Outfit";
                  const isLiked = typeof window !== "undefined" && localStorage.getItem(likedKey(it.id)) === "1";
                  return (
                    <div key={it.id} className={styles.exploreCard}>
                      <button
                        className={styles.exploreLink}
                        onClick={() => {
                          if (it.image_url) {
                            setZoomSrc(it.image_url);
                            setZoomOpen(true);
                          }
                        }}
                        style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "zoom-in" }}
                      >
                        <div className={styles.exploreThumb}>
                          {it.image_url ? <img src={it.image_url} alt={title} /> : <div className={styles.thumbEmpty} />}
                        </div>
                        <div className={styles.exploreMeta}>
                          <div className={styles.exploreTitle} style={strong}>{title}</div>
                          <div className={styles.exploreSub} style={sub}>{it.summary || `${st.palette || "palette"} · ${formatDate(it.created_at)}`}</div>
                        </div>
                      </button>

                      <div className={styles.exploreActions} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                        <button className={styles.smallBtn} onClick={() => handleExploreLike(it)}>
                          {isLiked ? "取消讚" : "Like"}
                        </button>
                        <button className={styles.smallBtn} onClick={() => handleExploreShare(it)}>分享</button>
                        <button
                          className={styles.smallBtnPrimary}
                          onClick={() =>
                            applyPreset({
                              style: st.style || "casual",
                              palette: st.palette || "mono-dark",
                              variant: st.styleVariant || "",
                              label: title,
                            })
                          }
                        >
                          套用
                        </button>
                        <a className={styles.smallBtn} href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}>查看</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div>
                <div className={styles.previewTitle} style={strong}>本次生成預覽</div>
                <div className={styles.previewSub} style={sub}>生成完成後會顯示在這裡，點圖可放大</div>
              </div>
            </div>
            <div className={styles.previewBox}>
              {previewSrc ? (
                <img
                  className={styles.previewImg}
                  src={previewSrc}
                  alt="outfit preview"
                  onClick={() => {
                    setZoomSrc(previewSrc);
                    setZoomOpen(true);
                  }}
                />
              ) : (
                <div className={styles.previewEmpty}>
                  <div className={styles.previewEmptyTitle} style={strong}>還沒有生成圖</div>
                  <div className={styles.previewEmptyDesc} style={sub}>在下方設定條件後按下「立即生成」</div>
                </div>
              )}
            </div>

            <div className={styles.previewSummary}>
              <div className={styles.summaryItem}><span className={styles.summaryLabel}>風格</span><span className={styles.summaryValue}>{style}</span></div>
              <div className={styles.summaryItem}><span className={styles.summaryLabel}>配色</span><span className={styles.summaryValue}>{palette}</span></div>
              <div className={styles.summaryItem}><span className={styles.summaryLabel}>套用</span><span className={styles.summaryValue}>{appliedPresetName || "未套用"}</span></div>
            </div>

            <div className={styles.previewActions}>
              {currentShareUrl ? <a className={styles.primaryBtn} href={currentShareUrl} target="_blank">開啟分享頁</a> : null}
              <button className={styles.ghostBtn} onClick={handleCopyShare} disabled={!currentShareUrl}>複製連結</button>
              <button className={styles.secondaryBtn} onClick={handleFavoriteCurrent} disabled={!currentOutfitId}>
                {isFavoritedCurrent ? "取消最愛" : "加到最愛"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className={styles.mainStack}>
        <section className={styles.generatorPanel} ref={generatorRef as any}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelEyebrow} style={sub}>Generator</div>
              <div className={styles.panelTitle} style={strong}>設定你的穿搭條件</div>
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockTitle} style={strong}>性別</div>
            <div className={styles.segRow}>
              {(["female", "male", "neutral"] as Gender[]).map((g) => (
                <button key={g} className={`${styles.segBtn} ${gender === g ? styles.segBtnActive : ""}`} onClick={() => setGender(g)}>
                  {g === "female" ? "女" : g === "male" ? "男" : "中性"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockTitle} style={strong}>對象</div>
            <div className={styles.segRow}>
              {(["adult", "child"] as Audience[]).map((a) => (
                <button key={a} className={`${styles.segBtn} ${audience === a ? styles.segBtnActive : ""}`} onClick={() => setAudience(a)}>
                  {a === "adult" ? "成人" : "兒童"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockTitle} style={strong}>快速情境</div>
            <div className={styles.choiceGrid}>
              {scenes.map((s) => (
                <button
                  key={s.id}
                  className={styles.choiceBtn}
                  onClick={() => applyPreset({ style: s.style, palette: s.palette, variant: s.variant, label: s.title })}
                >
                  <div className={styles.choiceTitle} style={strong}>{s.title}</div>
                  <div className={styles.choiceSub} style={sub}>{s.style} · {s.palette}</div>
                </button>
              ))}
            </div>
          </div>

          <details className={styles.advancedBox}>
            <summary className={styles.advancedSummary}>進階設定</summary>
            <div className={styles.formGrid}>
              <label className={styles.field}><div className={styles.label}>年齡</div><input className={styles.input} type="range" min={5} max={60} value={clamp(age, 5, 60)} onChange={(e) => setAge(parseInt(e.target.value || "0", 10) || 0)} /><div className={styles.muted} style={sub}>{age}</div></label>
              <label className={styles.field}><div className={styles.label}>身高（cm）</div><input className={styles.input} type="range" min={120} max={200} value={clamp(height, 120, 200)} onChange={(e) => setHeight(parseInt(e.target.value || "0", 10) || 0)} /><div className={styles.muted} style={sub}>{height}</div></label>
              <label className={styles.field}><div className={styles.label}>體重（kg）</div><input className={styles.input} type="range" min={30} max={120} value={clamp(weight, 30, 120)} onChange={(e) => setWeight(parseInt(e.target.value || "0", 10) || 0)} /><div className={styles.muted} style={sub}>{weight}</div></label>
              <label className={styles.field}><div className={styles.label}>氣溫（°C）</div><input className={styles.input} type="range" min={0} max={35} value={clamp(temp, 0, 35)} onChange={(e) => setTemp(parseInt(e.target.value || "0", 10) || 0)} /><div className={styles.muted} style={sub}>{temp}</div></label>
            </div>
            <div className={styles.toggles}>
              <label className={styles.toggle}><input type="checkbox" checked={withBag} onChange={(e) => setWithBag(e.target.checked)} /><span>加包包</span></label>
              <label className={styles.toggle}><input type="checkbox" checked={withHat} onChange={(e) => setWithHat(e.target.checked)} /><span>加帽子</span></label>
              <label className={styles.toggle}><input type="checkbox" checked={withCoat} onChange={(e) => setWithCoat(e.target.checked)} /><span>加外套</span></label>
            </div>
          </details>

          <div className={styles.stickyAction} style={{ marginTop: 16 }}>
            <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>立即生成</button>
          </div>

          <details className={styles.debugPanel}>
            <summary className={styles.debugSummary}>查看生成資訊</summary>
            <div className={styles.debugSection}><div className={styles.debugLabel}>狀態</div><div className={styles.debugValue}>{status || "—"}</div></div>
            <div className={styles.debugSection}><div className={styles.debugLabel}>Spec</div><div className={styles.debugValue}>{spec ? <pre className={styles.pre}>{JSON.stringify(spec, null, 2)}</pre> : <span style={sub}>尚未生成</span>}</div></div>
            <div className={styles.debugSection}><div className={styles.debugLabel}>購買路徑</div><div className={styles.debugValue}>{products ? <pre className={styles.pre}>{JSON.stringify(products, null, 2)}</pre> : <span style={sub}>尚未取得</span>}</div></div>
          </details>
        </section>

        <section className={styles.shelfSection}>
          <div className={styles.shelfHead}>
            <div>
              <div className={styles.panelTitle} style={strong}>最近 10 個生成</div>
              <div className={styles.sectionSub} style={sub}>快速回看你最近產生的穿搭</div>
            </div>
            <a className={styles.secondaryBtn} href="/my">看更多</a>
          </div>
          {loadingRecent ? <div style={sub}>載入中…</div> : (
            <div className={styles.shelfGrid}>
              {recent.map((it) => (
                <a key={it.id} className={styles.miniCard} href={it.is_public && it.share_slug ? `/share/${it.share_slug}` : "/my"}>
                  <div className={styles.miniThumb}>
                    {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                  </div>
                  <div className={styles.miniMeta}>
                    <div className={styles.miniTitle} style={strong}>{it.style?.style || "Outfit"}</div>
                    <div className={styles.miniSub} style={sub}>{formatDate(it.created_at)} · {it.is_public ? "已公開" : "未公開"}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className={styles.shelfSection}>
          <div className={styles.shelfHead}>
            <div>
              <div className={styles.panelTitle} style={strong}>我的最愛</div>
              <div className={styles.sectionSub} style={sub}>收藏後的靈感可以再回來重用</div>
            </div>
          </div>
          {loadingFav ? <div style={sub}>載入中…</div> : (
            <div className={styles.shelfGrid}>
              {favorites.map((it) => (
                <a key={it.id} className={styles.miniCard} href={it.share_slug ? `/share/${it.share_slug}` : "/my"}>
                  <div className={styles.miniThumb}>
                    {it.image_url ? <img src={it.image_url} alt="" /> : <div className={styles.thumbEmpty} />}
                  </div>
                  <div className={styles.miniMeta}>
                    <div className={styles.miniTitle} style={strong}>{it.style?.style || "Outfit"}</div>
                    <div className={styles.miniSub} style={sub}>{it.summary || "已收藏"}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>

      {zoomOpen && zoomSrc && (
        <div className={styles.modalBackdrop} onClick={() => setZoomOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTop}>
              <div className={styles.modalTitle} style={strong}>預覽大圖</div>
              <button className={styles.modalClose} onClick={() => setZoomOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <img src={zoomSrc} alt="zoom" className={styles.modalImg} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
