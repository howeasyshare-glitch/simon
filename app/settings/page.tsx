
import styles from "../page.module.css";
export default function Page(){return <main className={styles.pageShell}><div className={styles.pageWrap} style={{maxWidth:960}}><h1 className={styles.pageTitle}>設定</h1><p className={styles.pageSub}>未來會放帳號設定與偏好，先統一為和首頁相同的深色視覺與按鈕風格。</p><div className={styles.outfitCard} style={{marginTop:18}}><div className={styles.cardBody}><div className={styles.cardTitle}>目前狀態</div><div className={styles.cardText}>這一頁已改成可正常顯示的設定頁，不再是空白或過淡文字。</div></div></div></div></main>}
