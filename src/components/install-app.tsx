"use client";
import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Labels = { install: string; iosTitle: string; iosStep1: string; iosStep2: string; iosStep3: string; close: string };

/**
 * Registra il programma di servizio e propone di installare l'app.
 * - Android / Chrome: pulsante «Installa l'app» (usa la richiesta del browser).
 * - iPhone e iPad: non c'è un pulsante, si mostra la guida «Condividi → Aggiungi alla schermata Home».
 * Non compare se l'app è già installata.
 */
/**
 * La richiesta di installazione del browser arriva una volta sola e a pagina caricata: si conserva qui,
 * all'avvio, così il pulsante nel menu la trova anche se il menu si apre dopo.
 */
let deferred: InstallEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
  window.addEventListener("appinstalled", () => { installedNow = true; deferred = null; notify(); });
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Stato del dispositivo. Sul server non si sa nulla: il pulsante compare solo dopo il caricamento. */
const kindNow = () => {
  if (installedNow) return "installed";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const ua = navigator.userAgent;
  // iPadOS si presenta come un Mac con lo schermo tattile.
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return standalone ? "installed" : deferred ? "prompt" : ios ? "ios" : "other";
};

export function InstallApp({ labels, className = "" }: { labels: Labels; className?: string }) {
  const [guide, setGuide] = useState(false);
  const kind = useSyncExternalStore(subscribe, kindNow, () => "installed");
  if (kind === "installed" || kind === "other") return null;
  return (
    <div className={className}>
      <button type="button" onClick={async () => {
        if (deferred) { const e = deferred; await e.prompt(); await e.userChoice; deferred = null; notify(); } else setGuide(!guide);
      }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/10">
        <Download aria-hidden="true" className="h-5 w-5 shrink-0 text-white/70" strokeWidth={2} />{labels.install}
      </button>
      {guide && kind === "ios" && (
        <div className="mx-4 mb-2 rounded-lg bg-white/5 p-3 text-sm text-white/85">
          <p className="font-semibold">{labels.iosTitle}</p>
          <ol className="mt-2 space-y-1.5">
            <li className="flex items-start gap-2"><Share aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{labels.iosStep1}</li>
            <li className="flex items-start gap-2"><SquarePlus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{labels.iosStep2}</li>
            <li className="flex items-start gap-2"><span aria-hidden="true" className="w-4 shrink-0 text-center font-bold">3</span>{labels.iosStep3}</li>
          </ol>
        </div>)}
    </div>
  );
}
