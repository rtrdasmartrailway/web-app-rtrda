"use client";

import React, { useState } from "react";
import type { DOMNode, Element } from "html-react-parser";
import { domToReact } from "html-react-parser";

type Props = {
  node: Element;
  replace: (node: DOMNode) => React.JSX.Element | null | undefined;
};

function AccordionItem({
  detailsNode,
  replace,
}: {
  detailsNode: Element;
  replace: (node: DOMNode) => React.JSX.Element | null | undefined;
}) {
  const [open, setOpen] = useState(false);

  const children = detailsNode.children as DOMNode[];
  const summaryNode = children.find(
    (c): c is Element => c.type === "tag" && (c as Element).name === "summary",
  );
  const bodyNodes = children.filter(
    (c) => !(c.type === "tag" && (c as Element).name === "summary"),
  );

  const titleText = summaryNode
    ? domToReact(summaryNode.children as DOMNode[])
    : null;

  return (
    <div className="lightweight-accordion-item" data-open={open}>
      <button
        type="button"
        className="lightweight-accordion-title"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {titleText}
        <span className="lightweight-accordion-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="lightweight-accordion-body">
          {domToReact(bodyNodes, { replace })}
        </div>
      ) : null}
    </div>
  );
}

export function WpAccordion({ node, replace }: Props) {
  const children = node.children as DOMNode[];
  const detailsNodes = children.filter(
    (c): c is Element => c.type === "tag" && (c as Element).name === "details",
  );

  return (
    <div className="lightweight-accordion">
      {detailsNodes.map((d, i) => (
        <AccordionItem key={i} detailsNode={d} replace={replace} />
      ))}
    </div>
  );
}
