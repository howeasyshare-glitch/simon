# ACTIVE TASK — FindOutfit

## 🎯 目標
將卡片推薦商品功能完成

---

## 🛠 本次修改
- custom 顯示不準確，以資料庫資料來看應該要在外套類第一個出現，接著另外再補兩個
- 推薦商品網址一樣連到 google 搜尋：**https://www.google.com/search?q=A+dark**，要直接跳過這段到單項商品的頁面
- 另外卡片點擊「查看單品」後會展開內容變得非常的長，這在UI上不好看，看可以如何優化

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

---

## 📊 驗收方式

1. 檢查 products JSON
2. 檢查 UI（Hero）
3. 點擊商品確認連結
4. 比對圖片與商品一致性

---

## 🧠 備註

本次重點是「穩定 + 一致性」，不是新增功能
