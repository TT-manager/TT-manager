import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { SITE_NAME } from "./logo";
import { SUPPORT_EMAIL } from "@/lib/site";

const link = "rounded px-1 -mx-1 py-0.5 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand";
const heading = "font-display text-sm font-semibold uppercase tracking-wider text-foreground";

/** Accedi/Registrati per chi non è collegato; profilo ed Esci per chi lo è. */
async function AccountLinks() {
  const { data } = await (await createServerSupabase()).auth.getClaims();
  if (!data?.claims?.sub) return <>
    <li><Link href="/login" className={link}>Accedi</Link></li>
    <li><Link href="/registrati" className={link}>Registrati</Link></li>
  </>;
  return <>
    <li><Link href="/profilo" className={link}>Il mio profilo</Link></li>
    <li><form action={logout}><button className={`${link} cursor-pointer text-left`}>Esci</button></form></li>
  </>;
}

/** Piè di pagina, uguale su tutte le pagine. Solo i link dell'account dipendono da chi è collegato. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-4 border-ink bg-surface text-sm text-muted">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="font-display text-xl font-bold uppercase text-foreground">{SITE_NAME}</p>
          <p className="mt-2 max-w-sm">Leghe amatoriali di tennis tavolo tra amici: ranking, tornei e risultati in diretta.</p>
        </div>

        <nav aria-label="Il sito">
          <h2 className={heading}>Il sito</h2>
          <ul className="mt-3 space-y-1.5">
            <li><Link href="/" className={link}>Home</Link></li>
            <li><Link href="/faq" className={link}>Domande frequenti</Link></li>
            <Suspense fallback={null}><AccountLinks /></Suspense>
          </ul>
        </nav>

        <nav aria-label="Informazioni legali">
          <h2 className={heading}>Informazioni legali</h2>
          <ul className="mt-3 space-y-1.5">
            {SUPPORT_EMAIL && <li><a href={`mailto:${SUPPORT_EMAIL}`} className={link}>{SUPPORT_EMAIL}</a></li>}
            <li><Link href="/privacy" className={link}>Informativa privacy</Link></li>
            <li><Link href="/termini" className={link}>Termini d&apos;uso</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 text-xs sm:flex-row sm:justify-between">
          <p>© {SITE_NAME}. Tutti i diritti riservati.</p>
          <p>Usiamo solo cookie tecnici: nessuna pubblicità, nessun tracciamento.</p>
        </div>
      </div>
    </footer>
  );
}
