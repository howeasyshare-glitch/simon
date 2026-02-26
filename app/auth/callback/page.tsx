"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("正在完成登入…");
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const err = url.searchParams.get("error");
        const errDesc = url.searchParams.get("error_description");

        if (err) {
          setMsg("OAuth 回傳錯誤（Google/Supabase）");
          setDetail({ err, errDesc });
          return;
        }

        if (!code) {
          setMsg("缺少 code（回跳參數不完整）");
          setDetail({ href: window.location.href });
          return;
        }

        setMsg("交換 session 中…");
        const { data, error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg("exchangeCodeForSession 失敗");
          setDetail(error);
          return;
        }

        setMsg("已取得 session，驗證中…");
        const { data: s } = await supabaseBrowser.auth.getSession();
        if (!s?.session?.access_token) {
          setMsg("session 取得失敗（可能未被保存）");
          setDetail(data);
          return;
        }

        setMsg("登入成功，返回首頁…");
        setTimeout(() => window.location.replace("/"), 600);
      } catch (e: any) {
        setMsg("callback 發生例外");
        setDetail({ message: e?.message, stack: e?.stack });
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, color: "white" }}>
      <div style={{ width: "min(720px, 100%)", lineHeight: 1.5 }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>{msg}</div>
        {detail ? (
          <pre style={{ whiteSpace: "pre-wrap", background: "rgba(255,255,255,0.06)", padding: 12, borderRadius: 12 }}>
            {JSON.stringify(detail, null, 2)}
          </pre>
        ) : (
          <div style={{ opacity: 0.7, fontSize: 13 }}>（如果卡住，請截圖這頁給我）</div>
        )}
      </div>
    </div>
  );
}
