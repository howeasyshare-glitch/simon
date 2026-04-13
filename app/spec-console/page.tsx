"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";

type LiveSpecState = {
  mode: string;
  activeTask: string;
  generationRules: string[];
  productRules: string[];
  productTagHints: string[];
  sceneTagHint: string;
  maxProductsPerSlot: number;
  productStrategy: "direct_first" | "direct_only" | "search_fallback";
  notes: string;
};

const STORAGE_KEY = "findoutfit_spec_console_live";

const DEFAULT_STATE: LiveSpecState = {
  mode: "PRODUCT_OPTIMIZATION",
  activeTask: "提升商品與圖片一致性，優先直連 custom_products",
  generationRules: [
    "描述必須具體，包含 color / category / fit / style",
    "不可輸出 generic label，例如 top / bottom / shoes",
  ],
  productRules: [
    "每個 slot 最多 3 個商品",
    "優先使用 custom_products",
    "商品頁優先於搜尋頁",
  ],
  productTagHints: ["scene_casual", "adult"],
  sceneTagHint: "scene_casual",
  maxProductsPerSlot: 3,
  productStrategy: "direct_first",
  notes: "這頁內容會直接影響生成 prompt 與 products API，不再只是複製給 AI。",
};

function splitLines(value: string) {
  return value.split("\n").map((x) => x.trim()).filter(Boolean);
}

function joinLines(values: string[]) {
  return values.join("\n");
}

export default function SpecConsolePage() {
  const [state, setState] = useState<LiveSpecState>(DEFAULT_STATE);
  const [savedText, setSavedText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setState({
        ...DEFAULT_STATE,
        ...JSON.parse(raw),
      });
    } catch {}
  }, []);

  function update<K extends keyof LiveSpecState>(key: K, value: LiveSpecState[K]) {
    setState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSavedText("已啟用到生成流程");
      setTimeout(() => setSavedText(""), 1800);
    } catch {
      setSavedText("儲存失敗");
      setTimeout(() => setSavedText(""), 1800);
    }
  }

  function resetAll() {
    setState(DEFAULT_STATE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
    setSavedText("已重設為預設值");
    setTimeout(() => setSavedText(""), 1800);
  }

  const preview = useMemo(() => JSON.stringify(state, null, 2), [state]);

  return (
    <main className={styles.page}>
      <div className={styles.specTopbar}>
        <div>
          <div className={styles.specEyebrow}>Spec Console</div>
          <h1 className={styles.specTitle}>FindOutfit 控制台 v1.3</h1>
          <p className={styles.specSub}>
            這版會直接控制生成與商品流程。按下儲存後，Home 頁生成會自動讀取這些設定。
          </p>
        </div>

        <div className={styles.specTopActions}>
          <Link href="/" className={styles.secondaryBtn}>回首頁</Link>
          <button type="button" className={styles.secondaryBtn} onClick={resetAll}>重設</button>
          <button type="button" className={styles.primaryBtn} onClick={save}>儲存並啟用</button>
        </div>
      </div>

      <section className={styles.specGrid}>
        <div className={styles.specMain}>
          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>模式</div>
            <div className={styles.specModeRow}>
              {["PRODUCT_OPTIMIZATION", "SPEC_TUNING", "DEBUG"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={state.mode === mode ? styles.activePill : styles.pill}
                  onClick={() => update("mode", mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>這次任務</div>
            <label className={styles.specField}>
              <span>ACTIVE TASK</span>
              <textarea
                className={styles.specTextarea}
                value={state.activeTask}
                onChange={(e) => update("activeTask", e.target.value)}
              />
            </label>
          </div>

          <div className={styles.specTwoCol}>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>生成規則（直接影響 prompt）</div>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.generationRules)}
                onChange={(e) => update("generationRules", splitLines(e.target.value))}
              />
            </div>

            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>商品規則（直接影響 products API）</div>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.productRules)}
                onChange={(e) => update("productRules", splitLines(e.target.value))}
              />
            </div>
          </div>

          <div className={styles.specTwoCol}>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>商品 tag hints</div>
              <p className={styles.specMiniHint}>例如：scene_casual、adult、item_outerwear</p>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.productTagHints)}
                onChange={(e) => update("productTagHints", splitLines(e.target.value))}
              />
            </div>

            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>場景 tag hint</div>
              <label className={styles.specField}>
                <span>SCENE TAG</span>
                <input
                  className={styles.specTextarea}
                  value={state.sceneTagHint}
                  onChange={(e) => update("sceneTagHint", e.target.value)}
                />
              </label>

              <label className={styles.specField}>
                <span>每個 slot 商品數量</span>
                <input
                  type="number"
                  min={1}
                  max={3}
                  className={styles.specTextarea}
                  value={state.maxProductsPerSlot}
                  onChange={(e) => update("maxProductsPerSlot", Math.max(1, Math.min(Number(e.target.value || 3), 3)))}
                />
              </label>

              <label className={styles.specField}>
                <span>商品策略</span>
                <select
                  className={styles.specTextarea}
                  value={state.productStrategy}
                  onChange={(e) => update("productStrategy", e.target.value as LiveSpecState["productStrategy"])}
                >
                  <option value="direct_first">direct_first</option>
                  <option value="direct_only">direct_only</option>
                  <option value="search_fallback">search_fallback</option>
                </select>
              </label>
            </div>
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>備註</div>
            <textarea
              className={styles.specTextareaTall}
              value={state.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>

        <aside className={styles.specSide}>
          <div className={styles.specPreviewCard}>
            <div className={styles.specCardTitle}>目前 live config</div>
            <pre className={styles.specPreview}>{preview}</pre>
          </div>

          <div className={styles.specStatusCard}>
            <div className={styles.specCardTitle}>狀態</div>
            <div className={styles.specStatusRow}>
              <span>套用狀態</span>
              <strong>{savedText || "尚未更新"}</strong>
            </div>
            <p className={styles.specHint}>
              Home 頁的 handleGenerate 會自動讀取 <code>findoutfit_spec_console_live</code>，並把它傳給生成與商品 API。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
