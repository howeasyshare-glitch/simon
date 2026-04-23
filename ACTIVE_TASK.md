# ACTIVE_TASK.md

## 任務名稱
FindOutfit — 商品搜尋系統整理紀錄（top / outer 分流階段）

---

## 目前任務目標
在不動整體產品方向的前提下，先把商品搜尋系統整理到可持續優化的狀態。

目前核心目標：
1. gender 不再錯
2. top / outer 分流
3. 四大主要顯示類別穩定：
   - top
   - bottom
   - shoes
   - bag
4. outer 可獨立處理，不再混進 top 規則

---

## 本輪已完成 / 已確認

### 已完成
- 已確認 `page.tsx` 才是現行主頁
- 已確認 `data.js` 會轉接到 `search-products`
- 已確認 `search-products.js` 已有：
  - gender normalization
  - hard filter
  - category filter
  - fallback 概念
- 已確認 gender 錯誤曾來自 enum 不一致
- 已確認 top 為空的根因之一是 top / outer 混類

### 已確認的事實
- `top` 不是沒資料，而是常被 filter 清空
- `outer` 在不少新資料中已是獨立 slot
- 舊資料仍存在大量粗糙結構，會導致錯誤推薦
- 新 schema 的品質明顯比舊資料好很多

---

## 本輪新的結構決策

### slot 邏輯
#### top
上衣類：
- tee
- t-shirt
- shirt
- polo
- sweater

#### outer
外套類：
- cardigan
- hoodie
- jacket
- utility jacket
- fleece jacket
- coat

#### bottom
- jeans
- chinos
- trousers
- shorts
- cargo

#### shoes
- sneakers
- loafers
- boots
- running / trail shoes

#### bag
- tote
- crossbody
- messenger
- shoulder bag

---

## 現在還沒完全解決的問題

### 1. top 某些案例仍會沒有結果
尤其是：
- knit polo
- short-sleeve shirt
- 某些 short sleeve + material + neckline 條件一起出現時

### 2. 舊資料仍然存在
像這些舊 spec：
- label 只剩 `top`
- description 空白
- shopping_query 只剩「男性 成人 commute」

這種資料會讓搜尋品質顯著變差。

### 3. outer 仍需更多驗證
目前邏輯已拆，但還沒有大量案例證明邊界已完全穩定。

---

## 驗收標準（當前階段）

### gender
- 男性案例不應再大量出現 women 商品
- 不應再出現 bra / skirt / bikini bottom 這類明顯錯誤

### top / outer
- top 不應再因為 outer 規則被清空
- outer 應能獨立推薦夾克 / cardigan / hoodie 類商品

### bottom / shoes / bag
- 維持目前已改善的品質
- 不要因調整 top / outer 反而退化

---

## 接下來建議的工作順序
1. 用更多真實案例驗證 top / outer 分流
2. 觀察哪些 top 類別仍常為 0
3. 根據 debug 微調：
   - category strict keywords
   - top fallback
   - outer fallback
4. 最後再回頭整理 UI 顯示層

---

## 備註
目前這個階段屬於「搜尋系統規則收斂期」。
先把資料流與 slot 邏輯穩住，比急著修 UI 更重要。
