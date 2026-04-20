# PROJECT_CONTEXT.md

## 專案名稱
FindOutfit / Simon

## 專案目標
根據使用者條件與 AI 生成圖片，提供：
1. AI 穿搭生成圖
2. 對應的 outfit spec
3. 「查看單品」商品推薦
4. Explore / Share / Like / Apply 等社交互動

---

## 目前主要技術與環境

### 前端
- 現行頁面：`page.tsx`
- 舊頁面：`index.html`
- 目前正式流程以 `page.tsx` 為主，**不要再優先參考 `index.html` 判斷現行邏輯**

### 後端 API
- `pages/api/generate-outfit-spec.js`
- `pages/api/generate-image.js`
- `pages/api/search-products.js`
- `pages/api/data.js`

### 資料庫 / 儲存
- Supabase
- 主要資料：
  - `profiles`
  - `outfits`
  - `custom_products`
  - `user_settings`
  - `outfit_likes`
  - `admin_kv`

### 外部服務
- Gemini API：用於 outfit spec 與圖片生成相關流程
- SerpAPI / Google Shopping：用於商品搜尋

---

## 目前已確認的真實流程

### 1. 生成穿搭圖流程
`page.tsx`
→ 呼叫 `/api/generate-outfit-spec`
→ 取得 `summary + items`
→ 再用 spec / prompt 流程呼叫圖片生成
→ 再呼叫 `/api/data?op=products`
→ 展開「查看單品」

### 2. 查看單品流程
現行 UI 不是直接打 `/api/search-products`

現行實際流程是：
`page.tsx`
→ `/api/data?op=products`
→ `data.js / handleProducts()`
→ 先抓 `custom_products`
→ 不足時再補外部搜尋
→ 外部搜尋目前應接到 `/api/search-products`

### 3. 商品搜尋流程
`/api/search-products`
- 會根據 items 做 query
- 使用 Google Shopping / SerpAPI
- 現階段已有 ranking，但仍需繼續精修
- 目標是讓商品與 AI 圖更接近，而不是只抓到同類別商品

---

## 這輪已確認過的重要問題

### A. 現行頁面不是 `index.html`
- 之前誤以為 `index.html` 是現行頁面
- 已確認目前主流程在 `page.tsx`
- 後續排查前端問題，優先檢查 `page.tsx`

### B. `generate-outfit-spec` 前端曾送錯 body 格式
- `page.tsx` 曾把資料包成 `{ payload: {...} }`
- 新版 `generate-outfit-spec.js` 直接讀 `req.body.xxx`
- 已修正為直接送平面欄位

### C. Gemini 模型名稱曾過期
- `gemini-2.0-flash` 不可用
- `gemini-1.5-flash` 在當時設定也回 404
- 目前已改到可用模型（以當下可用設定為準）
- 後續建議把模型名稱改為 env，例如 `GEMINI_MODEL`

### D. `generate-outfit-spec` 曾先扣點再失敗
- 先前版本會先扣點，再呼叫 Gemini
- 若 Gemini 報錯，仍可能造成扣點
- 這是高風險點，後續應評估改成「成功後再扣點」或失敗補償

### E. 查看單品曾只顯示 custom 商品
- 原因：`/api/data?op=products` 沒有真正接到新的商品搜尋引擎
- 已修正成可補外部商品，不再只剩 custom

### F. 商品與 AI 圖仍有顯著落差
- 目前最核心未解問題
- 原因不是「沒商品」，而是：
  1. spec 還不夠像購物描述
  2. search ranking 還不夠嚴格
  3. 現在仍是文字搜尋商品，不是以圖搜圖

### G. 進頁未調整「基本輪廓」時，生成圖性別有時錯
- 使用者明確反映：
  - 進入頁面後未調整「基本輪廓」
  - 按下生成前 UI 顯示性別是男
  - 但生成圖偏女
- 代表目前 UI 顯示值、實際送出的 gender、或 prompt 組裝之間可能不同步
- 這是**高優先驗收問題**

---

## 目前架構判斷

### 已成功的部分
- API 串接大致打通
- `generate-outfit-spec` 可正常回 `summary + items`
- `/api/search-products` 可正常回 `grouped / flat`
- `/api/data?op=products` 可帶出商品，不再只有 custom

### 尚未完成的核心
1. 商品與 AI 圖一致性不足
2. 性別 / 輪廓條件與生成結果同步性不足
3. 商品 UI 體驗仍需優化（展開內容長、體驗不夠精準）

---

## 後續開發原則
- 不要優先大改 UI，先確認資料流與推薦精準度
- 先處理「生成條件是否正確送出」
- 再處理「商品是否像 AI 圖」
- 最後再做 UI 優化與視覺整理

---

## 下次新對話接手必看
若換新聊天室，請先理解以下三件事：
1. 目前現行頁面是 `page.tsx`，不是 `index.html`
2. 商品流程主入口是 `/api/data?op=products`
3. 最大問題不是「沒商品」，而是「商品與 AI 圖差距太大」與「性別條件可能失真`
