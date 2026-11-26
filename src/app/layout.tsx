import type { Metadata, Viewport } from "next";
import { Amiri_Quran, IBM_Plex_Sans_Arabic } from "next/font/google";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import "./globals.css";

const ui = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], variable: "--font-ui", display: "swap" });
const quran = Amiri_Quran({ subsets: ["arabic"], weight: "400", variable: "--font-quran-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "حَقَّ تِلَاوَتِهِ — منصة تعليم أحكام التلاوة والتجويد", template: "%s — حَقَّ تِلَاوَتِهِ" },
  description: "رحلتك نحو إتقان تلاوة القرآن الكريم: منصة مجانية مفتوحة لتعلّم أحكام التلاوة والتجويد، دون تسجيل ودون رسوم.",
  applicationName: "حَقَّ تِلَاوَتِهِ",
};

export const viewport: Viewport = { themeColor: "#1b5440", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${ui.variable} ${quran.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          تخطَّ إلى المحتوى
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
