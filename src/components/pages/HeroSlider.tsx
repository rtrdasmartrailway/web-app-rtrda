"use client";
import { useState } from "react";
import Image from "next/image";

interface Slide {
  imageUrl: string;
  alt: string;
}

const FALLBACK_SLIDES: Slide[] = [
  { imageUrl: "/stitch-assets/home-hero.png", alt: "สทร. — สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง" },
];

export function HeroSlider({ slides }: { slides?: Slide[] }) {
  const activeSlides = slides?.length ? slides : FALLBACK_SLIDES;
  const [current, setCurrent] = useState(0);

  return (
    <section className="relative w-full overflow-hidden bg-[#001f49] aspect-[16/7]">
      {activeSlides.map((slide, i) => (
        <Image
          key={i}
          src={slide.imageUrl}
          alt={slide.alt}
          fill
          className={`object-cover transition-opacity duration-500 ${i === current ? "opacity-100" : "opacity-0"}`}
          priority={i === 0}
          sizes="100vw"
        />
      ))}
      {activeSlides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {activeSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? "w-8 bg-white" : "w-4 bg-white/50"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
