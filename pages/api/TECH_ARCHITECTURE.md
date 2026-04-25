# TECH_ARCHITECTURE.md
# Simon Project (V3.5)

## 1. Tech Stack

- Framework: Next.js 14 (App Router + Pages API mixed mode)
- Frontend: React + TypeScript
- Styling: CSS Modules + existing page.module.css
- Backend API: Next.js API Routes
- Hosting: Vercel
- Search Source: Google Shopping / SERP API
- Image Generation: Gemini / external generation route
- Data Storage: local json / optional Supabase (legacy mixed state)

---

# 2. Core File Structure

```txt
app/
  page.tsx
  explore/page.tsx

components/
  HeroCarousel.tsx
  OutfitCard.tsx
  NavBar.tsx

pages/api/
  generate-outfit-spec.js
  generate-image.js
  search-products.js

3. File Responsibilities
app/page.tsx

Main homepage generator.

Handles:
generator form state
gender / audience / age / height / weight / temp
style / scene selection
call generate-outfit-spec API
call search-products API
call generate-image API
merge result into generated outfit cards
pass data into HeroCarousel
Important states
gender
audience
age
height
weight
temp
generatedItems
stage
generatedProfileSnapshot
app/explore/page.tsx

Explore page.

Handles:
browse existing outfit cards
like/share/apply actions
uses HeroCarousel + OutfitCard
components/HeroCarousel.tsx

Homepage main visual carousel.

Handles:
featured / generated switch
hero card slider
image preview
summary text
actions (like/share/apply)
view products expand panel
per-card profile snapshot display
Current critical area
summary
↓
[本次設定]
↓
actions
↓
查看單品
components/OutfitCard.tsx

Reusable smaller card UI.

Mainly used by Explore or simplified card list.

Exports:
export type OutfitItem
pages/api/generate-outfit-spec.js

Generates structured outfit slots.

Returns:
{
  "items": [
    { "slot":"top" },
    { "slot":"outer" },
    { "slot":"bottom" },
    { "slot":"shoes" }
  ]
}
Based on:
gender
audience
body data
weather
scene
style tone
pages/api/search-products.js

Product recommendation engine.

Input:
{
  "items": [],
  "gender": "male",
  "audience": "kids",
  "locale": "tw"
}
Responsibilities:
build keyword query
Taiwan-first product search
gender filtering
adult / kids split
top / outer split
ranking
fill minimum item count
Output:
{
  "grouped": {
    "top": [],
    "outer": [],
    "bottom": [],
    "shoes": []
  }
}
pages/api/generate-image.js

Creates final AI outfit image.

Uses same payload as outfit spec when possible.

4. Current Data Flow
User Form Input
↓
page.tsx state
↓
generate-outfit-spec.js
↓
slot items
↓
search-products.js
↓
recommended products
↓
generate-image.js
↓
image url
↓
merge into generatedItems
↓
HeroCarousel render
5. Outfit Card Schema
type OutfitItem = {
  id: string;
  summary?: string;
  image_url?: string;
  style?: any;
  products?: ProductGroup[];
  _snapshot?: ProfileSnapshot;
}
6. Snapshot Schema

Each generated card should store its own snapshot.

type ProfileSnapshot = {
  gender: string;
  audience: string;
  age: number;
  height: number;
  weight: number;
  temp: number;
}
Important:

Do NOT rely on current form state.

Each card uses its own snapshot.

7. Product Schema
type Product = {
  title: string;
  link: string;
  thumbnail?: string;
  merchant?: string;
  price?: string;
}
type ProductGroup = {
  slot: "top" | "outer" | "bottom" | "shoes" | "bag";
  candidates: Product[];
}
8. Stable Logic (Do Not Break)
top / outer split

Already stabilized.

Do not merge top + outer again.

audience range switching

adult / kids body range already working.

generated snapshot concept

Must remain per-card.

9. Current Known Priorities
Search Quality
stronger Taiwan site ratio
keyword accuracy
category fill to minimum 3
UX
cleaner product panel
faster card browsing
mobile optimized
Product Quality
match AI image closer
price sanity
local availability
10. Safe Edit Order

When changing logic:

Search issue

edit:

pages/api/search-products.js
Generator issue

edit:

app/page.tsx
generate-outfit-spec.js
Card display issue

edit:

HeroCarousel.tsx
OutfitCard.tsx
11. New Chat Handoff Rule

Upload these first:

app/page.tsx
components/HeroCarousel.tsx
pages/api/search-products.js
