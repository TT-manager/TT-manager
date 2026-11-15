"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Riscontro immediato su tutto il sito, senza toccare i singoli pulsanti:
 * - tocco su un collegamento interno → barra rossa in cima finché la nuova pagina non arriva;
 * - invio di un modulo → rotellina sul pulsante premuto e barra in cima finché l'operazione non finisce
 *   (il pulsante torna attivo, la pagina cambia o si aggiorna). Un «Annulla» nella finestra di conferma non conta.
 * Va dentro <Suspense> (legge l'indirizzo della pagina).
 */
export function ClickFeedback() {
  const path = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const stop = useRef<() => void>(() => {});

  // La pagina è cambiata: fine dell'attesa.
  useEffect(() => { stop.current(); }, [path, search]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;
    let button: HTMLElement | null = null;
    const end = () => {
      clearTimeout(timer); observer?.disconnect(); observer = undefined;
      button?.removeAttribute("data-busy"); button = null;
      setBusy(false);
    };
    stop.current = end;
    const start = (b: HTMLElement | null, maxMs: number) => {
      end();
      setBusy(true);
      timer = setTimeout(end, maxMs); // in ogni caso non resta accesa per sempre
      if (!b) return;
      button = b;
      b.setAttribute("data-busy", "");
      // Finisce quando il pulsante, dopo essere stato disattivato durante l'attesa, torna attivo,
      // oppure (se non viene mai disattivato) al primo aggiornamento della pagina dopo l'invio.
      let wasDisabled = false;
      const t0 = Date.now();
      observer = new MutationObserver((records) => {
        if (!button) return;
        if ((button as HTMLButtonElement).disabled) { wasDisabled = true; return; }
        if (wasDisabled) { end(); return; }
        // Pulsante che non si disattiva: la prima modifica della pagina dopo l'invio è la risposta.
        if (Date.now() - t0 > 400 && records.some((r) => r.type === "childList")) end();
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
      // Se il pulsante non si disattiva mai, non sappiamo quando finisce: basta qualche secondo di riscontro.
      setTimeout(() => { if (button === b && !wasDisabled) { clearTimeout(timer); timer = setTimeout(end, 2600); } }, 400);
    };

    // Le finestre di conferma: se l'utente preme «Annulla», nessuna attesa.
    let cancelledAt = 0;
    const originalConfirm = window.confirm;
    window.confirm = (msg?: string) => { const ok = originalConfirm.call(window, msg); if (!ok) cancelledAt = Date.now(); return ok; };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // stessa pagina o ancora (#)
      start(null, 15000);
    };
    const onSubmit = (e: SubmitEvent) => {
      if (Date.now() - cancelledAt < 1000) return; // confermato con «Annulla»
      const b = (e.submitter as HTMLElement | null) ?? (e.target as HTMLFormElement).querySelector<HTMLElement>("button:not([type=button])");
      setTimeout(() => { if (Date.now() - cancelledAt >= 1000) start(b, 20000); }, 0);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.confirm = originalConfirm;
      end();
    };
  }, []);

  return busy ? <div className="top-progress" role="progressbar" aria-label="…" /> : null;
}
