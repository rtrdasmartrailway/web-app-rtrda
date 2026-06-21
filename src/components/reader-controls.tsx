"use client";

import { useEffect, useState } from "react";
import type { WpLanguage } from "@/lib/wp/types";

const FONT_SCALES = [1, 1.08, 1.16] as const;

function labelForScale(language: WpLanguage, index: number): string {
  if (language === "th") {
    return ["ขนาดตัวอักษรปกติ", "เพิ่มขนาดตัวอักษร", "เพิ่มขนาดตัวอักษรมากที่สุด"][index];
  }

  return ["Default font size", "Larger font size", "Largest font size"][index];
}

export function ReaderControls({
  className,
  language,
}: {
  className?: string;
  language: WpLanguage;
}) {
  const [fontScale, setFontScale] = useState<(typeof FONT_SCALES)[number]>(1);
  const classNames = ["reader-controls", className].filter(Boolean).join(" ");

  useEffect(() => {
    document.documentElement.style.setProperty("--reader-scale", String(fontScale));
  }, [fontScale]);

  return (
    <div
      className={classNames}
      aria-label={language === "th" ? "ขนาดตัวอักษร" : "Font size"}
    >
      <span>{language === "th" ? "ขนาดตัวอักษร" : "Font Size"}</span>
      {FONT_SCALES.map((scale, index) => (
        <button
          key={scale}
          type="button"
          aria-label={labelForScale(language, index)}
          aria-pressed={fontScale === scale}
          onClick={() => setFontScale(scale)}
        >
          {"A".repeat(index + 1)}
        </button>
      ))}
    </div>
  );
}
