import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ClickFeedback } from "@/components/click-feedback";
import { OnlineStatus, SplashHide } from "@/components/splash";
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

/**
 * Immagini di apertura per iPhone (logo su fondo scuro): iOS le mostra mentre apre l'app installata, prima ancora che
 * il sito risponda. Una per modello: larghezza e altezza in punti, densità dello schermo.
 */
const IPHONE_SPLASH: [number, number, number][] = [
  [440, 956, 3], [420, 912, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [390, 844, 3],
  [428, 926, 3], [414, 896, 3], [414, 896, 2], [375, 812, 3], [414, 736, 3], [375, 667, 2],
];
const startupImage = IPHONE_SPLASH.map(([w, h, r]) => ({
  url: `/splash/iphone-${w * r}x${h * r}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));

export async function generateMetadata(): Promise<Metadata> {
  const t = await tr(layoutText);
  return {
    title: { default: `${SITE_NAME} · ${t.siteTitle}`, template: `%s · ${SITE_NAME}` }, description: t.siteDescription,
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent", startupImage },
  };
}

export const viewport: Viewport = { themeColor: "#111113" };

/** Tutta la pagina nella lingua scelta (cookie): per questo sta dentro <Suspense>. */
async function Localized({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale={await getLocale()}>{children}</LocaleProvider>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Schermata di apertura (solo nell'app installata): è nell'HTML iniziale, quindi si vede subito. */}
        <div id="pf-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo vettoriale, nessuna ottimizzazione necessaria */}
          <img src="/logo-scuro.svg" alt="" width={181} height={48} className="h-12 w-auto" />
          <span className="pf-splash-spinner" />
        </div>
        <Suspense fallback={null}>
          <Localized>
            <SplashHide />
            <OnlineStatus />
            <ClickFeedback />
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </Localized>
        </Suspense>
      </body>
    </html>
  );
}
