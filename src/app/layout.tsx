import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site-config";
import "./globals.css";

const thaiFont = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

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
    <html lang="th" className={thaiFont.variable}>
      <body>{children}</body>
    </html>
  );
}
