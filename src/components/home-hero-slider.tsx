"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    src: "/stitch-assets/home-hero-slides/slide-1.png",
    href: "/ติดต่อเรา/ช่องทางการติดต่อ",
    label: "แจ้งรับ-ส่งหนังสือราชการและติดต่อสอบถามข้อมูล",
  },
  {
    src: "/stitch-assets/home-hero-slides/slide-2.png",
    href: "/สทร-ร่วมประกาศเจตนารมณ์-no-gift-policy-2569",
    label: "นโยบาย No Gift Policy",
  },
  {
    src: "/stitch-assets/home-hero-slides/slide-3.png",
    href: "/สทร-ศึกษาดูงานศูนย์ข้อม",
    label: "ศูนย์ข้อมูลข่าวสาร สทร.",
  },
  {
    src: "/stitch-assets/home-hero-slides/slide-4.jpg",
    href: "/ช่องทางการแจ้งเรื่องกา",
    label: "ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
  },
] as const;

const AUTOPLAY_DELAY_MS = 5000;

export function HomeHeroSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);

    updatePreference();
    media.addEventListener("change", updatePreference);

    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % SLIDES.length);
    }, AUTOPLAY_DELAY_MS);

    return () => window.clearInterval(intervalId);
  }, [paused, reducedMotion]);

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + SLIDES.length) % SLIDES.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % SLIDES.length);
  }

  return (
    <div
      className="home-hero-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="home-hero-slides">
        {SLIDES.map((slide, index) => (
          <Link
            aria-label={`เปิดเรื่อง: ${slide.label}`}
            className={`home-hero-slide-link ${index === activeIndex ? "is-active" : ""}`}
            href={slide.href}
            key={slide.src}
            tabIndex={index === activeIndex ? 0 : -1}
          >
            <Image
              src={slide.src}
              alt={slide.label}
              className="home-hero-slide"
              fill
              priority={index === 0}
              sizes="100vw"
              unoptimized
            />
          </Link>
        ))}
      </div>
      <button
        type="button"
        className="home-hero-nav home-hero-nav-prev"
        aria-label="รูปก่อนหน้า"
        onClick={showPrevious}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        className="home-hero-nav home-hero-nav-next"
        aria-label="รูปถัดไป"
        onClick={showNext}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
