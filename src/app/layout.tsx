import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site-config";
import { WebAnalyticsTracker } from "@/components/analytics/web-analytics-tracker";
import "./globals.css";

const thaiFont = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

const siteTitle = "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)";
const siteDescription = "Rail Technology Research and Development Agency (RTRDA)";
const logoImage = "/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: siteTitle,
    template: "%s",
  },
  description: siteDescription,
  icons: {
    icon: [
      {
        url: "/wp-content/uploads/2023/02/cropped-Logo_RTRDA-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/wp-content/uploads/2023/02/cropped-Logo_RTRDA-270x270.png",
        sizes: "270x270",
        type: "image/png",
      },
    ],
    apple: "/wp-content/uploads/2023/02/cropped-Logo_RTRDA-270x270.png",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "RTRDA",
    images: [
      {
        url: logoImage,
        width: 364,
        height: 75,
        alt: "RTRDA Logo",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [logoImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={thaiFont.variable}>
      <body>
        <WebAnalyticsTracker />
        {children}
      </body>
    </html>
  );
}
