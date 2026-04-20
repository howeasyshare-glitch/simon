# PRODUCT_SPEC.md

## 產品定位
FindOutfit 不是單純圖片生成器，也不是單純商品列表。

它是：
- 先根據使用者條件生成 AI 穿搭圖
- 再根據穿搭圖 / outfit spec 推出相似商品
- 讓使用者在「生成圖 → 查看單品 → 點商品」這條路徑中感受到一致性

---

## 核心產品原則

### 1. 圖像與商品必須一致
最重要的不是有商品，而是：
- 商品類別正確
- 商品風格接近
- 商品版型接近
- 商品材質接近
- 商品配色接近

### 2. 商品推薦不是亂抓
商品推薦應該像：
- AI stylist 幫你找相似單品

而不是：
- 搜尋到同類別商品就塞進來

### 3. UI 不能為了功能而犧牲體驗
即使推薦功能逐步上線，也不能：
- 讓「查看單品」區塊長到失控
- 讓商品圖撐爆卡片
- 讓 slot 結構不清楚
- 讓使用者難以理解哪個商品對應哪個部位

### 4. 使用者輸入條件要完整落實到結果
使用者輸入的：
- 性別
- 年齡
- 身高
- 體重
- 風格
- 溫度
- 是否有包 / 帽 / 外套

必須真的影響：
1. spec
2. 生成圖
3. 商品推薦

不能 UI 顯示一套、實際送出另一套。

---

## Outfit Spec 規格原則

### item schema 必須是「可購物描述」
每個 item 不能只停留在：
- top / bottom / shoes
- 單純 generic name

應包含：
- `slot`
- `generic_name`
- `display_name_zh`
- `category`
- `color`
- `fit`
- `material`
- `sleeve_length`
- `length`
- `neckline`
- `silhouette`
- `style`
- `style_keywords`
- `gender`
- `warmth`

### 必備精神
- 文字要能直接拿去搜商品
- 類別不能過於 generic
- 要能描述「像不像圖」

---

## 商品搜尋規格原則

### 搜尋策略
優先順序：
1. custom_products
2. 外部商品搜尋（Google Shopping / SerpAPI）
3. ranking / 去重 / 補位

### 搜尋不是只看 category
不能只靠：
- top
- bottom
- shoes

必須優先參考：
- category
- fit
- material
- sleeve_length
- neckline
- silhouette
- color
- style_keywords

### Ranking 規則
商品排序不能只做加分，應分兩層：

#### 第一層：硬過濾
例如：
- 指定 polo，就不能進非 polo
- 指定 leather sneakers，就不該回 running shoes / basketball shoes
- 指定 short sleeve，就不能回 long sleeve

#### 第二層：加分排序
再根據：
- 顏色接近
- 價格合理
- 品牌 / 商家適配
- 台灣可購買性
- 日常實穿性

---

## UI 規格原則

### 查看單品
- 每個 slot 建議 ≤ 3 個商品
- slot 結構要清楚
- 不能只有一長串商品列表
- 商品卡不能過大
- 商品圖片不可撐爆容器
- 展開後內容不能過長到破壞整體體驗

### Hero / 主畫面
- Hero 卡片主結構不隨意更動
- like / share / apply 位置不亂動
- 商品區塊需維持在合理位置
- 不為了修推薦功能破壞整體 UI

---

## 目前已知產品風險

### 1. 商品與 AI 圖差距大
這是目前最大風險。

### 2. 性別同步問題
使用者反映：
- UI 顯示男
- 但生成圖結果偏女
這屬於高優先風險，會直接破壞信任感。

### 3. custom_products 過度主導
若外部搜尋不準或未接上，容易退回只看 custom，導致結果封閉、重複、與圖像不一致。

### 4. 點數扣除流程風險
若 API 失敗仍扣點，會造成體驗與信任問題。

---

## 現階段產品優先順序
1. 修正性別 / 輪廓 / 條件同步
2. 提升商品與 AI 圖相似度
3. 優化查看單品 UI
4. 再做進一步推薦策略優化
