# ACTIVE TASK — FindOutfit

## 🎯 目標
提升商品與圖片一致性，同時維持 UI 穩定

---

## 🛠 本次修改
- 優化 products API matching
- 改善商品預覽 UI
- 降低 fallback 比例

---

## 🚫 不可動區（BLOCKED FILES）
- components/NavBar.tsx
- app/layout.tsx
- Hero 卡片主結構

---

## ✅ 驗收標準

- 每個 slot ≤ 3 商品
- 商品與圖片風格一致
- 優先為商品頁（非搜尋頁）
- Hero UI 不可跑版
- 所有 slot 可正常顯示

---

## ⚠️ 已知問題

- 部分商品仍 fallback
- custom_products 不足
- 商品卡可能撐爆 UI
- 卡片內推薦商品的照片顯示過大

---

## 📊 驗收方式

1. 檢查 products JSON
2. 檢查 UI（Hero）
3. 點擊商品確認連結
4. 比對圖片與商品一致性

---

## 🧠 備註

本次重點是「穩定 + 一致性」，不是新增功能
