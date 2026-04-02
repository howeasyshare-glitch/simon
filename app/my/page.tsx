"use client";

import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import AuthGate from "../../components/AuthGate";

export default function MyPage() {
  return (
    <main className={styles.page}>
      <NavBar />
      <AuthGate>
        <section className={styles.contentWrap}>
          <div className={styles.pageHeroHead}>
            <div className={styles.pageHeroKicker}>My</div>
            <h1 className={styles.pageHeroTitle}>My Generated</h1>
            <div className={styles.pageHeroSub}>我的生成</div>
          </div>

          <div className={styles.card}>
            <div className={styles.blockTitle}>已登入</div>
            <div className={styles.emptyText}>
              這個範例頁已接上 Supabase 登入保護。你可以把你現有的 My 內容搬回來。
            </div>
          </div>
        </section>
      </AuthGate>
    </main>
  );
}
