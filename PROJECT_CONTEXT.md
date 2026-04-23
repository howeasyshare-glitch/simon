# PROJECT_CONTEXT.md

## 專案名稱
FindOutfit / Simon

## 專案目標
根據使用者條件生成穿搭圖，並提供相似單品推薦，讓使用者在「生成圖 → 查看單品 → 點商品」這條路徑中感受到一致性。

---

## 現行核心架構

### 前端
- 現行主頁：`app/page.tsx`
- 舊頁面：`index.html`
- 目前正式流程以 `page.tsx` 為主，排查時不要再以 `index.html` 當主依據

### API
- `pages/api/generate-outfit-spec.js`
- `pages/api/generate-image.js`
- `pages/api/search-products.js`
- `pages/api/data.js`

### 資料來源
- Supabase
- SerpAPI / Google Shopping
- custom_products

---

## 已確認的真實流程

### 1. 生成流程
`page.tsx`
→ `/api/generate-outfit-spec`
→ 取得 `summary + spec.items`
→ `/api/generate-image`
→ `/api/data?op=products`
→ 顯示「查看單品」

### 2. 商品流程
`page.tsx`
→ 把 spec.items 映射成商品搜尋輸入
→ `/api/data?op=products`
→ `data.js / handleProducts()`
→ 先 custom_products
→ 不足再呼叫 `/api/search-products`

### 3. 商品搜尋流程
`/api/search-products`
- 根據 item schema 組 query
- 搜 Google Shopping
- hard filter
- slot fallback
- ranking
- 回 grouped 結果

---

## 這輪已確認的重點

### A. gender 曾經格式不一致
資料流中同時出現：
- `male / female / neutral`
- `男性 / 女性 / 中性`

這會造成 query 明明應該搜男裝，卻實際變成 women。  
目前方向已改成在 `search-products.js` 做 gender normalization。

### B. item schema 新舊混雜
新資料的 spec.items 已經包含：
- `category`
- `fit`
- `material`
- `sleeve_length`
- `neckline`
- `silhouette`
- `style_keywords`

但舊資料仍有很多只剩：
- `slot`
- `generic_name`
- 甚至只剩 `shopping_query: "男性 成人 commute"` 這類極粗資訊

這會導致舊資料結果很差，並不是當前搜尋器本身必然失效。

### C. TOP 單獨為空的根因
不是單純「查不到」，而是原本把上半身混成同一類：
- 上衣
- 外套

導致：
- top hard filter 過嚴
- outer 類型又混進 top 規則
- 某些 top（例如 knit polo / shirt）容易被清空

### D. 上半身已重新定義為兩類
目前正確邏輯應為：
- `top` = 上衣（tee / shirt / polo / sweater）
- `outer` = 外套（jacket / cardigan / hoodie / coat）

之後搜尋器與 filter 都要依這個邏輯維護，不能再把 top / outer 混在一起。

### E. 商品準確度已有改善
相比一開始：
- 男生案例出現 bra / skirt / women 商品
- bottom 抓到 bikini bottom
- shoes 抓到女鞋或無關商品

目前經過 gender filter + category filter + slot filter 後，整體已明顯改善。

---

## 現在的狀態判斷

### 已改善
- gender 查詢方向比之前穩定
- 商品不再大量亂抓女裝 / bra / bikini
- bottom / shoes / bag 準確度明顯提高
- 已開始做 slot 專屬 fallback

### 尚未完全收斂
- top 在部分案例仍會被篩光
- top / outer 的邊界仍需靠更多真實案例微調
- 舊資料流仍可能只送出很粗的 shopping_query，拖累結果

---

## 後續原則
1. 搜尋邏輯以 `top` / `outer` 分流為基礎
2. 不要再把上半身統稱 top
3. 新 schema 優先，舊 schema 視為 fallback
4. 先穩定資料流與 filter，再處理 UI 細節
