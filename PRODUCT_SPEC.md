# PRODUCT SPEC — FindOutfit

## 🎯 UI LOCK（不可破壞）

- Hero 卡片結構不可改
- like / share / apply 按鈕位置不可變
- 商品區塊必須在 actions 下方
- 卡片寬度與排列不可破壞

---

## 🛍 商品規則

- 每個 slot 最多 3 個商品
- 優先使用 custom_products
- 商品頁優先於搜尋頁
- fallback 只能在必要時使用

---

## 🧠 Spec（AI輸出）規則

- description 必須包含：
  - color
  - category
  - fit
  - style
- label 不可 generic（❌ top / bottom / shoes）
- 必須可用於商品搜尋

---

## 🚫 禁止事項

- 不可只用 category 當搜尋詞
- 不可全部 fallback Google
- 不可產生過多商品（>3）
- 不可破壞 UI

---

## 🎨 商品呈現規則

- 必須先顯示預覽（image_url）
- 再點擊進 product_url
- 不可直接丟搜尋頁（除非 fallback）

---

## ⚠️ 常見錯誤

- 商品與圖片不一致
- label 太抽象
- 商品數量過多
- UI 被商品撐爆
