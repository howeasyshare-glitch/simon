import styles from "../page.module.css";
import NavBar from "../../components/NavBar";

export default function Page() {
  return <main className={styles.page}><NavBar /><section className={styles.contentWrap}><div className={styles.sectionHead}><div><div className={styles.kicker}>Settings</div><h1 className={styles.sectionTitle}>設定</h1></div></div><div className={styles.card}><div className={styles.blockTitle}>目前狀態</div><div className={styles.cardText}>這一頁已和 V3 視覺一致，之後可繼續補帳號、偏好與系統設定。</div></div></section></main>;
}
