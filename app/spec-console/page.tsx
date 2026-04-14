"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";

type RecordState = {
  projectGoal: string;
  activeTask: string;
  acceptanceCriteria: string[];
  protectedAreas: string[];
  blockedFiles: string[];
  requiredChecks: string[];
  knownRisks: string[];
  notes: string;
  changedFilesText: string;
  productsJsonText: string;
  uiObservationsText: string;
};

const STORAGE_KEY = "findoutfit_spec_console_v2";

const DEFAULT_STATE: RecordState = {
  projectGoal: "避免修改後偏離既有需求，並能快速驗收 UI 與商品結果",
  activeTask: "本次任務",
  acceptanceCriteria: [
    "每個 slot 最多 3 個商品",
    "商品頁優先於搜尋頁",
    "Hero UI 不可跑版",
  ],
  protectedAreas: [
    "Hero 卡片結構",
    "like / share / apply 按鈕位置",
    "商品區塊位置（必須在 actions 下方）",
  ],
  blockedFiles: [
    "components/NavBar.tsx",
    "app/layout.tsx",
  ],
  requiredChecks: [
    "檢查 changed files 是否碰到 blocked files",
    "檢查 products 是否還有搜尋頁",
    "檢查每個 slot 是否超過 3 個商品",
    "檢查商品是否仍使用 generic label",
    "檢查 UI 是否有跑版觀察",
  ],
  knownRisks: [
    "商品 fallback 可能導致搜尋頁",
    "Hero 商品預覽區容易撐爆卡片",
  ],
  notes: "這版是紀錄驅動檢測，不直接控制生成或 API。",
  changedFilesText: "",
  productsJsonText: "",
  uiObservationsText: "",
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

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isSearchUrl(url?: string) {
  const v = String(url || "");
  return /google\.com\/search/i.test(v) || /tbm=shop/i.test(v) || /search\?/i.test(v);
}

function isGenericWord(value?: string) {
  const v = String(value || "").trim().toLowerCase();
  return ["top", "bottom", "shoes", "shoe", "item", "bag", "hat", "outer"].includes(v);
}

function parseProductsJson(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.products)) return parsed.products;
    return [];
  } catch {
    return [];
  }
}

export default function SpecConsolePage() {
  const [state, setState] = useState<RecordState>(DEFAULT_STATE);
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

  function update<K extends keyof RecordState>(key: K, value: RecordState[K]) {
    setState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSavedText("已儲存");
      setTimeout(() => setSavedText(""), 1800);
    } catch {
      setSavedText("儲存失敗");
      setTimeout(() => setSavedText(""), 1800);
    }
  }

  function resetAll() {
    setState(DEFAULT_STATE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
    setSavedText("已重設");
    setTimeout(() => setSavedText(""), 1800);
  }

  const changedFiles = useMemo(() => splitLines(state.changedFilesText), [state.changedFilesText]);
  const blockedFiles = useMemo(() => uniq(state.blockedFiles), [state.blockedFiles]);
  const touchedBlockedFiles = useMemo(
    () => changedFiles.filter((file) => blockedFiles.includes(file)),
    [changedFiles, blockedFiles]
  );

  const productGroups = useMemo(() => parseProductsJson(state.productsJsonText), [state.productsJsonText]);

  const productDetection = useMemo(() => {
    let searchUrlCount = 0;
    let tooManyCandidates = 0;
    let genericCount = 0;
    const issues: string[] = [];

    productGroups.forEach((group: any, idx: number) => {
      const slot = group?.slot || `group_${idx + 1}`;
      const label = group?.label || "";
      const description = group?.description || "";
      const candidates = Array.isArray(group?.candidates) ? group.candidates : [];

      if (candidates.length > 3) {
        tooManyCandidates += 1;
        issues.push(`${slot} 超過 3 個商品`);
      }

      if (isGenericWord(label) || isGenericWord(description)) {
        genericCount += 1;
        issues.push(`${slot} 使用過於泛的 label/description`);
      }

      candidates.forEach((c: any, i: number) => {
        if (isSearchUrl(c?.product_url || c?.url)) {
          searchUrlCount += 1;
          issues.push(`${slot} 第 ${i + 1} 個候選仍為搜尋頁`);
        }
      });
    });

    return {
      searchUrlCount,
      tooManyCandidates,
      genericCount,
      issues: uniq(issues),
    };
  }, [productGroups]);

  const uiIssues = useMemo(() => {
    const obs = state.uiObservationsText.toLowerCase();
    const issues: string[] = [];

    if (obs.includes("跑版")) issues.push("UI 觀察提到：跑版");
    if (obs.includes("撐爆")) issues.push("UI 觀察提到：區塊撐爆");
    if (obs.includes("按鈕不見")) issues.push("UI 觀察提到：按鈕不見");
    if (obs.includes("選單不見")) issues.push("UI 觀察提到：選單不見");
    if (obs.includes("超出")) issues.push("UI 觀察提到：內容超出範圍");

    return uniq(issues);
  }, [state.uiObservationsText]);

  const derivedChecks = useMemo(() => {
    const checks = state.acceptanceCriteria.map((item) => ({
      label: item,
      status:
        item.includes("最多 3 個商品")
          ? productDetection.tooManyCandidates === 0
          : item.includes("商品頁優先於搜尋頁")
          ? productDetection.searchUrlCount === 0
          : item.includes("Hero UI 不可跑版")
          ? uiIssues.length === 0
          : null,
    }));

    return checks;
  }, [state.acceptanceCriteria, productDetection, uiIssues]);

  const summary = useMemo(() => {
    const violations: string[] = [];

    touchedBlockedFiles.forEach((file) => violations.push(`碰到 blocked file：${file}`));
    productDetection.issues.forEach((item) => violations.push(item));
    uiIssues.forEach((item) => violations.push(item));

    return uniq(violations);
  }, [touchedBlockedFiles, productDetection, uiIssues]);

  const recordExport = useMemo(() => {
    return JSON.stringify(
      {
        projectGoal: state.projectGoal,
        activeTask: state.activeTask,
        acceptanceCriteria: state.acceptanceCriteria,
        protectedAreas: state.protectedAreas,
        blockedFiles: state.blockedFiles,
        requiredChecks: state.requiredChecks,
        knownRisks: state.knownRisks,
        notes: state.notes,
      },
      null,
      2
    );
  }, [state]);

  async function copyRecord() {
    try {
      await navigator.clipboard.writeText(recordExport);
      setSavedText("已複製紀錄");
      setTimeout(() => setSavedText(""), 1600);
    } catch {}
  }

  return (
    <main className={styles.page}>
      <div className={styles.specTopbar}>
        <div>
          <div className={styles.specEyebrow}>Spec Console</div>
          <h1 className={styles.specTitle}>FindOutfit Spec Console v2</h1>
          <p className={styles.specSub}>
            這版不控制生成。它負責記錄規則、整理本次任務，並依照紀錄內容做檢測與驗收。
          </p>
        </div>

        <div className={styles.specTopActions}>
          <Link href="/" className={styles.secondaryBtn}>回首頁</Link>
          <button type="button" className={styles.secondaryBtn} onClick={resetAll}>重設</button>
          <button type="button" className={styles.secondaryBtn} onClick={copyRecord}>複製紀錄</button>
          <button type="button" className={styles.primaryBtn} onClick={save}>儲存</button>
        </div>
      </div>

      <section className={styles.specGrid}>
        <div className={styles.specMain}>
          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>紀錄區：目標與任務</div>
            <label className={styles.specField}>
              <span>PROJECT GOAL</span>
              <textarea className={styles.specTextarea} value={state.projectGoal} onChange={(e) => update("projectGoal", e.target.value)} />
            </label>
            <label className={styles.specField}>
              <span>ACTIVE TASK</span>
              <textarea className={styles.specTextarea} value={state.activeTask} onChange={(e) => update("activeTask", e.target.value)} />
            </label>
          </div>

          <div className={styles.specTwoCol}>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>紀錄區：驗收標準</div>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.acceptanceCriteria)}
                onChange={(e) => update("acceptanceCriteria", splitLines(e.target.value))}
              />
            </div>

            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>紀錄區：不可破壞項目</div>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.protectedAreas)}
                onChange={(e) => update("protectedAreas", splitLines(e.target.value))}
              />
            </div>
          </div>

          <div className={styles.specTwoCol}>
            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>紀錄區：Blocked Files</div>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.blockedFiles)}
                onChange={(e) => update("blockedFiles", splitLines(e.target.value))}
              />
            </div>

            <div className={styles.specCard}>
              <div className={styles.specCardTitle}>紀錄區：本次應檢查項目</div>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.requiredChecks)}
                onChange={(e) => update("requiredChecks", splitLines(e.target.value))}
              />
            </div>
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>紀錄區：已知風險 / 備註</div>
            <label className={styles.specField}>
              <span>KNOWN RISKS</span>
              <textarea
                className={styles.specTextareaTall}
                value={joinLines(state.knownRisks)}
                onChange={(e) => update("knownRisks", splitLines(e.target.value))}
              />
            </label>
            <label className={styles.specField}>
              <span>NOTES</span>
              <textarea className={styles.specTextareaTall} value={state.notes} onChange={(e) => update("notes", e.target.value)} />
            </label>
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>檢測區：Changed Files</div>
            <p className={styles.specMiniHint}>把本次實際改動的檔案一行一個貼進來，用來檢查是否碰到 blocked files。</p>
            <textarea
              className={styles.specTextareaTall}
              value={state.changedFilesText}
              onChange={(e) => update("changedFilesText", e.target.value)}
              placeholder={"pages/api/data.js\ncomponents/HeroCarousel.tsx"}
            />
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>檢測區：Products JSON</div>
            <p className={styles.specMiniHint}>把 products API 回傳的 JSON 或 products 陣列貼進來，用來檢查搜尋頁比例、slot 數量與 generic label。</p>
            <textarea
              className={styles.specTextareaTall}
              value={state.productsJsonText}
              onChange={(e) => update("productsJsonText", e.target.value)}
              placeholder='{"products":[{"slot":"shoes","label":"white chunky sneakers","candidates":[{"title":"A","product_url":"https://..."}]}]}'
            />
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>檢測區：UI 觀察</div>
            <p className={styles.specMiniHint}>把你觀察到的 UI 結果簡單記錄，例如：跑版、撐爆、按鈕不見。</p>
            <textarea
              className={styles.specTextareaTall}
              value={state.uiObservationsText}
              onChange={(e) => update("uiObservationsText", e.target.value)}
              placeholder="例如：商品預覽卡第一個 slot 撐爆 Hero 卡片，其他 slot 看不到"
            />
          </div>
        </div>

        <aside className={styles.specSide}>
          <div className={styles.specStatusCard}>
            <div className={styles.specCardTitle}>驗收摘要</div>

            <div className={styles.specStatusRow}>
              <span>碰到 blocked files</span>
              <strong>{touchedBlockedFiles.length}</strong>
            </div>
            <div className={styles.specStatusRow}>
              <span>搜尋頁網址</span>
              <strong>{productDetection.searchUrlCount}</strong>
            </div>
            <div className={styles.specStatusRow}>
              <span>超過 3 個商品</span>
              <strong>{productDetection.tooManyCandidates}</strong>
            </div>
            <div className={styles.specStatusRow}>
              <span>generic label</span>
              <strong>{productDetection.genericCount}</strong>
            </div>
            <div className={styles.specStatusRow}>
              <span>UI 觀察異常</span>
              <strong>{uiIssues.length}</strong>
            </div>

            <div className={styles.specInfoBox}>
              <div className={styles.specInfoTitle}>依照驗收標準的檢查結果</div>
              <ul className={styles.specList}>
                {derivedChecks.length ? (
                  derivedChecks.map((check) => (
                    <li key={check.label}>
                      {check.status === true ? "✅" : check.status === false ? "❌" : "🟡"} {check.label}
                    </li>
                  ))
                ) : (
                  <li>尚未設定驗收標準</li>
                )}
              </ul>
            </div>

            <div className={styles.specInfoBox}>
              <div className={styles.specInfoTitle}>違規 / 待確認</div>
              <ul className={styles.specList}>
                {summary.length ? summary.map((item) => <li key={item}>{item}</li>) : <li>目前沒有明顯違規</li>}
              </ul>
            </div>

            <p className={styles.specHint}>
              這版的檢查結果會依你在紀錄區寫下的驗收標準來對照，不再只是固定寫死。
            </p>
          </div>

          <div className={styles.specPreviewCard}>
            <div className={styles.specCardTitle}>目前紀錄輸出</div>
            <pre className={styles.specPreview}>{recordExport}</pre>
          </div>
        </aside>
      </section>
    </main>
  );
}
