import React from "react";
import type { DOMNode, Element } from "html-react-parser";
import { domToReact } from "html-react-parser";

type Props = {
  node: Element;
  replace: (node: DOMNode) => React.JSX.Element | null | undefined;
};

export function WpTable({ node, replace }: Props) {
  return (
    <div className="wp-table-wrap">
      <table className={node.attribs?.class}>
        {domToReact(node.children as DOMNode[], { replace })}
      </table>
    </div>
  );
}
