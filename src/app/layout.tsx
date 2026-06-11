import type { Metadata } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "RTRDA",
    template: "%s",
  },
  description:
    "Rail Technology Research and Development Agency migrated WordPress content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
