# PRODUCT_SPEC.md

## 產品定位
FindOutfit 不是單純圖片生成器，也不是純商品列表。

它是：
1. 根據使用者條件生成 AI 穿搭圖
2. 產生 outfit spec
3. 根據 spec 推相似商品
4. 讓生成圖與單品推薦保持一致

---

## 核心產品原則

### 1. 商品推薦不是只要有就好
成功標準不是「有商品」，而是：
- 類別對
- 性別方向對
- 風格接近
- 材質合理
- 版型輪廓接近
- 色系相近

### 2. 上半身要拆成兩類
不能再把上半身全部視為同一類。

#### top = 上衣
- t-shirt
- shirt
- polo
- sweater

#### outer = 外套
- jacket
- cardigan
- hoodie
- coat
- utility jacket
- fleece jacket

這是目前產品邏輯上的必要拆分。

### 3. gender 必須全流程一致
使用者的 gender 不能只在 UI 正確，必須一路影響：
- outfit spec
- image prompt
- search query
- hard filter
- ranking

### 4. 舊資料與新資料要分開看待
#### 新 schema
應包含：
- `slot`
- `category`
- `color`
- `fit`
- `material`
- `sleeve_length`
- `neckline`
- `silhouette`
- `style_keywords`

#### 舊 schema
可能只剩：
- `generic_name`
- `description`
- `shopping_query`

舊 schema 僅能當 fallback，不能當主依據。

---

## 商品搜尋規格

### 搜尋順序
1. custom_products
2. Google Shopping / SerpAPI
3. hard filter
4. slot fallback
5. ranking

### Hard filter 規則
#### gender
- 男生案例不應出現 women / ladies / 女裝 / bra / skirt / bikini 等結果
- 女生案例也應排除明顯男裝詞

#### slot
- top 只留上衣
- outer 只留外套
- bottom 只留褲子 / shorts / jeans 類
- shoes 只留鞋
- bag 只留包

### slot fallback
若 hard filter 後某 slot = 0，應啟用對應 fallback：
- 保留 gender 排除
- 保留 slot 基本類型
- 放寬部分細節條件
- 避免直接顯示空白

---

## Ranking 方向
目前排序應優先看：
1. category / 類別命中
2. color
3. material
4. sleeve_length / neckline（對 top 特別重要）
5. 合理價格
6. 台灣可買性（若可判斷）
7. 避免精品極高價商品誤排到前面

---

## 當前已知產品風險

### 1. top 還可能為空
尤其是：
- knit polo
- button-up shirt
- 某些 short sleeve + material + neckline 條件一起出現時

### 2. 舊資料會嚴重拖累推薦品質
若只剩：
- `shopping_query: 男性 成人 commute`
這種資料
則搜尋品質必然很差。

### 3. outer 的推薦仍需真實案例校正
雖然邏輯上已拆分，但還需要更多真實案例驗證：
- cardigan 是否會誤進 top
- jacket 是否會誤進 outer 以外類別

---

## 現階段優先順序
1. 穩定 top / outer 分流
2. 確保 gender 一致
3. 讓新 schema 真正主導搜尋
4. 再做 UI 顯示優化
