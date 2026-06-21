"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const LANDING_POPUP_SESSION_KEY = "rtrda-landing-popup-dismissed";

type PopupStorage = Pick<Storage, "getItem" | "setItem">;

type LandingPopupSection = {
  title: string;
  items: string[];
};

export const LANDING_POPUP_CONTENT = {
  title: "ดร. โชติชัย เจริญงาม",
  closeLabel: "ปิดหน้าต่าง",
  sections: [
    {
      title: "การศึกษา",
      items: [
        "2537 Ph.D. Civil Engineering in Construction Engineering and Project Management University of Texas at Austin, USA.",
        "2532 M. Sc. Civil Engineering in Construction Engineering and Management University of Kansas, USA.",
        "2528 วิศวกรรมศาสตร์บัณฑิต สาขาวิศวกรรมโยธา (เกียรตินิยม อันดับ 2) มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี",
      ],
    },
    {
      title: "ประสบการณ์การทำงาน",
      items: [
        "2541 - 2565 รองศาสตราจารย์คณะวิศวกรรมศาสตร์และเทคโนโลยี สถาบันเทคโนโลยีแห่งเอเซีย (Asian Institute of Technology: AIT)",
        "2538 ผู้เชี่ยวชาญระบบวางแผนและควบคุมต้นทุนโครงการ องค์การสหประชาชาติ (UNDP)",
        "2535 - 2537 วิศวกรที่ปรึกษา ทางด้านการวางแผนและควบคุมโครงการ C&C Consultants, Austin, Texas, USA.",
        "2534 - 2535 วิศวกรประเมินประสิทธิภาพการดําเนินงาน Nuclear Power Plants Texas Public Utility Commissions, USA.",
      ],
    },
    {
      title: "ประวัติด้านกรรมการ/อนุกรรมการ/ที่ปรึกษา",
      items: [
        "2565 - ปัจจุบัน ประธานกรรมการ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) กระทรวงคมนาคม",
        "2561 – ปัจจุบัน กรรมการ มูลนิธิแพทย์อาสาสมเด็จพระศรีนครินทราบรมราชชนนี",
        "2557 – ปัจจุบัน กรรมการผู้ทรงคุณวุฒิการให้เอกชนร่วมลงทุนในกิจการของรัฐ กระทรวงการคลัง",
        "2562 – ปัจจุบัน กรรมการและประธานกรรมการบริหารความเสี่ยง บริษัท อินเด็กซ์ อินเตอร์เนชั่นแนล กรุ๊ป จํากัด (มหาชน)",
        "2558 – ปัจจุบัน ประธานกรรมการและประธานกรรมการตรวจสอบ บริษัท แมสเทค ลิงค์ จํากัด",
        "2558 – ปัจจุบัน กรรมการโรงเรียนนานาชาติ KIS (KIS International School)",
      ],
    },
  ] satisfies LandingPopupSection[],
};

export function isPublicLandingPopupPath(path: string): boolean {
  return !path.startsWith("/rtrdaintranet");
}

export function shouldShowLandingPopup(
  storage: PopupStorage | null | undefined,
): boolean {
  if (!storage) return true;

  try {
    return storage.getItem(LANDING_POPUP_SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}

export function rememberLandingPopupDismissed(
  storage: PopupStorage | null | undefined,
): void {
  if (!storage) return;

  try {
    storage.setItem(LANDING_POPUP_SESSION_KEY, "1");
  } catch {
    // Storage can be unavailable in private browsing or locked-down webviews.
  }
}

function LandingPopupSection({ section }: { section: LandingPopupSection }) {
  return (
    <section className="landing-popup-section">
      <h3>{section.title}</h3>
      <ul>
        {section.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function LandingPopup({
  forceOpen = false,
  path,
}: {
  forceOpen?: boolean;
  path: string;
}) {
  const [open, setOpen] = useState(forceOpen);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isPublicPath = isPublicLandingPopupPath(path);

  const closePopup = useCallback(() => {
    if (!forceOpen) {
      rememberLandingPopupDismissed(window.sessionStorage);
    }
    setOpen(false);
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, [forceOpen]);

  useEffect(() => {
    if (forceOpen || !isPublicPath || !shouldShowLandingPopup(window.sessionStorage)) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const openTimer = window.setTimeout(() => setOpen(true), 0);

    return () => window.clearTimeout(openTimer);
  }, [forceOpen, isPublicPath]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopup();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closePopup, open]);

  if (!isPublicPath) {
    return null;
  }

  if (!open) {
    return <span data-landing-popup-root hidden />;
  }

  return (
    <div
      className="landing-popup-overlay"
      data-landing-popup-root
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closePopup();
        }
      }}
    >
      <article
        aria-labelledby="landing-popup-title"
        aria-modal="true"
        className="landing-popup-modal"
        role="dialog"
      >
        <header className="landing-popup-header">
          <h2 id="landing-popup-title">{LANDING_POPUP_CONTENT.title}</h2>
          <button
            aria-label={LANDING_POPUP_CONTENT.closeLabel}
            className="landing-popup-close"
            onClick={closePopup}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="landing-popup-body">
          {LANDING_POPUP_CONTENT.sections.map((section) => (
            <LandingPopupSection key={section.title} section={section} />
          ))}
        </div>
      </article>
    </div>
  );
}
