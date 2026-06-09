import type { Metadata } from "next";
import { IntranetShell } from "@/components/intranet-site";

export const metadata: Metadata = {
  title: "RTRDA INTRANET",
  description: "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) — ระบบอินทราเน็ต",
};

export default function IntranetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Amiko:wght@400;600;700&family=Archivo+Black&family=Inria+Serif:ital,wght@0,400;0,700;1,400&display=swap"
      />
      <IntranetShell>{children}</IntranetShell>
    </>
  );
}
