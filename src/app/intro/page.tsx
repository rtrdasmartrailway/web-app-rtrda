import styles from "./intro.module.css";

export const metadata = {
  title: "แนะนำสถาบัน | RTRDA",
  description: "แนะนำสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง",
};

export default function IntroPage() {
  return (
    <main className={styles.intro} aria-label="แนะนำสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง">
      <h1 className={styles.visuallyHidden}>แนะนำสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง</h1>
    </main>
  );
}
