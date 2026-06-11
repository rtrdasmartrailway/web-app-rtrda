import React from "react";
import type { DOMNode, Element } from "html-react-parser";
import { domToReact } from "html-react-parser";

type Props = {
  node: Element;
  replace: (node: DOMNode) => React.JSX.Element | null | undefined;
};

export function WpColumns({ node, replace }: Props) {
  const cls = node.attribs?.class ?? "";
  const isInsideAccordion = cls.includes("wp-block-columns");

  return (
    <div className={isInsideAccordion ? "wp-block-columns" : "wp-block-columns is-layout-flex"}>
      {domToReact(node.children as DOMNode[], { replace })}
    </div>
  );
}
