"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/browser";
import styles from "../page.module.css";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const next = searchParams.get("next") || "/";

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setMessage(error.message || "Google 登入失敗");
      setLoading(false);
    }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setMessage(error.message || "Email 登入失敗");
    } else {
      setMessage("登入連結已寄出，請到信箱開啟。\n若未收到，請檢查垃圾郵件。");
    }

    setLoading(false);
  }

  return (
    <main className={styles.page}>
      <section className={styles.contentWrap}>
        <div className={styles.authShell}>
          <div className={styles.authCard}>
            <div className={styles.pageHeroKicker}>Account</div>
            <h1 className={styles.pageHeroTitle}>登入 FindOutfit</h1>
            <div className={styles.pageHeroSub}>使用 Google 或 Email 登入。</div>

            <div className={styles.authActions}>
              <button type="button" className={styles.generateBtn} onClick={signInWithGoogle} disabled={loading}>
                {loading ? "處理中..." : "使用 Google 登入"}
              </button>
            </div>

            <div className={styles.authDivider}>或</div>

            <form className={styles.authForm} onSubmit={signInWithEmail}>
              <label className={styles.authField}>
                <span className={styles.sliderLabel}>Email</span>
                <input
                  className={styles.authInput}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>

              <button type="submit" className={styles.secondaryBtn} disabled={loading || !email}>
                {loading ? "處理中..." : "寄送登入連結"}
              </button>
            </form>

            {message ? <div className={styles.authMessage}>{message}</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
