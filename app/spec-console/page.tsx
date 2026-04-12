"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";

type LockPreset = {
  lockUI: boolean;
  lockCSS: boolean;
  lockStructure: boolean;
};

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
  blockedFilesManual: string[];
  notes: string;
  lockPreset: LockPreset;
};

const STORAGE_KEY = "findoutfit_spec_console_v11";

const DEFAULT_STATE: SpecState = {
  mode: "PRODUCT_OPTIMIZATION",
  activeTask: "提升商品與圖片一致性",
  goal: "商品更接近 AI 圖片，並盡量不影響既有穩定 UI",
  acceptance: "商品更精準；UI 不變；每個 slot ≤ 3",
  uiLock: [
    "Hero 卡片結構",
    "like / share / apply 按鈕位置",
    "商品區塊位置（必須在 actions 下方）",
    "主舞台卡片寬度與排列策略"
  ],
  productRules: [
    "每個 slot 最多 3 個商品",
    "優先使用 custom_products",
    "不可只用 top / bottom / shoes 當搜尋詞",
    "商品頁優先於搜尋頁"
  ],
  specRules: [
    "description 必須可用於商品搜尋",
    "label 不可 generic",
    "需包含 color / category / fit / style"
  ],
  currentProblems: [
    "部分商品仍 fallback 到搜尋頁",
    "舊資料沒有 products",
    "商品與圖片仍有落差"
  ],
  successCriteria: [
    "商品與圖片風格一致性提升",
    "點擊盡量直接進商品頁",
    "UI 不破版"
  ],
  allowedFiles: [
    "讓 AI 判斷（AUTO_BY_AI）"
  ],
  blockedFilesManual: [],
  notes: "這版支援自動鎖定，不用你自己猜哪些檔案要 blocked。先選鎖定等級，再複製給我。",
  lockPreset: {
    lockUI: true,
    lockCSS: true,
    lockStructure: true
  }
};

function splitLines(value: string) {
  return value.split("\n").map((x) => x.trim()).filter(Boolean);
}

function joinLines(value: string[]) {
  return value.join("\n");
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildSuggestedBlockedFiles(lockPreset: LockPreset) {
  const files: string[] = [];

  if (lockPreset.lockUI) {
    files.push("components/HeroCarousel.tsx");
    files.push("app/explore/page.tsx");
    files.push("app/my/page.tsx");
  }

  if (lockPreset.lockCSS) {
    files.push("app/page.module.css");
  }

  if (lockPreset.lockStructure) {
    files.push("components/NavBar.tsx");
    files.push("app/layout.tsx");
  }

  return uniq(files);
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
        lockPreset: {
          ...DEFAULT_STATE.lockPreset,
          ...(parsed?.lockPreset || {}),
        },
      });
    } catch {}
  }, []);

  function update<K extends keyof SpecState>(key: K, value: SpecState[K]) {
    setState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateLock<K extends keyof LockPreset>(key: K, value: LockPreset[K]) {
    setState((prev) => ({
      ...prev,
      lockPreset: {
        ...prev.lockPreset,
        [key]: value,
      },
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

  const suggestedBlockedFiles = useMemo(
    () => buildSuggestedBlockedFiles(state.lockPreset),
    [state.lockPreset]
  );

  const finalBlockedFiles = useMemo(
    () => uniq([...suggestedBlockedFiles, ...state.blockedFilesManual]),
    [suggestedBlockedFiles, state.blockedFilesManual]
  );

  const copyPayload = useMemo(() => {
    return [
      "【Spec Console v1.1】",
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
      "AUTO LOCK:",
      `- 鎖 UI：${state.lockPreset.lockUI ? "ON" : "OFF"}`,
      `- 鎖 CSS：${state.lockPreset.lockCSS ? "ON" : "OFF"}`,
      `- 鎖結構：${state.lockPreset.lockStructure ? "ON" : "OFF"}`,
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
      "SUGGESTED BLOCKED FILES:",
      ...suggestedBlockedFiles.map((x) => `- ${x}`),
      "",
      "FINAL BLOCKED FILES:",
      ...finalBlockedFiles.map((x) => `- ${x}`),
      "",
      "NOTES:",
      state.notes,
      "",
      "請先幫我做風險分析 + 區域鎖定判斷，再提出最小修改方案。",
    ].join("\n");
  }, [state, suggestedBlockedFiles, finalBlockedFiles]);

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
          <h1 className={styles.specTitle}>FindOutfit 控制台 v1.1</h1>
          <p className={styles.specSub}>
            先選鎖定等級，系統自動幫你產生建議的 blocked files，再一鍵複製給我。
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
            <div className={styles.specCardTitle}>自動鎖定</div>
            <div className={styles.specToggleGrid}>
              <label className={styles.specToggleItem}>
                <input
                  type="checkbox"
                  checked={state.lockPreset.lockUI}
                  onChange={(e) => updateLock("lockUI", e.target.checked)}
                />
                <span>鎖 UI</span>
              </label>

              <label className={styles.specToggleItem}>
                <input
                  type="checkbox"
                  checked={state.lockPreset.lockCSS}
                  onChange={(e) => updateLock("lockCSS", e.target.checked)}
                />
                <span>鎖 CSS</span>
              </label>

              <label className={styles.specToggleItem}>
                <input
                  type="checkbox"
                  checked={state.lockPreset.lockStructure}
                  onChange={(e) => updateLock("lockStructure", e.target.checked)}
                />
                <span>鎖結構</span>
              </label>
            </div>

            <div className={styles.specInfoBox}>
              <div className={styles.specInfoTitle}>系統建議 blocked files</div>
              <ul className={styles.specList}>
                {suggestedBlockedFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
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
              <div className={styles.specCardTitle}>額外手動 blocked files</div>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.blockedFilesManual)}
                onChange={(e) => update("blockedFilesManual", splitLines(e.target.value))}
              />
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
            <div className={styles.specStatusRow}>
              <span>最終 blocked files</span>
              <strong>{finalBlockedFiles.length} 個</strong>
            </div>
            <p className={styles.specHint}>
              這版重點：你不需要先知道哪些檔案要鎖。先選鎖定等級，再把 Spec 貼給我，我會先做風險分析。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
