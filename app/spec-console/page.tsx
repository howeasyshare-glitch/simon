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

type DetectionResult = {
  ranAt: string;
  missingFields: string[];
  touchedBlockedFiles: string[];
  productSearchUrlCount: number;
  productTooManyCandidates: number;
  productGenericCount: number;
  productIssues: string[];
  uiIssues: string[];
  acceptanceChecks: Array<{ label: string; status: true | false | null }>;
  summary: string[];
};

const STORAGE_KEY = "findoutfit_spec_console_v21";

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

function detectFromState(state: RecordState): DetectionResult {
  const changedFiles = splitLines(state.changedFilesText);
  const blockedFiles = uniq(state.blockedFiles);
  const touchedBlockedFiles = changedFiles.filter((file) => blockedFiles.includes(file));

  const missingFields: string[] = [];
  if (!state.activeTask.trim()) missingFields.push("ACTIVE TASK");
  if (!state.acceptanceCriteria.length) missingFields.push("ACCEPTANCE CRITERIA");
  if (!state.requiredChecks.length) missingFields.push("REQUIRED CHECKS");
  if (!changedFiles.length) missingFields.push("CHANGED FILES");

  const wantsProductCheck = state.requiredChecks.some((x) => /products|搜尋頁|slot|generic/i.test(x));
  const wantsUICheck = state.requiredChecks.some((x) => /ui|跑版|按鈕|畫面/i.test(x));
  if (wantsProductCheck && !state.productsJsonText.trim()) missingFields.push("PRODUCTS JSON");
  if (wantsUICheck && !state.uiObservationsText.trim()) missingFields.push("UI OBSERVATIONS");

  const productGroups = parseProductsJson(state.productsJsonText);
  let productSearchUrlCount = 0;
  let productTooManyCandidates = 0;
  let productGenericCount = 0;
  const productIssues: string[] = [];

  productGroups.forEach((group: any, idx: number) => {
    const slot = group?.slot || `group_${idx + 1}`;
    const label = group?.label || "";
    const description = group?.description || "";
    const candidates = Array.isArray(group?.candidates) ? group.candidates : [];

    if (candidates.length > 3) {
      productTooManyCandidates += 1;
      productIssues.push(`${slot} 超過 3 個商品`);
    }

    if (isGenericWord(label) || isGenericWord(description)) {
      productGenericCount += 1;
      productIssues.push(`${slot} 使用過於泛的 label/description`);
    }

    candidates.forEach((c: any, i: number) => {
      if (isSearchUrl(c?.product_url || c?.url)) {
        productSearchUrlCount += 1;
        productIssues.push(`${slot} 第 ${i + 1} 個候選仍為搜尋頁`);
      }
    });
  });

  const obs = state.uiObservationsText.toLowerCase();
  const uiIssues: string[] = [];
  if (obs.includes("跑版")) uiIssues.push("UI 觀察提到：跑版");
  if (obs.includes("撐爆")) uiIssues.push("UI 觀察提到：區塊撐爆");
  if (obs.includes("按鈕不見")) uiIssues.push("UI 觀察提到：按鈕不見");
  if (obs.includes("選單不見")) uiIssues.push("UI 觀察提到：選單不見");
  if (obs.includes("超出")) uiIssues.push("UI 觀察提到：內容超出範圍");

  const acceptanceChecks = state.acceptanceCriteria.map((item) => ({
    label: item,
    status:
      item.includes("最多 3 個商品")
        ? productTooManyCandidates === 0
        : item.includes("商品頁優先於搜尋頁")
        ? productSearchUrlCount === 0
        : item.includes("Hero UI 不可跑版")
        ? uiIssues.length === 0
        : null,
  }));

  const summary = uniq([
    ...touchedBlockedFiles.map((file) => `碰到 blocked file：${file}`),
    ...productIssues,
    ...uiIssues,
  ]);

  return {
    ranAt: new Date().toLocaleString(),
    missingFields: uniq(missingFields),
    touchedBlockedFiles,
    productSearchUrlCount,
    productTooManyCandidates,
    productGenericCount,
    productIssues: uniq(productIssues),
    uiIssues: uniq(uiIssues),
    acceptanceChecks,
    summary,
  };
}

export default function SpecConsolePage() {
  const [state, setState] = useState<RecordState>(DEFAULT_STATE);
  const [savedText, setSavedText] = useState("");
  const [result, setResult] = useState<DetectionResult | null>(null);

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
    setResult(null);
    setSavedText("已重設");
    setTimeout(() => setSavedText(""), 1800);
  }

  function runDetection() {
    setResult(detectFromState(state));
  }

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
          <h1 className={styles.specTitle}>FindOutfit Spec Console v2.1</h1>
          <p className={styles.specSub}>
            這版加入明確的「一鍵檢測」、必填提示，以及它能檢查與不能檢查的說明。
          </p>
        </div>

        <div className={styles.specTopActions}>
          <Link href="/" className={styles.secondaryBtn}>回首頁</Link>
          <button type="button" className={styles.secondaryBtn} onClick={resetAll}>重設</button>
          <button type="button" className={styles.secondaryBtn} onClick={copyRecord}>複製紀錄</button>
          <button type="button" className={styles.secondaryBtn} onClick={save}>儲存</button>
          <button type="button" className={styles.primaryBtn} onClick={runDetection}>一鍵檢測</button>
        </div>
      </div>

      <section className={styles.specGrid}>
        <div className={styles.specMain}>
          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>它能檢查什麼 / 不能檢查什麼</div>
            <div className={styles.specInfoBox}>
              <div className={styles.specInfoTitle}>能檢查</div>
              <ul className={styles.specList}>
                <li>你貼進來的 changed files 是否碰到 blocked files</li>
                <li>你貼進來的 products JSON 是否仍為搜尋頁</li>
                <li>你貼進來的 products JSON 是否超過 3 個商品</li>
                <li>你貼進來的 products JSON 是否有 generic label</li>
                <li>你寫下的 UI 觀察是否提到跑版、撐爆、按鈕不見等異常</li>
              </ul>
            </div>
            <div className={styles.specInfoBox}>
              <div className={styles.specInfoTitle}>不能直接檢查</div>
              <ul className={styles.specList}>
                <li>不能只靠這個網頁自動讀取你整個 repo 的程式碼</li>
                <li>不能只靠這個網頁自動掃其它頁面的原始碼</li>
                <li>若要自動讀 repo 或自動抓 API，需另外接後端 / debug feed / git diff</li>
              </ul>
            </div>
          </div>

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
            <p className={styles.specMiniHint}>必填。把本次實際改動的檔案一行一個貼進來，用來檢查是否碰到 blocked files。</p>
            <textarea
              className={styles.specTextareaTall}
              value={state.changedFilesText}
              onChange={(e) => update("changedFilesText", e.target.value)}
              placeholder={"pages/api/data.js\ncomponents/HeroCarousel.tsx"}
            />
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>檢測區：Products JSON</div>
            <p className={styles.specMiniHint}>若你的 required checks 或 acceptance criteria 有商品相關檢查，這欄就必填。</p>
            <textarea
              className={styles.specTextareaTall}
              value={state.productsJsonText}
              onChange={(e) => update("productsJsonText", e.target.value)}
              placeholder='{"products":[{"slot":"shoes","label":"white chunky sneakers","candidates":[{"title":"A","product_url":"https://..."}]}]}'
            />
          </div>

          <div className={styles.specCard}>
            <div className={styles.specCardTitle}>檢測區：UI 觀察</div>
            <p className={styles.specMiniHint}>若你的 required checks 或 acceptance criteria 有 UI 檢查，這欄就必填。</p>
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
            <div className={styles.specCardTitle}>目前狀態</div>
            <div className={styles.specStatusRow}>
              <span>儲存狀態</span>
              <strong>{savedText || "尚未操作"}</strong>
            </div>
            <div className={styles.specStatusRow}>
              <span>檢測狀態</span>
              <strong>{result ? `已於 ${result.ranAt}` : "尚未執行"}</strong>
            </div>

            {result ? (
              <>
                <div className={styles.specInfoBox}>
                  <div className={styles.specInfoTitle}>檢測前置條件</div>
                  <ul className={styles.specList}>
                    {result.missingFields.length ? (
                      result.missingFields.map((item) => <li key={item}>缺少：{item}</li>)
                    ) : (
                      <li>必填資料完整，可以正常檢測</li>
                    )}
                  </ul>
                </div>

                <div className={styles.specStatusRow}>
                  <span>碰到 blocked files</span>
                  <strong>{result.touchedBlockedFiles.length}</strong>
                </div>
                <div className={styles.specStatusRow}>
                  <span>搜尋頁網址</span>
                  <strong>{result.productSearchUrlCount}</strong>
                </div>
                <div className={styles.specStatusRow}>
                  <span>超過 3 個商品</span>
                  <strong>{result.productTooManyCandidates}</strong>
                </div>
                <div className={styles.specStatusRow}>
                  <span>generic label</span>
                  <strong>{result.productGenericCount}</strong>
                </div>
                <div className={styles.specStatusRow}>
                  <span>UI 觀察異常</span>
                  <strong>{result.uiIssues.length}</strong>
                </div>

                <div className={styles.specInfoBox}>
                  <div className={styles.specInfoTitle}>依照驗收標準的檢查結果</div>
                  <ul className={styles.specList}>
                    {result.acceptanceChecks.length ? (
                      result.acceptanceChecks.map((check) => (
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
                    {result.summary.length ? result.summary.map((item) => <li key={item}>{item}</li>) : <li>目前沒有明顯違規</li>}
                  </ul>
                </div>
              </>
            ) : (
              <p className={styles.specHint}>
                先填紀錄區與檢測區，再按「一鍵檢測」。
              </p>
            )}
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
