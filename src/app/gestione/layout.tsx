import { Suspense } from "react";

// Gestione di un torneo: per admin delle leghe e per chi ha creato un amichevole.
// I permessi sono verificati in ogni pagina e azione (requireTournamentManager).
export default function ManageLayout({ children }: LayoutProps<"/gestione">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <p className="mb-4 inline-block rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">Gestione torneo</p>
      <Suspense fallback={<p>Caricamento…</p>}>{children}</Suspense>
    </div>
  );
}
