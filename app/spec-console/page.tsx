"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";

type SpecState = {
  mode: string;
  activeTask: string;
  goal: string;
  acceptance: string;
  uiLock: string[];
  productRules: string[];
  specRules: string[];
  currentProblems: string[];
  successCriteria: string[];
  allowedFiles: string[];
  blockedFiles: string[];
  notes: string;
};

const STORAGE_KEY = "findoutfit_spec_console_v1";

const DEFAULT_STATE: SpecState = {
  mode: "PRODUCT_OPTIMIZATION",
  activeTask: "把商品連結改成直接商品頁",
  goal: "每個分類只顯示最接近的 3 個商品，並盡量直接進商品頁",
  acceptance: "每個 slot ≤ 3；商品連結優先為商品頁；不動 Hero UI",
  uiLock: [
    "Hero 卡片結構",
    "like / share / apply 按鈕位置",
    "商品區塊位置（必須在 actions 下方）",
    "page.module.css 主舞台尺寸策略",
  ],
  productRules: [
    "每個 slot 最多 3 個商品",
    "優先使用 custom_products",
    "不可只用 top / bottom / shoes 當搜尋詞",
    "商品頁優先於搜尋頁",
  ],
  specRules: [
    "description 必須可用於商品搜尋",
    "label 不可 generic",
    "需包含 color / category / fit / style",
  ],
  currentProblems: [
    "部分商品仍 fallback 到搜尋頁",
    "舊資料沒有 products",
    "商品與圖片仍有落差",
  ],
  successCriteria: [
    "商品與圖片風格一致性提升",
    "點擊盡量直接進商品頁",
    "UI 不破版",
  ],
  allowedFiles: [
    "pages/api/data.js",
    "pages/api/generate-outfit-spec.js",
    "app/page.tsx",
  ],
  blockedFiles: [
    "components/HeroCarousel.tsx",
    "app/page.module.css",
    "components/NavBar.tsx",
  ],
  notes: "先在這頁整理規範與任務，再按複製，把內容貼到對話裡協作。",
};

function splitLines(value: string) {
  return value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinLines(value: string[]) {
  return value.join("\n");
}

export default function SpecConsolePage() {
  const [state, setState] = useState<SpecState>(DEFAULT_STATE);
  const [savedText, setSavedText] = useState("");
  const [copiedText, setCopiedText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setState({
        ...DEFAULT_STATE,
        ...parsed,
      });
    } catch {}
  }, []);

  function update<K extends keyof SpecState>(key: K, value: SpecState[K]) {
    setState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSavedText("已儲存");
      setTimeout(() => setSavedText(""), 1600);
    } catch {
      setSavedText("儲存失敗");
      setTimeout(() => setSavedText(""), 1600);
    }
  }

  function resetAll() {
    setState(DEFAULT_STATE);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
    } catch {}
    setSavedText("已重設");
    setTimeout(() => setSavedText(""), 1600);
  }

  const copyPayload = useMemo(() => {
    return [
      "【Spec Console v1】",
      `MODE: ${state.mode}`,
      "",
      "ACTIVE TASK:",
      state.activeTask,
      "",
      "GOAL:",
      state.goal,
      "",
      "ACCEPTANCE:",
      state.acceptance,
      "",
      "UI LOCK:",
      ...state.uiLock.map((x) => `- ${x}`),
      "",
      "PRODUCT RULES:",
      ...state.productRules.map((x) => `- ${x}`),
      "",
      "SPEC RULES:",
      ...state.specRules.map((x) => `- ${x}`),
      "",
      "CURRENT PROBLEMS:",
      ...state.currentProblems.map((x) => `- ${x}`),
      "",
      "SUCCESS CRITERIA:",
      ...state.successCriteria.map((x) => `- ${x}`),
      "",
      "ALLOWED FILES:",
      ...state.allowedFiles.map((x) => `- ${x}`),
      "",
      "BLOCKED FILES:",
      ...state.blockedFiles.map((x) => `- ${x}`),
      "",
      "NOTES:",
      state.notes,
    ].join("\n");
  }, [state]);

  async function copySpec() {
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopiedText("已複製");
      setTimeout(() => setCopiedText(""), 1600);
    } catch {
      setCopiedText("複製失敗");
      setTimeout(() => setCopiedText(""), 1600);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.specTopbar}>
        <div>
          <div className={styles.specEyebrow}>Spec Console</div>
          <h1 className={styles.specTitle}>FindOutfit 控制台 v1</h1>
          <p className={styles.specSub}>
            先在這裡整理任務、限制與規範，再一鍵複製給我。
          </p>
        </div>

        <div className={styles.specTopActions}>
          <Link href="/" className={styles.secondaryBtn}>回首頁</Link>
          <button type="button" className={styles.secondaryBtn} onClick={resetAll}>重設</button>
          <button type="button" className={styles.secondaryBtn} onClick={save}>儲存</button>
          <button type="button" className={styles.primaryBtn} onClick={copySpec}>複製 Spec</button>
        </div>
      </div>

      <section className={styles.specGrid}>
        <div className={styles.specMain}>
          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>模式</div>
            <div className={styles.specModeRow}>
              {["UI_LOCK", "PRODUCT_OPTIMIZATION", "SPEC_TUNING", "DEBUG", "SAFE_REFACTOR"].map((mode) => (
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
            <div className={styles.specCardTitle}>任務定義</div>
            <label className={styles.specField}>
              <span>ACTIVE TASK</span>
              <textarea className={styles.specTextarea} value={state.activeTask} onChange={(e) => update("activeTask", e.target.value)} />
            </label>
            <label className={styles.specField}>
              <span>GOAL</span>
              <textarea className={styles.specTextarea} value={state.goal} onChange={(e) => update("goal", e.target.value)} />
            </label>
            <label className={styles.specField}>
              <span>ACCEPTANCE</span>
              <textarea className={styles.specTextarea} value={state.acceptance} onChange={(e) => update("acceptance", e.target.value)} />
            </label>
          </div>

          <div className={styles.specTwoCol}>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>UI LOCK</div>
              <textarea className={styles.specTextareaTall} value={joinLines(state.uiLock)} onChange={(e) => update("uiLock", splitLines(e.target.value))} />
            </div>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>CURRENT PROBLEMS</div>
              <textarea className={styles.specTextareaTall} value={joinLines(state.currentProblems)} onChange={(e) => update("currentProblems", splitLines(e.target.value))} />
            </div>
          </div>

          <div className={styles.specTwoCol}>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>PRODUCT RULES</div>
              <textarea className={styles.specTextareaTall} value={joinLines(state.productRules)} onChange={(e) => update("productRules", splitLines(e.target.value))} />
            </div>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>SPEC RULES</div>
              <textarea className={styles.specTextareaTall} value={joinLines(state.specRules)} onChange={(e) => update("specRules", splitLines(e.target.value))} />
            </div>
          </div>

          <div className={styles.specTwoCol}>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>ALLOWED FILES</div>
              <textarea className={styles.specTextareaTall} value={joinLines(state.allowedFiles)} onChange={(e) => update("allowedFiles", splitLines(e.target.value))} />
            </div>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>BLOCKED FILES</div>
              <textarea className={styles.specTextareaTall} value={joinLines(state.blockedFiles)} onChange={(e) => update("blockedFiles", splitLines(e.target.value))} />
            </div>
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>SUCCESS CRITERIA</div>
            <textarea className={styles.specTextareaTall} value={joinLines(state.successCriteria)} onChange={(e) => update("successCriteria", splitLines(e.target.value))} />
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>NOTES</div>
            <textarea className={styles.specTextareaTall} value={state.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
        </div>

        <aside className={styles.specSide}>
          <div className={styles.specPreviewCard}>
            <div className={styles.specCardTitle}>即將複製的內容</div>
            <pre className={styles.specPreview}>{copyPayload}</pre>
          </div>

          <div className={styles.specStatusCard}>
            <div className={styles.specCardTitle}>狀態</div>
            <div className={styles.specStatusRow}>
              <span>儲存</span>
              <strong>{savedText || "尚未操作"}</strong>
            </div>
            <div className={styles.specStatusRow}>
              <span>複製</span>
              <strong>{copiedText || "尚未操作"}</strong>
            </div>
            <p className={styles.specHint}>
              流程：先在這頁更新內容 → 按複製 Spec → 貼到對話裡。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
