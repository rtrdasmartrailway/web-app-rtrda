"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackSrc?: string;
}

/**
 * Next.js Image wrapper that falls back to a placeholder image if the
 * primary source fails to load. Prevents empty/broken image boxes from
 * rendering when the image optimizer or the source file is unavailable.
 */
export function SafeImage({
  src,
  alt,
  fallbackSrc,
  className,
  ...props
}: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(() =>
    src && typeof src === "string" && src.trim() !== "" ? src : fallbackSrc,
  );
  const [failed, setFailed] = useState(false);

  if (failed || !currentSrc) {
    return (
      <span
        className={`safe-image-placeholder ${className || ""}`}
        style={
          props.fill
            ? undefined
            : {
                width: typeof props.width === "number" ? props.width : "100%",
                height:
                  typeof props.height === "number" ? props.height : "100%",
                display: "inline-block",
              }
        }
      />
    );
  }

  return (
    <Image
      {...props}
      className={className}
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
