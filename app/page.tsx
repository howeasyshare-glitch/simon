"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

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

function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function apiGet<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { method: "GET", credentials: "include" });
  const text = await r.text();
  const j = safeJsonParse<T>(text);
  if (!r.ok) {
    const err: any = j || { error: text || `HTTP ${r.status}` };
    throw new Error(err?.error || err?.message || `HTTP ${r.status}`);
  }
  return (j as any) ?? ({} as any);
}

async function apiPost<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  const j = safeJsonParse<T>(text);
  if (!r.ok) {
    const err: any = j || { error: text || `HTTP ${r.status}` };
    throw new Error(err?.error || err?.message || `HTTP ${r.status}`);
  }
  return (j as any) ?? ({} as any);
}

export default function Home() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [explore, setExplore] = useState<ExploreItem[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);

  // Form (先做最小可用，之後再加完整的情境/名人/第二層)
  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState<number>(25);
  const [height, setHeight] = useState<number>(165);
  const [weight, setWeight] = useState<number>(55);
  const [temp, setTemp] = useState<number>(22);
  const [styleId, setStyleId] = useState<string>("street"); // 先用簡單枚舉
  const [paletteId, setPaletteId] = useState<string>("mono-dark");
  const [withBag, setWithBag] = useState<boolean>(false);
  const [withHat, setWithHat] = useState<boolean>(false);
  const [withCoat, setWithCoat] = useState<boolean>(false);

  // Flow
  const [status, setStatus] = useState<string>("");
  const [spec, setSpec] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");

  const isAuthed = !!(me && (me as any).ok);

  const payload = useMemo(() => {
    return {
      gender,
      age,
      height,
      weight,
      temp,
      styleId,
      paletteId,
      withBag,
      withHat,
      withCoat,
    };
  }, [gender, age, height, weight, temp, styleId, paletteId, withBag, withHat, withCoat]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<MeResp>("/api/me?ts=" + Date.now());
        setMe(data);
      } catch (e: any) {
        setMe({ ok: false, error: e?.message || "not authed" });
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingExplore(true);
      try {
        const data = await apiGet<{ ok: boolean; items: ExploreItem[] }>("/api/explore?limit=5&sort=like&ts=" + Date.now());
        setExplore(data?.items || []);
      } catch {
        setExplore([]);
      } finally {
        setLoadingExplore(false);
      }
    })();
  }, []);

  async function handleGenerate() {
    if (!isAuthed) {
      setStatus("請先登入後才能生成（可先用舊版登入）。");
      return;
    }

    setStatus("正在分析條件…");
    setSpec(null);
    setImageUrl("");
    setImageBase64("");

    try {
      // 1) Spec
      const specResp = await apiPost<SpecResp>("/api/generate-outfit-spec", { payload });
      if (!specResp || specResp.ok === false) throw new Error(specResp?.error || "SPEC failed");
      const s = (specResp as any).spec ?? specResp;
      setSpec(s);

      // 2) Image
      setStatus("正在生成穿搭圖…");
      const imgResp = await apiPost<ImgResp>("/api/generate-image", { payload, spec: s });
      if (!imgResp || imgResp.ok === false) throw new Error(imgResp?.error || "IMAGE failed");

      // 你可能回 base64 或 url（兩者都兼容）
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>findoutfit</div>

        <div className={styles.headerRight}>
          {isAuthed ? (
            <div className={styles.meBox}>
              <div className={styles.meEmail}>{(me as any)?.user?.email || "已登入"}</div>
              <div className={styles.meMeta}>
                <span>點數：{(me as any)?.credits_left ?? "-"}</span>
                <a className={styles.link} href="/settings">設定</a>
                <a className={styles.link} href="/my">我的穿搭</a>
              </div>
            </div>
          ) : (
            <div className={styles.authBox}>
              <div className={styles.authHint}>未登入：可看 Explore，但不能生成</div>
              <a className={styles.primaryBtn} href="/legacy/index.html">用舊版 Google 登入</a>
            </div>
          )}
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.h1}>幫你找到最棒的穿搭</h1>
          <p className={styles.p}>
            先把生成流程做順：快速選條件 → 一鍵生成 → 可再微調重跑。
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={handleGenerate} disabled={!isAuthed}>
              立即生成
            </button>
            <a className={styles.secondaryBtn} href="/explore">看看大家公開穿搭</a>
          </div>
          {!!status && <div className={styles.status}>{status}</div>}
        </div>

        <div className={styles.heroRight}>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div className={styles.previewTitle}>預覽</div>
              <div className={styles.previewSub}>圖最大｜生成最順（Phase A）</div>
            </div>

            <div className={styles.previewBox}>
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.previewImg} src={previewSrc} alt="outfit preview" />
              ) : (
                <div className={styles.previewEmpty}>
                  <div className={styles.previewEmptyTitle}>還沒有生成圖</div>
                  <div className={styles.previewEmptyDesc}>選好條件後按「立即生成」</div>
                </div>
              )}
            </div>

            <div className={styles.previewActions}>
              <button className={styles.primaryBtn} onClick={handleGenerate} disabled={!isAuthed}>
                產生穿搭圖
              </button>
              <a className={styles.ghostBtn} href={previewSrc ? "/share" : "/explore"}>
                {previewSrc ? "分享（下一階段接上）" : "去 Explore"}
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className={styles.mainGrid}>
        <section className={styles.panel}>
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

          <div className={styles.stickyAction}>
            <button className={styles.primaryBtnWide} onClick={handleGenerate} disabled={!isAuthed}>
              立即生成（A 版）
            </button>
            {!isAuthed && <div className={styles.smallHint}>未登入無法生成，可先用舊版登入</div>}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>生成資訊</div>

          <div className={styles.kv}>
            <div className={styles.k}>狀態</div>
            <div className={styles.v}>{status || "—"}</div>

            <div className={styles.k}>Spec</div>
            <div className={styles.v}>
              {spec ? (
                <pre className={styles.pre}>{JSON.stringify(spec, null, 2)}</pre>
              ) : (
                <span className={styles.muted}>尚未生成</span>
              )}
            </div>
          </div>

          <div className={styles.panelTitle} style={{ marginTop: 18 }}>
            公開穿搭精選
          </div>

          {loadingExplore ? (
            <div className={styles.muted}>載入中…</div>
          ) : explore.length ? (
            <div className={styles.exploreGrid}>
              {explore.map((it) => (
                <a key={it.id} className={styles.exploreCard} href={it.share_slug ? `/share/${it.share_slug}` : "/explore"}>
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

          <div className={styles.footerLinks}>
            <a className={styles.link} href="/explore">前往 Explore</a>
            <a className={styles.link} href="/legacy/index.html">回舊版首頁</a>
          </div>
        </section>
      </main>
    </div>
  );
}
