# FindOutfit Supabase Auth Integration Bundle

This bundle adds real Supabase authentication (Google + Email OTP) for a Next.js App Router project.

## 1) Install packages

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## 2) Add environment variables

Create or update `.env.local` and Vercel env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3) Supabase dashboard setup

In Supabase Auth > URL Configuration:
- Site URL: your production site URL
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://your-domain.com/auth/callback`

Enable providers:
- Google
- Email (OTP / Magic Link)

## 4) Files in this bundle

- `lib/supabase/browser.ts`
- `lib/supabase/server.ts`
- `middleware.ts`
- `app/login/page.tsx`
- `app/auth/callback/route.ts`
- `components/NavBar.tsx`
- `components/AuthGate.tsx`
- `app/my/page.tsx` (example protected page)
- `app/settings/page.tsx` (example authenticated settings page)
- `app/system/page.tsx` (example authenticated system page)
- `app/page.module.supabase-auth.css` (append to your existing CSS)

## 5) Replace or merge

### Replace directly
- `components/NavBar.tsx`
- `app/login/page.tsx`
- `app/auth/callback/route.ts`
- `lib/supabase/browser.ts`
- `lib/supabase/server.ts`
- `middleware.ts`

### Choose one for protected pages
If your current `app/my/page.tsx`, `app/settings/page.tsx`, or `app/system/page.tsx` are heavily customized, you can:
- either replace them with the examples in this bundle
- or wrap your existing content with `AuthGate`

Example:

```tsx
import AuthGate from "../../components/AuthGate";

export default function Page() {
  return (
    <AuthGate>
      {/* your existing page content */}
    </AuthGate>
  );
}
```

## 6) Optional next step

Once auth is live, the best next upgrade is to bind these to the authenticated user id:
- generated outfits
- favorites
- settings
- system preferences

That turns local-only preferences into true account-based data.
