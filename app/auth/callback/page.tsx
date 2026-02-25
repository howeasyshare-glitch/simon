"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser"; // ✅ 修正：多上一層

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await supabaseBrowser.auth.exchangeCodeForSession(code);
        }
      } catch {
        // ignore
      } finally {
        window.location.replace("/");
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "white" }}>
      正在完成登入…
    </div>
  );
}
