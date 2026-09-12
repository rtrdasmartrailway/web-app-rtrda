import type { Metadata } from "next";
import { PrCenterWorkspace } from "@/components/pr-center-workspace";

export const metadata: Metadata = {
  title: "RTRDA PR Center",
  description: "RTRDA internal public relations workflow workspace",
};

export default function PrCenterPage() {
  return <PrCenterWorkspace />;
}
