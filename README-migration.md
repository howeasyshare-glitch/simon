# findoutfit → Next.js (App Router) migration (Phase N1)

This scaffold runs your current HTML pages inside iframes to stop layout/CSS/JS from breaking while we migrate.

## What you get
- `/` → `/public/legacy/index.html`
- `/explore` → `/public/legacy/explore.html`
- `/share/<slug>` → `/public/legacy/share.html?slug=<slug>`
- Rewrite keeps `/explore/list` working by sending it to `/api/explore/list`

## Step 1 — Copy your API functions into Next
Next.js serves API from **`pages/api/*`** (or `app/api/*`).

Create folders and move files:
- `api/explore/list.js` → `pages/api/explore/list.js`
- `api/share/[slug].js` → `pages/api/share/[slug].js`
- `api/me.js` → `pages/api/me.js`
- `api/outfits/list.js` → `pages/api/outfits/list.js`
- `api/outfits/create.js` → `pages/api/outfits/create.js`
- `api/outfits/[id].js` → `pages/api/outfits/[id].js`
- other endpoints you currently call → same under `pages/api/..`

> Keep your serverless function count ≤ 12 (Vercel Hobby). We can merge endpoints later.

## Step 2 — Install + run
```bash
npm i
npm run dev
```

## Step 3 — Deploy to Vercel
Framework preset: Next.js.

## Next phases
- N2: Replace iframe for Home with real React layout + CSS modules.
- N3: Convert Explore cards and Share page to React components.
