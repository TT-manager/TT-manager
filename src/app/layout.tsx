import type { Metadata } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/components/logo";
import { Suspense } from "react";
import { getLocale, tr } from "@/i18n/server";
import { LocaleProvider } from "@/i18n/client";
import { layoutText } from "@/i18n/dict/layout";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Carattere stretto e deciso per titoli e numeri, da tabellone sportivo.
const display = Barlow_Condensed({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await tr(layoutText);
  return { title: { default: `${SITE_NAME} · ${t.siteTitle}`, template: `%s · ${SITE_NAME}` }, description: t.siteDescription };
}

/** Tutta la pagina nella lingua scelta (cookie): per questo sta dentro <Suspense>. */
async function Localized({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale={await getLocale()}>{children}</LocaleProvider>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={null}>
          <Localized>
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </Localized>
        </Suspense>
      </body>
    </html>
  );
}
