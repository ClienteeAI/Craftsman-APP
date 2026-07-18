import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getPublicTenant } from "@/lib/tenant";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Rýchla ponuka strechy",
  description: "Nadiktuj obhliadku, dostaneš cenovú ponuku. Pre pokrývačov.",
  // Zadání klienta: "s vytvorením ikony v mobile užívateľa".
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ponuka strechy",
  },
};

/**
 * 98 % provozu je telefon. Tomu odpovídá i tohle:
 *
 * - maximumScale + userScalable: majster má rukavice a mokré ruce; omylem
 *   zazoomovaná stránka uprostřed obhlídky je otrava. Formuláře mají dost
 *   velký text (16px+), takže iOS nezoomuje sám při ťuknutí do inputu.
 * - viewportFit: cover kvůli výřezu a spodní liště na iPhonu.
 * - themeColor barví adresní řádek i lištu v nainstalované appce.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const tenant = getPublicTenant();
  return (
    <html lang={tenant.locale} className={`${geistSans.variable} h-full antialiased`}>
      {/* overscroll-none: bez toho se na iOS celá appka "gumově" odlepuje od okraje
          a působí jako web, ne jako nainstalovaná aplikace. Pozadí řeší globals.css. */}
      <body className="flex min-h-full flex-col overscroll-none">{children}</body>
    </html>
  );
}
