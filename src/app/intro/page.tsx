import Image from "next/image";
import styles from "./intro.module.css";

export const metadata = {
  title: "สถิตอยู่ในใจตราบนิรันดร์ | RTRDA",
  description: "น้อมสำนึกในพระมหากรุณาธิคุณและพระกรุณาธิคุณเป็นล้นพ้นอันหาที่สุดมิได้",
};

const portraits = [
  {
    src: "/intro/queen.webp",
    alt: "พระฉายาลักษณ์สมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถ ในกรอบลายไทยสีทอง",
    dedication: "น้อมสำนึกในพระมหากรุณาธิคุณเป็นล้นพ้นอันหาที่สุดมิได้",
    nameLines: ["สมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถ", "พระบรมราชชนนีพันปีหลวง"],
  },
  {
    src: "/intro/king.webp",
    alt: "พระบรมฉายาลักษณ์พระบาทสมเด็จพระบรมชนกาธิเบศร ในกรอบลายไทยสีทอง",
    dedication: "น้อมสำนึกในพระมหากรุณาธิคุณเป็นล้นพ้นอันหาที่สุดมิได้",
    nameLines: ["พระบาทสมเด็จพระบรมชนกาธิเบศร", "มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร"],
  },
  {
    src: "/intro/princess.webp",
    alt: "พระรูปสมเด็จพระเจ้าลูกเธอ เจ้าฟ้าพัชรกิติยาภา ในชุดปกติขาว",
    dedication: "น้อมสำนึกในพระกรุณาธิคุณเป็นล้นพ้นอันหาที่สุดมิได้",
    nameLines: [
      "สมเด็จพระเจ้าลูกเธอ เจ้าฟ้าพัชรกิติยาภา",
      "นเรนทิราเทพยวดี กรมหลวงราชสาริณีสิริพัชร",
      "มหาวัชรราชธิดา",
    ],
  },
] as const;

export default function IntroPage() {
  return (
    <main className={styles.intro} aria-labelledby="intro-title">
      <div className={styles.content}>
        <h1 className={styles.title} id="intro-title">
          สถิตอยู่ในใจตราบนิรันดร์
        </h1>

        <section
          className={styles.portraitGrid}
          aria-label="พระบรมฉายาลักษณ์และคำถวายความอาลัย"
        >
          {portraits.map((portrait, index) => (
            <figure className={styles.portraitCard} key={portrait.src}>
              <Image
                alt={portrait.alt}
                className={styles.portrait}
                fetchPriority={index === 0 ? "high" : "auto"}
                height={1255}
                loading={index === 0 ? "eager" : "lazy"}
                sizes="(max-width: 820px) 70vw, 260px"
                src={portrait.src}
                unoptimized
                width={1120}
              />
              <figcaption className={styles.caption}>
                <p className={styles.dedication}>{portrait.dedication}</p>
                <p className={styles.royalName}>
                  {portrait.nameLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
              </figcaption>
            </figure>
          ))}
        </section>

        <footer className={styles.footer}>
          <p>
            <span>ข้าพระพุทธเจ้า คณะผู้บริหาร และบุคลากร</span>
            <span>สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
