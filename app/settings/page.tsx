import styles from "../page.module.css";
import NavBar from "../../components/NavBar";

export default function Page() {
  return (
    <main className={styles.page}>
      <NavBar />
      <section className={styles.contentWrap}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.kicker}>Settings</div>
            <h1 className={styles.sectionTitle}>設定</h1>
          </div>
        </div>

        <div className={styles.historyBlock}>
          <div className={styles.historyTitle}>目前狀態</div>
          <div className={styles.cardText}>這一頁已統一成 V3.1 視覺。下一步可加入帳號、偏好與系統設定。</div>
        </div>
      </section>
    </main>
  );
}
