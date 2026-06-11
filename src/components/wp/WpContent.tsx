import React from "react";
import parse from "html-react-parser";
import type { DOMNode, Element } from "html-react-parser";
import { domToReact } from "html-react-parser";
import { WpAccordion } from "./WpAccordion";
import { WpButton } from "./WpButton";
import { WpColumns } from "./WpColumns";
import { WpImage } from "./WpImage";
import { WpTable } from "./WpTable";

export function replaceNode(node: DOMNode): React.JSX.Element | null | undefined {
  if (node.type !== "tag") return undefined;
  const el = node as Element;
  const cls = el.attribs?.class ?? "";

  if (cls.includes("lightweight-accordion")) {
    return <WpAccordion node={el} replace={replaceNode} />;
  }

  if (cls.includes("wp-block-columns") || cls.includes("is-layout-flex")) {
    return <WpColumns node={el} replace={replaceNode} />;
  }

  if (el.name === "table") {
    return <WpTable node={el} replace={replaceNode} />;
  }

  if (el.name === "img" && /wp-image-\d+/.test(cls)) {
    return <WpImage node={el} />;
  }

  if (cls.includes("wp-block-button__link")) {
    return (
      <WpButton
        href={el.attribs?.href ?? "#"}
        className={cls}
      >
        {domToReact(el.children as DOMNode[], { replace: replaceNode })}
      </WpButton>
    );
  }
}

export function WpContent({ html }: { html: string }) {
  return (
    <div className="wp-content">
      {parse(html, { replace: replaceNode })}
    </div>
  );
}
