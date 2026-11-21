"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useTr } from "@/i18n/client";
import { layoutText } from "@/i18n/dict/layout";

/** Toglie la schermata di apertura (vedi #pf-splash nel layout) quando la pagina è pronta. */
export function SplashHide() {
  useEffect(() => { document.getElementById("pf-splash")?.classList.add("pf-hide"); }, []);
  return null;
}

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb); window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};

/** Striscia «Nessuna connessione» in basso, finché manca la rete; sparisce da sola quando torna. */
export function OnlineStatus() {
  const t = useTr(layoutText);
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
      <span className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20">
        <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />{t.offline}</span>
    </div>
  );
}
