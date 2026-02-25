// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      // supabase-js v2: 需要 exchange code -> session
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        await supabaseBrowser.auth.exchangeCodeForSession(code);
      }

      // 不論成功與否都回首頁，首頁會 refreshMe()
      window.location.replace("/");
    })();
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "white" }}>
      正在完成登入…
    </div>
  );
}
