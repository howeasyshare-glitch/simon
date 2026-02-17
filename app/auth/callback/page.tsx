"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("登入中…");

  useEffect(() => {
    (async () => {
      try {
        // supabase-js v2: detectSessionInUrl=true 會自動處理 URL 中的 code
        // 但我們仍呼叫 getSession 來確保 session 已落地
        const { data, error } = await supabaseBrowser.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          setMsg("找不到登入 session，請回首頁重試。");
          return;
        }

        // 登入完成 → 回首頁
        window.location.replace("/");
      } catch (e: any) {
        setMsg("登入失敗：" + (e?.message || "Unknown error"));
      }
    })();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", color: "#111" }}>
      <h1 style={{ margin: 0, fontSize: 18 }}>{msg}</h1>
      <p style={{ marginTop: 10, color: "#555" }}>若停留太久，可回首頁再按一次 Google 登入。</p>
    </main>
  );
}
