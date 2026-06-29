"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./board-executive-org-chart.module.css";

const EXECUTIVE_DETAILS: Record<
  string,
  {
    title: string;
    sections: Array<{ heading: string; items: string[] }>;
  }
> = {
  "ดร. เพียงออ เลาหะวิไลย": {
    title: "ดร. เพียงออ เลาหะวิไลย",
    sections: [
      {
        heading: "การศึกษา",
        items: [
          "ปริญญาเอก วิทยาศาสตรดุษฎีบัณฑิต (D. in Knowledge Management) มหาวิทยาลัยเชียงใหม่",
          "ปริญญาโท Master of Business Administration (M.B.A. in International Business) Seoul National University, Seoul, Republic of Korea",
          "ปริญญาตรี รัฐศาสตรบัณฑิต มหาวิทยาลัยธรรมศาสตร์",
        ],
      },
      {
        heading: "ประสบการณ์การทำงาน",
        items: [
          "2561 - 2568 อาจารย์ประจำหลักสูตรบัณฑิตศึกษาวิทยาลัยนานาชาตินวัตกรรมดิจิทัล มหาวิทยาลัยเชียงใหม่",
          "2554 - 2556 ผู้พิพากษาสมทบศาลแรงงานภาค 5",
          "2534 - 2556 General Manager บริษัท เคอีซี (ประเทศไทย) จำกัด (KEC CORP., KOREA)",
        ],
      },
      {
        heading: "ประวัติด้านกรรมการ/อนุกรรมการ/ที่ปรึกษา",
        items: [
          "2568 – ปัจจุบัน ผู้อำนวยการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง กระทรวงคมนาคม",
          "2567 – ปัจจุบัน กรรมการการบินพลเรือน",
          "2567 – ปัจจุบัน กรรมการบริหารการจัดการ ความรู้ เทคโนโลยีและนวัตกรรมการท่าเรือแห่งประเทศไทย",
          "2567 – ปัจจุบัน กรรมการรัฐวิสาหกิจ (กฟน., กปน.)",
          "2567 – ปัจจุบัน อนุกรรมการผู้ทรงคุณวุฒิใน อ.ก.พ. กระทรวงคมนาคม",
        ],
      },
    ],
  },
};

export function ExecutiveDetailButton({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const detail = EXECUTIVE_DETAILS[name];

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.detailButton}
        aria-haspopup={detail ? "dialog" : undefined}
        aria-controls={detail ? dialogId : undefined}
        aria-expanded={detail ? open : undefined}
        onClick={() => {
          if (detail) setOpen(true);
        }}
      >
        รายละเอียด
      </button>
      {detail && open ? (
        <div
          className={styles.detailOverlay}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <section
            id={dialogId}
            className={styles.detailDialog}
            role="dialog"
            aria-modal="true"
            aria-label={`รายละเอียด ${detail.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.detailHeader}>
              <h3>{detail.title}</h3>
              <button
                ref={closeRef}
                type="button"
                className={styles.detailClose}
                onClick={() => setOpen(false)}
                aria-label="ปิดรายละเอียด"
              >
                ×
              </button>
            </div>
            <div className={styles.detailBody}>
              {detail.sections.map((section) => (
                <section key={section.heading}>
                  <h4>{section.heading}</h4>
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
