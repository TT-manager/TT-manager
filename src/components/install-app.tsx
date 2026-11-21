"use client";
import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Labels = { install: string; iosTitle: string; iosStep1: string; iosStep2: string; iosStep3: string; safariNote: string; chromeNote: string; gotIt: string; close: string };

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
        // Finestra a tutta larghezza (livello superiore della pagina): nel menu a tendina lo spazio è troppo stretto.
        <dialog ref={(el) => { if (el && !el.open) el.showModal(); }} onClose={() => setGuide(false)}
          onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
          className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-white/15 bg-ink p-0 text-white shadow-2xl backdrop:bg-black/70">
          <div className="p-5">
            <h2 className="font-display text-2xl font-bold uppercase">{labels.iosTitle}</h2>
            <p className={`mt-3 rounded-lg p-3 text-sm ${/CriOS/.test(navigator.userAgent) ? "bg-amber-400/15 text-amber-100" : "bg-white/5 text-white/80"}`}>
              {/CriOS/.test(navigator.userAgent) ? labels.chromeNote : labels.safariNote}</p>
            <ol className="mt-4 space-y-4 text-base">
              <li className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10"><Share aria-hidden="true" className="h-5 w-5" /></span><span className="pt-1.5">{labels.iosStep1}</span></li>
              <li className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10"><SquarePlus aria-hidden="true" className="h-5 w-5" /></span><span className="pt-1.5">{labels.iosStep2}</span></li>
              <li className="flex items-start gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold">3</span><span className="pt-1.5">{labels.iosStep3}</span></li>
            </ol>
            <button type="button" onClick={(e) => e.currentTarget.closest("dialog")?.close()} className="btn-primary mt-6 w-full justify-center">{labels.gotIt}</button>
          </div>
        </dialog>)}
    </div>
  );
}
