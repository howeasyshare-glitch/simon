"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("正在完成登入…");
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        // 0) 先看是否已經有 session（有時 Supabase 會先把 hash 清掉）
        setMsg("檢查目前 session…");
        const s0 = await supabaseBrowser.auth.getSession();
        if (s0?.data?.session?.access_token) {
          setMsg("已登入 ✅ 正在返回首頁…");
          setTimeout(() => window.location.replace("/"), 300);
          return;
        }

        const url = new URL(window.location.href);

        // 1) PKCE: ?code=...
        const code = url.searchParams.get("code");
        const err = url.searchParams.get("error");
        const errDesc = url.searchParams.get("error_description");

        if (err) {
          setMsg("OAuth 回傳錯誤");
          setDetail({ err, errDesc, href: window.location.href });
          return;
        }

        if (code) {
          setMsg("交換 session（PKCE）中…");
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) {
            setMsg("exchangeCodeForSession 失敗");
            setDetail(error);
            return;
          }

          const s1 = await supabaseBrowser.auth.getSession();
          if (!s1?.data?.session?.access_token) {
            setMsg("交換完成但 session 仍為空（未被保存）");
            setDetail(s1);
            return;
          }

          setMsg("登入成功 ✅ 正在返回首頁…");
          setTimeout(() => window.location.replace("/"), 300);
          return;
        }

        // 2) Implicit: #access_token=...&refresh_token=...
        const hash = (window.location.hash || "").replace(/^#/, "");
        const hp = new URLSearchParams(hash);

        const access_token = hp.get("access_token") || "";
        const refresh_token = hp.get("refresh_token") || "";

        // 有些情況 hash 會被清成只有 #，但其實 token 已經寫入 storage
        if (!access_token && !refresh_token) {
          setMsg("沒有收到 code / token，嘗試再次讀取 session…");
          await new Promise((r) => setTimeout(r, 300));
          const s2 = await supabaseBrowser.auth.getSession();

          if (s2?.data?.session?.access_token) {
            setMsg("已登入 ✅ 正在返回首頁…");
            setTimeout(() => window.location.replace("/"), 300);
            return;
          }

          setMsg("回跳參數不完整（停在 /auth/callback#）");
          setDetail({
            hint: "通常是 Supabase Auth URL 設定或 Google OAuth redirect 設定不正確",
            href: window.location.href,
          });
          return;
        }

        setMsg("設定 session（Implicit）中…");
        const { error: setErr } = await supabaseBrowser.auth.setSession({
          access_token,
          refresh_token,
        });

        if (setErr) {
          setMsg("setSession 失敗");
          setDetail(setErr);
          return;
        }

        const s3 = await supabaseBrowser.auth.getSession();
        if (!s3?.data?.session?.access_token) {
          setMsg("setSession 後仍無 session（可能 storage 被擋）");
          setDetail(s3);
          return;
        }

        setMsg("登入成功 ✅ 正在返回首頁…");
        setTimeout(() => window.location.replace("/"), 300);
      } catch (e: any) {
        setMsg("callback 發生例外");
        setDetail({ message: e?.message, stack: e?.stack });
      }
    })();
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0b0d12",
        color: "#e9ecf3",
      }}
    >
      <div style={{ width: "min(760px, 100%)" }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>{msg}</div>
        <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
          若停住，請把下方內容截圖貼我（這會直接指出是設定哪裡出問題）。
        </div>

        {detail ? (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "rgba(255,255,255,0.06)",
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 12,
              overflow: "auto",
              maxHeight: 420,
            }}
          >
            {JSON.stringify(detail, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
