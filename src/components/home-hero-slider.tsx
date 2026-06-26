"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  "/stitch-assets/home-hero-slides/slide-1.png",
  "/stitch-assets/home-hero-slides/slide-2.png",
  "/stitch-assets/home-hero-slides/slide-3.png",
  "/stitch-assets/home-hero-slides/slide-4.jpg",
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
      <div className="home-hero-slides" aria-hidden="true">
        {SLIDES.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt=""
            className={`home-hero-slide ${index === activeIndex ? "is-active" : ""}`}
            fill
            priority={index === 0}
            sizes="100vw"
            unoptimized
          />
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
