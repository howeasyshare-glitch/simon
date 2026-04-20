# ACTIVE_TASK.md

## 任務名稱
FindOutfit — 修正生成條件同步 + 提升商品與 AI 圖一致性

---

## 本輪目標
目前系統已可：
- 正常生成 outfit spec
- 正常顯示查看單品
- 顯示 custom 與外部商品

但仍有兩個高優先問題：

### 1. 商品與 AI 圖差距很大
雖然商品已能顯示，但推薦內容常常：
- 類別對，風格不對
- 顏色接近，但材質 / 版型 / 輪廓差很多
- 偏熱門商品而非相似商品

### 2. 性別條件可能沒有正確落實
使用者回報：
- 一進頁面沒有調整「基本輪廓」
- 按下生成前性別顯示為男
- 但生成圖偏女

這表示目前至少有一處可能有問題：
- UI 顯示值
- page.tsx 送出的值
- generate-outfit-spec prompt 組裝
- generate-image prompt / API 組裝

---

## 本輪修改方向

### A. 生成條件同步檢查
要確認以下資料在整條鏈都一致：
- gender
- age
- height
- weight
- style
- temp
- withBag / withHat / withCoat

### B. outfit spec 升級為購物描述
已開始導入新 item schema：
- category
- fit
- material
- sleeve_length
- length
- neckline
- silhouette
- style_keywords

接下來要確認：
- page.tsx 真的收到新欄位
- search-products.js 真的有使用新欄位

### C. search-products 進入 V2.2
目標：
- 先硬過濾
- 再加分排序

重點不是更多商品，而是更像 AI 圖的商品。

---

## 當前實際狀態

### 已完成
- 現行頁面確認為 `page.tsx`
- `/api/generate-outfit-spec` 已能正常回資料
- `/api/search-products` 已能正常回商品
- `/api/data?op=products` 已接得出商品，不再只剩 custom
- 模型名稱錯誤已修正到可用版本
- `page.tsx` 對 `generate-outfit-spec` 的 body 包裝問題已找出並修正方向

### 尚未完成
- 商品與 AI 圖相似度仍不足
- 「基本輪廓 / 性別」是否完整同步仍未驗證完成
- 查看單品 UI 仍偏長，尚未整理 slot 呈現

---

## 驗收標準

### 生成條件
- 未調整基本輪廓時，UI 顯示的 gender 必須與實際生成結果一致
- 調整輪廓後，生成圖風格與性別方向要可感知變化
- 不能出現 UI 顯示男、結果偏女的情況

### 商品推薦
- top / bottom / shoes 的商品至少要有明顯部位對應
- 商品要更接近生成圖的：
  - 顏色
  - category
  - fit
  - material
  - sleeve_length / neckline / silhouette
- 不可只回同類別但風格差很大的商品

### UI
- 查看單品內每個 slot 建議 ≤ 3 個商品
- 商品圖不可撐爆
- 展開後不可長到破壞閱讀體驗

---

## 本輪建議先查的檔案

### 優先
- `page.tsx`
- `pages/api/generate-outfit-spec.js`
- `pages/api/generate-image.js`
- `pages/api/search-products.js`
- `pages/api/data.js`

### 次優先
- 查看單品 UI 元件
- Hero / 卡片內商品呈現區塊

---

## 明確不要再重踩的錯誤
1. 不要再把舊 `index.html` 當成現行主頁邏輯
2. 不要只測 API 成功就當完成，必須看 UI 最終效果
3. 不要只看有沒有商品，要看商品是不是像 AI 圖
4. 不要忽略 gender / 輪廓同步問題
5. 不要先大改 UI，先確認資料流與推薦精準度

---

## 下一步建議
1. 檢查 `page.tsx` → `generate-outfit-spec` → `generate-image` 的 gender 流是否一致
2. 讓 `search-products.js` 正式吃 V2.2 schema
3. 針對 top / shoes 先做硬過濾規則
4. 最後再修查看單品 UI
