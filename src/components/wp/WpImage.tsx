import NextImage from "next/image";
import type { Element } from "html-react-parser";

type Props = { node: Element };

export function WpImage({ node }: Props) {
  const { src, alt, width, height, class: cls, ...rest } = node.attribs ?? {};

  if (!src) return null;

  const w = width ? Number(width) : null;
  const h = height ? Number(height) : null;

  if (w && h) {
    return (
      <NextImage
        src={src}
        alt={alt ?? ""}
        width={w}
        height={h}
        className={cls}
        style={{ height: "auto" }}
        {...(rest.loading === "lazy" ? { loading: "lazy" } : {})}
      />
    );
  }

  // Unknown dimensions — render in a relative container with fill
  return (
    <span className="wp-image-wrap" style={{ display: "block", position: "relative", minHeight: 200 }}>
      <NextImage
        src={src}
        alt={alt ?? ""}
        fill
        className={cls}
        style={{ objectFit: "contain" }}
        sizes="(max-width: 768px) 100vw, 800px"
      />
    </span>
  );
}
