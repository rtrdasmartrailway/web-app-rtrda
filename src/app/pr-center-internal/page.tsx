import type { Metadata } from "next";
import { PrCenterApp } from "@/components/pr-center-app";

export const metadata: Metadata = {
  title: "RTRDA PR Center",
  description: "RTRDA internal public relations workspace prototype",
};

export default function PrCenterPage() {
  return <PrCenterApp />;
}
