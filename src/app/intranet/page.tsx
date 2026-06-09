import type { Metadata } from "next";
import { IntranetHome } from "@/components/intranet-site";

export const metadata: Metadata = {
  title: "RTRDA INTRANET",
};

export default function IntranetPage() {
  return <IntranetHome />;
}
