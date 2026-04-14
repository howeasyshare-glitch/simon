# PROJECT CONTEXT — FindOutfit

## 🧠 Project Overview
FindOutfit 是一個 AI 穿搭生成 + 商品導流系統。

核心流程：
1. 使用者輸入條件
2. AI 生成 outfit spec（服裝結構）
3. 生成圖片
4. 對應商品（custom_products / fallback）
5. 顯示 + 儲存 + 分享

---

## 🧱 Tech Stack
- Frontend: Next.js (App Router)
- Backend: API Routes (/api/*)
- Database: Supabase
- Storage: Supabase Storage（圖片）
- Auth: Supabase Auth

---

## 🔄 Core Data Flow
User Input
→ /api/generate-outfit-spec
→ outfitSpec (items)
→ /api/generate-image
→ image_url
→ /api/data?op=products
→ products
→ /api/data?op=outfits.create
→ DB
→ Hero / Explore / My


---

## 🗃️ Database Key Tables

### custom_products（最重要）
用來控制商品品質

欄位：
- title
- image_url
- product_url
- merchant
- tags (array)
- priority_boost
- badge_text
- is_active

👉 商品來源核心池

---

### outfits
- image_url
- spec (JSON)
- products (JSON)
- summary
- style
- share_slug

---

## ⚙️ API 結構

### /api/generate-outfit-spec
輸出：
- items[]
- summary

### /api/generate-image
輸出：
- image_url

### /api/data?op=products
輸出：
- products（每個 slot 對應 candidates）

### /api/data?op=outfits.create
儲存結果

---

## ⚠️ Known Limitations
- 無法自動讀 repo
- 無法自動比對 UI
- 商品匹配依賴 description + tags
- fallback 仍可能出現 Google Shopping

---

## 🎯 Product Goal
- AI 穿搭 + 商品導流
- 商品與圖片高度一致
- 優先導流至可購買商品頁
