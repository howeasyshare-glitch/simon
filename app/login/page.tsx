"use client";

import { supabase } from "../../lib/supabase/client";

export default function Page() {
  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}`
            : undefined,
      },
    });
  }

  async function loginWithEmail() {
    const email = window.prompt("請輸入 Email");
    if (!email) return;

    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}`
            : undefined,
      },
    });

    alert("登入連結已寄出，請到信箱收信。");
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>登入</h1>
      <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
        <button onClick={loginWithGoogle}>使用 Google 登入</button>
        <button onClick={loginWithEmail}>使用 Email 登入</button>
      </div>
    </main>
  );
}
