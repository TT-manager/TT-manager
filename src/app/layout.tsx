import type { Metadata } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/components/logo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Carattere stretto e deciso per titoli e numeri, da tabellone sportivo.
const display = Barlow_Condensed({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} · Tennis tavolo`, template: `%s · ${SITE_NAME}` },
  description: "Leghe di tennis tavolo: classifiche, tornei e risultati in diretta.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <footer className="mt-16 border-t border-line py-6 text-center text-sm text-muted">{SITE_NAME} · tennis tavolo</footer>
      </body>
    </html>
  );
}
