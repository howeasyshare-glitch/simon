# CORE_SPEC.md

## 專案名稱

FindOutfit / Simon

---

# 一、產品定位

FindOutfit 不是：

* 圖片生成器
* 商品列表

它是：

1. 生成穿搭
2. 產生 outfit spec
3. 推相似商品
4. 保持「圖 ↔ 商品一致性」

---

# 二、核心產品原則

## 商品推薦成功標準

不是「有商品」，而是：

* 類別正確
* 性別正確
* 風格接近
* 材質合理
* 版型接近
* 色系合理

---

## 上半身分流（不可破壞）

### top（上衣）

* t-shirt
* shirt
* polo
* sweater

### outer（外套）

* jacket
* cardigan
* hoodie
* coat

---

## gender 必須全流程一致

影響：

* outfit spec
* image prompt
* search query
* filter
* ranking

---

## 新舊資料規則

### 新 schema（主）

包含：

* category
* fit
* material
* silhouette
* style_keywords

### 舊 schema（fallback）

* generic_name
* shopping_query

---

# 三、系統架構

## 前端

* `app/page.tsx`（主流程）
* `HeroCarousel.tsx`（核心 UI）

## API

* generate-outfit-spec
* generate-image
* search-products
* data.js（產品整合）

---

# 四、資料流程

生成流程：

page.tsx
→ outfit-spec
→ image
→ products
→ render

---

# 五、商品系統規則

## 搜尋流程

1. custom_products
2. Google Shopping
3. hard filter
4. fallback
5. ranking

---

## Hard filter

### gender

禁止：

* bra
* skirt（男）
* bikini

### slot

* top → 上衣
* outer → 外套
* bottom → 褲
* shoes → 鞋
* bag → 包

---

## fallback

當某 slot = 0：

* 保留 gender
* 放寬細節
* 不可直接空白

---

# 六、UI / UX 規範（V5.0）

## 核心原則

1. Mobile First
2. 不讓使用者思考
3. 操作有回饋
4. 畫面乾淨

---

## 生成流程 UX

必須顯示：

* 分析條件
* 規劃穿搭
* 生成圖片
* 搜尋商品

---

## CTA 規範

### 主 CTA

✨ 幫我搭一套

* 有 loading
* 手機固定底部

---

### 卡片 CTA（不可改順序）

1. 🛍 看單品
2. 🔄 套用條件
3. ❤️ 收藏
4. 分享

---

## 商品顯示

* 使用 Bottom Sheet
* 不可卡片內展開
* 每類最多 3 件

---

## 結果頁

必須顯示：

* summary
* 本次設定
* 提示（已完成穿搭）

---

# 七、目前版本狀態

## V4.x（穩定）

* gender normalization
* top / outer 分流
* custom guard

---

## V5.0 Phase A

* 固定 CTA
* loading step
* 自動 scroll

---

## V5.0 Phase B

* 商品 Bottom Sheet
* CTA 重排
* 結果提示

---

# 八、不可破壞規則（非常重要）

## search-products.js

* 不可移除 gender filter
* 不可合併 top / outer

---

## data.js

* pipeline 順序不可變
* custom guard 必須存在

---

## UI

* 不可移除 CTA
* 不可讓使用者多點一步
* 不可增加滑動成本

---

# 九、下一階段（V5.1）

* 收藏系統
* 再生成 UX
* Explore 強化
* 使用紀錄
