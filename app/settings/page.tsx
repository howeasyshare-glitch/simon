
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";

export default function Page() {
  return (
    <div className={styles.pageShell}>
      <NavBar />
      <div className={styles.pageWrap}>
        <div className={styles.listPageHeader}>
          <div>
            <div className={styles.sectionKicker}>系統與偏好</div>
            <h1 className={styles.pageTitle}>Settings</h1>
            <p className={styles.pageSub}>這裡之後可放帳號、偏好與其他設定功能。</p>
          </div>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.cardTitle}>目前狀態</div>
          <div className={styles.cardText}>已統一與首頁相同的視覺、導航列與按鈕風格。</div>
        </div>
      </div>
    </div>
  );
}
