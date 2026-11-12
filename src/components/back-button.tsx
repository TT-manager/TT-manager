"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Pagine aperte dentro il sito in questa scheda (la barra resta montata tra una pagina e l'altra).
let visited = 0;
let lastPath: string | null = null;

/**
 * Freccia «indietro» nella barra: torna alla pagina precedente del sito come il tasto del browser
 * (subito, senza ricaricare). Se si è arrivati da fuori, porta alla home. Nascosta nella home.
 */
export function BackButton() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (path !== lastPath) { visited++; lastPath = path; } }, [path]);
  if (path === "/") return null;
  return (
    <button type="button" aria-label="Indietro" title="Indietro"
      onClick={() => {
        const fromSite = visited > 1 || document.referrer.startsWith(window.location.origin);
        if (fromSite && window.history.length > 1) router.back(); else router.push("/");
      }}
      className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
  );
}
